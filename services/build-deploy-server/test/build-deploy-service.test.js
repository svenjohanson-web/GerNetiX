const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createConfig,
  createDefaultBuildDeployService,
} = require("../src");

test("build job produces required artifacts and removes temporary project workspace", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
  });
  const service = createDefaultBuildDeployService(config);

  const accepted = await service.submitJob({
    job_id: "job-1",
    mode: "build",
    build_package: {
      files: {
        "build-job.json": { id: "job-1" },
        "platformio.ini": "[env:test]\nplatform = espressif32\n",
        "src/main.cpp": "void setup() {}\nvoid loop() {}\n",
      },
    },
  });

  assert.equal(accepted.status, "running");
  await service.jobs.get("job-1").promise;

  const job = service.getJob("job-1");
  assert.equal(job.status, "succeeded");
  assert.equal(job.result.build.status, "succeeded");
  assert.ok(job.result.build.artifacts["firmware.bin"].sha256);
  assert.ok(job.result.build.artifacts["firmware.elf"].size_bytes > 0);
  assert.equal(job.result.deploy.status, "not_requested");

  await assert.rejects(
    fs.access(path.join(config.tempDir, "job-1")),
    /ENOENT/,
  );
});

test("prebuild cannot trigger deploy", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
  }));

  await service.submitJob({
    job_id: "prebuild-deploy",
    mode: "prebuild",
    device_id: "device-1",
    deploy: { requested: true, device_id: "device-1", authorized: true },
    build_package: { files: { "build-job.json": "{}" } },
  });
  await service.jobs.get("prebuild-deploy").promise;

  const job = service.getJob("prebuild-deploy");
  assert.equal(job.status, "failed");
  assert.equal(job.error.code, "prebuild_cannot_deploy");
});

test("unsafe build package paths fail and leave no temporary workspace", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
  });
  const service = createDefaultBuildDeployService(config);

  await service.submitJob({
    job_id: "unsafe-path",
    mode: "build",
    build_package: {
      files: {
        "../outside.txt": "nope",
      },
    },
  });
  await service.jobs.get("unsafe-path").promise;

  const job = service.getJob("unsafe-path");
  assert.equal(job.status, "failed");
  assert.equal(job.error.code, "unsafe_build_package_path");
  await assert.rejects(
    fs.access(path.join(config.tempDir, "unsafe-path")),
    /ENOENT/,
  );
});

test("waiting device job is replaced by newer waiting job", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
  }));

  service.runner.run = async () => new Promise(() => {});

  await service.submitJob({
    job_id: "active",
    mode: "build",
    device_id: "device-1",
    build_package: { files: { "build-job.json": "{}" } },
  });
  await service.submitJob({
    job_id: "waiting-old",
    mode: "build",
    device_id: "device-1",
    build_package: { files: { "build-job.json": "{}" } },
  });
  await service.submitJob({
    job_id: "waiting-new",
    mode: "build",
    device_id: "device-1",
    build_package: { files: { "build-job.json": "{}" } },
  });

  assert.equal(service.getJob("active").status, "running");
  assert.equal(service.getJob("waiting-old").status, "replaced");
  assert.equal(service.getJob("waiting-new").status, "queued");
});
