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
    NODE_ENV: "test",
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
  assert.equal(job.result.build.primary_firmware.file_name, "firmware.bin");
  assert.ok(job.result.build.artifacts["firmware.bin"].sha256);
  assert.ok(job.result.build.artifacts["firmware.elf"].size_bytes > 0);
  assert.equal(job.result.deploy.status, "not_requested");

  await assert.rejects(
    fs.access(path.join(config.tempDir, "job-1")),
    /ENOENT/,
  );
});

test("build job can return avr hex firmware as primary artifact", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-avr-artifacts-"));
  const hexPath = path.join(sourceDir, "firmware.hex");
  const elfPath = path.join(sourceDir, "firmware.elf");
  const logPath = path.join(sourceDir, "build.log");
  await fs.writeFile(hexPath, ":00000001FF\n");
  await fs.writeFile(elfPath, "avr elf\n");
  await fs.writeFile(logPath, "avr build\n");
  service.runner.run = async () => ({
    status: "succeeded",
    artifacts: {
      "firmware.hex": hexPath,
      "firmware.elf": elfPath,
      "build.log": logPath,
    },
  });

  await service.submitJob({
    job_id: "avr-hex",
    mode: "build",
    build_package: { files: { "build-job.json": "{}" } },
  });
  await service.jobs.get("avr-hex").promise;

  const job = service.getJob("avr-hex");
  assert.equal(job.status, "succeeded");
  assert.equal(job.result.build.primary_firmware.file_name, "firmware.hex");
  assert.ok(job.result.build.artifacts["firmware.hex"].sha256);
  assert.equal(job.result.deploy.status, "not_requested");
});

test("build job persists a certificate-authenticated FlashBox delivery for one helper", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  const published = [];
  service.deployOrchestrator.publicBaseUrl = "https://build.gernetix.com";
  service.deployOrchestrator.mqttPublisher = { publish: async (...args) => published.push(args) };
  service.deployOrchestrator.authorizationSigner = { keyId: "test", sign: async () => "signature" };

  await service.submitJob({
    job_id: "flashbox-delivery",
    mode: "build",
    device_id: "target-esp32",
    flashbox: {
      requested: true,
      flashbox_device_id: "flashbox-1",
      flashbox_hardware_profile_id: "hardware.flashbox.esp32_s3_usb_helper",
      target_device_id: "target-esp32",
      target_hardware_profile_id: "hardware.esp32_s3",
    },
    build_package: { files: { "build-job.json": "{}" } },
  });
  await service.jobs.get("flashbox-delivery").promise;

  const job = service.getJob("flashbox-delivery");
  assert.equal(job.status, "succeeded");
  assert.equal(job.flashbox.flashbox_device_id, "flashbox-1");
  assert.equal(job.result.flashbox.status, "published_waiting_flashbox");
  assert.equal(job.result.flashbox.transport, "flashbox_certificate_authenticated_mqtt_job");
  assert.equal(job.result.flashbox.topic, "gernetix/devices/flashbox-1/flashbox/jobs");
  assert.match(job.result.flashbox.artifact_sha256, /^[a-f0-9]{64}$/);
  assert.equal(published.length, 1);
});

test("successive project builds restore and update the PlatformIO incremental cache", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-incremental-build-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  });
  const service = createDefaultBuildDeployService(config);
  const observedCacheStates = [];
  const observedWorkspaces = [];
  const sourceModifiedTimes = [];
  service.runner.run = async (job, packageDir) => {
    observedWorkspaces.push(packageDir);
    sourceModifiedTimes.push((await fs.stat(path.join(packageDir, "src", "main.cpp"))).mtimeMs);
    const marker = path.join(packageDir, ".pio", "build", "cache-marker.txt");
    observedCacheStates.push(await fs.readFile(marker, "utf8").catch(() => "missing"));
    await fs.mkdir(path.dirname(marker), { recursive: true });
    await fs.writeFile(marker, job.job_id);
    const outputDir = path.join(packageDir, ".test-artifacts");
    await fs.mkdir(outputDir, { recursive: true });
    const artifacts = {
      "firmware.bin": path.join(outputDir, "firmware.bin"),
      "firmware.elf": path.join(outputDir, "firmware.elf"),
      "build.log": path.join(outputDir, "build.log"),
    };
    await Promise.all(Object.values(artifacts).map((file) => fs.writeFile(file, "artifact")));
    return { status: "succeeded", artifacts };
  };

  for (const jobId of ["incremental-1", "incremental-2"]) {
    await service.submitJob({
      job_id: jobId,
      project_id: "project-1",
      device_id: "device-1",
      mode: "build",
      build_package: { files: {
        "platformio.ini": "[env:test]\n",
        "src/main.cpp": "void setup() {}\nvoid loop() {}\n",
      } },
    });
    await service.jobs.get(jobId).promise;
  }

  assert.deepEqual(observedCacheStates, ["missing", "incremental-1"]);
  assert.equal(observedWorkspaces[0], observedWorkspaces[1]);
  assert.equal(sourceModifiedTimes[0], sourceModifiedTimes[1]);
  assert.equal(
    await fs.readFile(path.join(config.incrementalCacheDir, "project-1--device-1", "workspace", ".pio", "build", "cache-marker.txt"), "utf8"),
    "incremental-2",
  );
  assert.equal(await fs.readFile(path.join(observedWorkspaces[1], "src", "main.cpp"), "utf8"), "void setup() {}\nvoid loop() {}\n");
});

test("prebuild cannot trigger deploy", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
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

test("usb flash mode records usb flash result without ota deploy", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));

  await service.submitJob({
    job_id: "usb-flash",
    mode: "build_and_usb_flash",
    device_id: "esp32-usb",
    usb_flash: { upload_port: "COM7" },
    build_package: { files: { "build-job.json": "{}" } },
  });
  await service.jobs.get("usb-flash").promise;

  const job = service.getJob("usb-flash");
  assert.equal(job.status, "succeeded");
  assert.equal(job.result.build.usb_flash.status, "succeeded");
  assert.equal(job.result.build.usb_flash.upload_port, "COM7");
  assert.equal(job.result.deploy.transport, "usb");
});

test("unsafe build package paths fail and leave no temporary workspace", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-deploy-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
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
    NODE_ENV: "test",
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
