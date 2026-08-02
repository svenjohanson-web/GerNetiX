"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { CapacityProviderRegistry, ComputeControlPlaneService, InMemoryComputeRepository, ProjectRuntimeGrantService, WorkerTokenService, createHttpApp } = require("../src");
const { sendJson } = require("../src/http-app");

test("HTTP gateway separates internal and worker credentials through a complete lease", async () => {
  const service = new ComputeControlPlaneService({ repository: new InMemoryComputeRepository() });
  const tokenService = new WorkerTokenService({ secret: "signing-secret" });
  const appliedPatches = [];
  const projectRuntimeGrants = new ProjectRuntimeGrantService({ secret: "project-grant-secret" });
  const app = createHttpApp({ service, tokenService, internalToken: "internal-secret", workerBootstrapToken: "bootstrap-secret", providers: new CapacityProviderRegistry(), projectRuntimeGrants, projectPatchWriter: async (patch) => { appliedPatches.push(patch); return { status: "applied" }; } });
  const denied = await callApp(app, "/api/compute/internal/jobs", {}, {});
  assert.equal(denied.status, 403);

  const registration = await callApp(app, "/api/compute/workers/register", {
    headers: { "x-gernetix-worker-bootstrap-token": "bootstrap-secret" },
    body: worker(),
  });
  assert.equal(registration.status, 201);
  const bearer = registration.body.worker_credential.token;

  const submitted = await callApp(app, "/api/compute/internal/jobs", {
    headers: { "x-gernetix-compute-token": "internal-secret" }, body: job(),
  });
  assert.equal(submitted.status, 201);

  const leased = await callApp(app, "/api/compute/workers/leases/next", { headers: { authorization: `Bearer ${bearer}` }, body: {} });
  assert.equal(leased.body.job.job_id, "http-job");
  const completed = await callApp(app, `/api/compute/workers/jobs/http-job/leases/${leased.body.job.lease.lease_id}/complete`, { headers: { authorization: `Bearer ${bearer}` }, body: { output_revision: "sha256:fedcba9876543210", output_bytes: 64 } });
  assert.equal(completed.body.status, "succeeded");

  const grant = await callApp(app, "/api/compute/internal/project-runtime/grants", { headers: { "x-gernetix-compute-token": "internal-secret" }, body: { account_id: "account", project_id: "project", input_revision: "sha256:0123456789abcdef", read_paths: ["sensor.temperature"], write_paths: ["actuator.fan"] } });
  assert.equal(grant.status, 201);
  const patch = await callApp(app, "/api/compute/workers/project-runtime/patch", { headers: { authorization: `Bearer ${bearer}` }, body: { token: grant.body.token, account_id: "account", project_id: "project", input_revision: "sha256:0123456789abcdef", patch: { actuator: { fan: true } } } });
  assert.equal(patch.body.status, "applied");
  assert.equal(appliedPatches.length, 1);
});

async function callApp(app, url, options = {}) {
  const req = Readable.from([JSON.stringify(options.body || {})]);
  Object.assign(req, { method: options.method || "POST", url, headers: { host: "localhost", "content-type": "application/json", ...(options.headers || {}) } });
  const response = { status: 0, headers: {}, data: "", writeHead(status, headers) { this.status = status; this.headers = headers; }, end(data) { this.data = String(data || ""); } };
  await app(req, response).catch((error) => sendJson(response, error.status || 500, { error: error.code, message: error.message }));
  return { status: response.status, body: JSON.parse(response.data) };
}
function job() { return { job_id: "http-job", job_type: "firmware_build", execution_class: "trusted_system", tenant: { account_id: "account", project_id: "project" }, priority_class: "customer_background", input_revision: "sha256:0123456789abcdef", requirements: { cpu_arch: ["arm64"], cpu_millis: 1000, memory_bytes: 1024, toolchains: ["platformio"], network_policy: "artifact_api_only" }, limits: { deadline_at: "2099-01-01T00:00:00.000Z", max_runtime_ms: 60000, max_output_bytes: 1024, max_attempts: 2 } }; }
function worker() { return { worker_id: "http-worker", instance_id: "instance-1", provider: "private", region: "home", trust_zone: "private", cpu_arch: "arm64", cpu_cores: 8, memory_bytes: 16000000000, accelerators: [], toolchains: ["platformio"], execution_classes: ["trusted_system"], slots: { total: 2, free: 2 }, cost: { currency: "EUR", per_hour_micros: 0 } }; }
