"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ComputeBuildPoolBridge, createConfig, createDefaultBuildDeployService } = require("../src");
const { ComputeControlPlaneService, ComputeWorkerAgent, InMemoryComputeRepository } = require("../../compute-control-plane/src");

test("BuildDeployService delegates a pure build to the Compute build pool", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-compute-build-pool-"));
  const service = await createDefaultBuildDeployService(createConfig({ BUILD_DEPLOY_RUNTIME_DIR: runtimeDir, BUILD_RUNNER: "mock", NODE_ENV: "test" }));
  const delegated = [];
  service.computeBuildPool = {
    async dispatch(job, context) {
      delegated.push(job.job_id); context.onProgress("ARM64-Worker hat den Build übernommen.");
      return successfulResult(job);
    },
  };
  const accepted = await service.submitJob({ job_id: "elastic-build", mode: "build", account_id: "account-a", project_id: "project-a", build_package: { files: {} } });
  assert.equal(accepted.status, "running");
  await service.jobs.get("elastic-build").promise;
  const completed = service.getJob("elastic-build");
  assert.equal(completed.status, "succeeded");
  assert.deepEqual(delegated, ["elastic-build"]);
  assert.deepEqual(completed.progress.map((entry) => entry.phase), ["compute_queued", "compute", "completed"]);
  assert.equal(completed.result.deploy.status, "not_requested");
});

test("Compute build pool result cannot smuggle deploy, FlashBox or USB across the boundary", async () => {
  const cases = [
    ["deploy", (result) => { result.deploy = { status: "published" }; }, "compute_deploy_boundary_violated"],
    ["flashbox", (result) => { result.flashbox = { status: "published" }; }, "compute_flashbox_boundary_violated"],
    ["usb", (result) => { result.build.usb_flash = { requested: true, status: "succeeded" }; }, "compute_usb_boundary_violated"],
  ];
  for (const [name, mutate, expectedCode] of cases) {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), `gernetix-compute-build-${name}-`));
    const service = await createDefaultBuildDeployService(createConfig({ BUILD_DEPLOY_RUNTIME_DIR: runtimeDir, BUILD_RUNNER: "mock", NODE_ENV: "test" }));
    service.computeBuildPool = { async dispatch(job) { const result = successfulResult(job); mutate(result); return result; } };
    await service.submitJob({ job_id: `unsafe-${name}`, mode: "build", account_id: "account-a", project_id: "project-a", build_package: { files: {} } });
    await service.jobs.get(`unsafe-${name}`).promise;
    const failed = service.getJob(`unsafe-${name}`);
    assert.equal(failed.status, "failed"); assert.equal(failed.error.code, expectedCode);
  }
});

test("Build pool runs end-to-end through ComputeJob, worker lease and fenced completion", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-compute-build-e2e-"));
  const buildService = await createDefaultBuildDeployService(createConfig({ BUILD_DEPLOY_RUNTIME_DIR: runtimeDir, BUILD_RUNNER: "mock", NODE_ENV: "test" }));
  const control = new ComputeControlPlaneService({ repository: new InMemoryComputeRepository(), leaseTtlMs: 10000 });
  const bridge = new ComputeBuildPoolBridge({ controlPlane: control, pollIntervalMs: 1, maxWaitMs: 1000 });
  buildService.computeBuildPool = bridge;
  const identity = { worker_id: "build-worker-arm", instance_id: "boot-1" };
  const directClient = {
    async register(registration) { await control.registerWorker(registration); return { worker: registration }; },
    heartbeat: (patch) => control.heartbeat(identity, patch), leaseNext: () => control.leaseNext(identity),
    renew: (job) => control.renewLease(identity, job.job_id, job.lease.lease_id),
    complete: (job, result) => control.complete(identity, job.job_id, job.lease.lease_id, result),
    fail: (job, failure) => control.fail(identity, job.job_id, job.lease.lease_id, failure),
    drain: (draining) => control.drain(identity, draining),
  };
  const agent = new ComputeWorkerAgent({ client: directClient, registration: buildWorker(), handlers: { firmware_build: bridge.createWorkerHandler(async (job) => successfulResult(job)) } });
  await buildService.submitJob({ job_id: "compute-e2e", mode: "build", account_id: "account-a", project_id: "project-a", build_package: { files: { "src/main.cpp": "void setup() {}" } } });
  await agent.runOnce();
  await buildService.jobs.get("compute-e2e").promise;
  assert.equal(buildService.getJob("compute-e2e").status, "succeeded");
  const computeJob = await control.getJob("compute-e2e");
  assert.equal(computeJob.status, "succeeded");
  assert.equal(computeJob.lease, null);
  assert.equal((await control.repository.listUsage()).length, 1);
});

function successfulResult(job) {
  return { job_id: job.job_id, mode: job.mode, device_id: job.device_id, build: { status: "succeeded", build_id: "a".repeat(64), artifacts: {}, flash_manifest: [], primary_firmware: null }, deploy: { status: "not_requested" }, flashbox: { status: "not_requested" } };
}
function buildWorker() { return { worker_id: "build-worker-arm", instance_id: "boot-1", provider: "private-home", region: "de-home", trust_zone: "private", cpu_arch: "arm64", cpu_cores: 8, memory_bytes: 16000000000, accelerators: [], toolchains: ["platformio-6.1.18"], execution_classes: ["trusted_system"], slots: { total: 2, free: 2 }, cost: { currency: "EUR", per_hour_micros: 0 } }; }
