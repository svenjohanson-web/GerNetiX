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
  assert.deepEqual(job.progress.map((entry) => entry.phase), ["preparing", "packaging", "compiling", "artifacts", "completed"]);

  await assert.rejects(
    fs.access(path.join(config.tempDir, "job-1")),
    /ENOENT/,
  );
});

test("build-only worker rejects USB, OTA and FlashBox execution but accepts normal builds", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-only-worker-"));
  const service = await createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    BUILD_WORKER_ROLE: "build_only",
    NODE_ENV: "test",
  }));
  const buildPackage = { files: { "platformio.ini": "[env:test]\n", "src/main.cpp": "void setup() {}" } };

  await assert.rejects(
    service.submitJob({ job_id: "usb-on-remote", mode: "build_and_usb_flash", build_package: buildPackage }),
    (error) => error.code === "worker_job_not_allowed" && error.status === 409,
  );
  await assert.rejects(
    service.submitJob({ job_id: "flashbox-on-remote", mode: "build", build_package: buildPackage, flashbox: { requested: true, flashbox_device_id: "fb-1" } }),
    (error) => error.code === "worker_job_not_allowed",
  );
  const accepted = await service.submitJob({ job_id: "build-on-remote", mode: "build", build_package: buildPackage });
  assert.equal(accepted.status, "running");
  await service.jobs.get("build-on-remote").promise;
  assert.equal(service.getJob("build-on-remote").status, "succeeded");
  assert.equal(service.coordinationHealth().role, "build_only");
});

test("build job exposes runner output as ordered progress lines", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-progress-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  service.runner.run = async (_job, packageDir, options) => {
    options.onProgress("CMake konfiguriert das Projekt.");
    options.onProgress("Kompiliere user_main.cpp.");
    const artifactDir = path.join(packageDir, ".test-artifacts");
    await fs.mkdir(artifactDir, { recursive: true });
    const artifacts = Object.fromEntries(await Promise.all(["firmware.bin", "firmware.elf", "build.log"].map(async (name) => {
      const file = path.join(artifactDir, name);
      await fs.writeFile(file, name);
      return [name, file];
    })));
    return { status: "succeeded", artifacts };
  };

  await service.submitJob({
    job_id: "progress-lines",
    mode: "build",
    build_package: { files: { "platformio.ini": "[env:test]\n", "src/main.cpp": "void setup() {}" } },
  });
  await service.jobs.get("progress-lines").promise;

  const job = service.getJob("progress-lines");
  assert.deepEqual(job.progress.filter((entry) => entry.phase === "compiling").map((entry) => entry.message), [
    "PlatformIO startet die Kompilierung.",
    "CMake konfiguriert das Projekt.",
    "Kompiliere user_main.cpp.",
  ]);
  assert.deepEqual(job.progress.map((entry) => entry.sequence), job.progress.map((_entry, index) => index + 1));
});

test("a running build can be cancelled and releases its workspace", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-build-cancel-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  });
  const service = createDefaultBuildDeployService(config);
  let runnerStarted;
  const started = new Promise((resolve) => { runnerStarted = resolve; });
  service.runner.run = async (_job, _packageDir, options) => new Promise((resolve, reject) => {
    runnerStarted();
    options.signal.addEventListener("abort", () => {
      const error = new Error("Build wurde abgebrochen.");
      error.code = "build_cancelled";
      reject(error);
    }, { once: true });
  });

  await service.submitJob({
    job_id: "cancel-running",
    project_id: "project-cancel",
    mode: "build",
    build_package: { files: { "platformio.ini": "[env:test]\n", "src/main.cpp": "void setup() {}" } },
  });
  await started;

  const cancelling = await service.cancelJob("cancel-running");
  assert.equal(cancelling.status, "cancelling");
  await service.jobs.get("cancel-running").promise;

  const cancelled = service.getJob("cancel-running");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.error.code, "build_cancelled");
  assert.match(cancelled.progress.at(-1).message, /abgebrochen/i);
  await assert.rejects(fs.access(path.join(config.tempDir, "cancel-running")), /ENOENT/);
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

test("successive project builds reuse PlatformIO cache until compiler configuration changes", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-incremental-build-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  });
  const service = createDefaultBuildDeployService(config);
  const observedCacheStates = [];
  const observedManagedComponentStates = [];
  const observedWorkspaces = [];
  const sourceModifiedTimes = [];
  service.runner.run = async (job, packageDir) => {
    observedWorkspaces.push(packageDir);
    sourceModifiedTimes.push((await fs.stat(path.join(packageDir, "src", "main.cpp"))).mtimeMs);
    const marker = path.join(packageDir, ".pio", "build", "cache-marker.txt");
    const managedComponentMarker = path.join(packageDir, "managed_components", "cache-marker.txt");
    observedCacheStates.push(await fs.readFile(marker, "utf8").catch(() => "missing"));
    observedManagedComponentStates.push(await fs.readFile(managedComponentMarker, "utf8").catch(() => "missing"));
    await fs.mkdir(path.dirname(marker), { recursive: true });
    await fs.mkdir(path.dirname(managedComponentMarker), { recursive: true });
    await fs.writeFile(marker, job.job_id);
    await fs.writeFile(managedComponentMarker, job.job_id);
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

  for (const [jobId, platformioIni] of [
    ["incremental-1", "[env:test]\nplatform = espressif32\n"],
    ["incremental-2", "[env:test]\nplatform = espressif32\n"],
    ["incremental-3", "[env:test]\nplatform = espressif32@6.11.0\n"],
  ]) {
    await service.submitJob({
      job_id: jobId,
      project_id: "project-1",
      device_id: "device-1",
      mode: "build",
      build_package: { files: {
        "platformio.ini": platformioIni,
        "src/main.cpp": "void setup() {}\nvoid loop() {}\n",
      } },
    });
    await service.jobs.get(jobId).promise;
  }

  assert.deepEqual(observedCacheStates, ["missing", "incremental-1", "missing"]);
  assert.deepEqual(observedManagedComponentStates, ["missing", "incremental-1", "missing"]);
  assert.equal(observedWorkspaces[0], observedWorkspaces[1]);
  assert.equal(observedWorkspaces[1], observedWorkspaces[2]);
  assert.equal(sourceModifiedTimes[0], sourceModifiedTimes[1]);
  assert.equal(sourceModifiedTimes[1], sourceModifiedTimes[2]);
  assert.equal(
    await fs.readFile(path.join(config.incrementalCacheDir, "project-1--device-1--g0", "workspace", ".pio", "build", "cache-marker.txt"), "utf8"),
    "incremental-3",
  );
  assert.equal(await fs.readFile(path.join(observedWorkspaces[1], "src", "main.cpp"), "utf8"), "void setup() {}\nvoid loop() {}\n");
});

test("parallel software units use isolated PlatformIO incremental workspaces", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-software-unit-cache-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  });
  const service = createDefaultBuildDeployService(config);
  const workspaces = new Map();
  service.runner.run = async (job, packageDir) => {
    workspaces.set(job.software_unit_id, packageDir);
    const environmentDir = path.join(packageDir, ".pio", "build", job.software_unit_id);
    await fs.mkdir(environmentDir, { recursive: true });
    await fs.writeFile(path.join(environmentDir, "marker.txt"), job.job_id);
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

  for (const softwareUnitId of ["camera_sender", "display_receiver"]) {
    await service.submitJob({
      job_id: `parallel-${softwareUnitId}`,
      project_id: "distributed-project",
      software_unit_id: softwareUnitId,
      mode: "build",
      build_package: { files: {
        "platformio.ini": `[env:${softwareUnitId}]\n`,
        "src/main.cpp": "void setup() {}\nvoid loop() {}\n",
      } },
    });
  }
  await Promise.all(["camera_sender", "display_receiver"]
    .map((softwareUnitId) => service.jobs.get(`parallel-${softwareUnitId}`).promise));

  assert.equal(service.getJob("parallel-camera_sender").status, "succeeded");
  assert.equal(service.getJob("parallel-display_receiver").status, "succeeded");
  assert.notEqual(workspaces.get("camera_sender"), workspaces.get("display_receiver"));
  assert.equal(workspaces.get("camera_sender"), path.join(
    config.incrementalCacheDir,
    "distributed-project--camera_sender--default--g0",
    "workspace",
  ));
  assert.equal(workspaces.get("display_receiver"), path.join(
    config.incrementalCacheDir,
    "distributed-project--display_receiver--default--g0",
    "workspace",
  ));
});

test("concurrent builds of the same software target are executed exclusively", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-target-lock-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  let firstStarted;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  let active = 0;
  let maximumActive = 0;
  const buildDirs = new Map();
  service.runner.run = async (job, packageDir, options) => {
    buildDirs.set(job.job_id, options.buildDir);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    if (job.job_id === "exclusive-1") {
      firstStarted();
      await firstGate;
    }
    const artifacts = await createTestArtifacts(packageDir, job.job_id);
    active -= 1;
    return { status: "succeeded", artifacts };
  };

  await service.submitJob(buildTargetJob("exclusive-1", "shared-unit"));
  await started;
  await service.submitJob(buildTargetJob("exclusive-2", "shared-unit"));
  await waitFor(() => service.getJob("exclusive-2").progress.some((entry) => entry.phase === "waiting"));

  assert.equal(maximumActive, 1);
  assert.equal(service.getJob("exclusive-2").progress.at(-1).phase, "waiting");
  releaseFirst();
  await Promise.all([
    service.jobs.get("exclusive-1").promise,
    service.jobs.get("exclusive-2").promise,
  ]);
  assert.equal(maximumActive, 1);
  assert.equal(service.getJob("exclusive-1").status, "succeeded");
  assert.equal(service.getJob("exclusive-2").status, "succeeded");
  assert.notEqual(buildDirs.get("exclusive-1"), buildDirs.get("exclusive-2"));
  assert.match(buildDirs.get("exclusive-1"), /build-jobs/);
  assert.equal(await fs.access(buildDirs.get("exclusive-1")).then(() => true).catch(() => false), false);
  assert.equal(await fs.access(buildDirs.get("exclusive-2")).then(() => true).catch(() => false), false);
});

test("a BuildJob id can never address a second output directory", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-duplicate-job-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));

  await service.submitJob(buildTargetJob("unique-job", "camera"));
  await assert.rejects(
    service.submitJob(buildTargetJob("unique-job", "display")),
    (error) => error.code === "duplicate_job_id" && error.status === 409,
  );
  await service.jobs.get("unique-job").promise;
});

test("concurrent builds of different software targets remain parallel", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-target-parallel-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  let releaseBoth;
  const gate = new Promise((resolve) => { releaseBoth = resolve; });
  let active = 0;
  let maximumActive = 0;
  service.runner.run = async (job, packageDir) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    if (active === 2) releaseBoth();
    await gate;
    const artifacts = await createTestArtifacts(packageDir, job.job_id);
    active -= 1;
    return { status: "succeeded", artifacts };
  };

  await service.submitJob(buildTargetJob("parallel-target-1", "camera"));
  await service.submitJob(buildTargetJob("parallel-target-2", "display"));
  await Promise.all([
    service.jobs.get("parallel-target-1").promise,
    service.jobs.get("parallel-target-2").promise,
  ]);

  assert.equal(maximumActive, 2);
});

function buildTargetJob(jobId, softwareUnitId) {
  return {
    job_id: jobId,
    project_id: "shared-project",
    software_unit_id: softwareUnitId,
    mode: "build",
    build_package: { files: {
      "platformio.ini": `[env:${softwareUnitId}]\n`,
      "src/main.cpp": "void setup() {}\nvoid loop() {}\n",
    } },
  };
}

async function createTestArtifacts(packageDir, content) {
  const outputDir = path.join(packageDir, ".test-artifacts");
  await fs.mkdir(outputDir, { recursive: true });
  const artifacts = Object.fromEntries(["firmware.bin", "firmware.elf", "build.log"]
    .map((name) => [name, path.join(outputDir, name)]));
  await Promise.all(Object.values(artifacts).map((file) => fs.writeFile(file, content)));
  return artifacts;
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("Erwarteter asynchroner Zustand wurde nicht erreicht.");
}

test("build package target keeps legacy submissions in isolated incremental workspaces", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-package-target-cache-"));
  const config = createConfig({ BUILD_DEPLOY_RUNTIME_DIR: runtimeDir, BUILD_RUNNER: "mock", NODE_ENV: "test" });
  const service = createDefaultBuildDeployService(config);
  const workspaces = new Map();
  service.runner.run = async (job, packageDir) => {
    const target = JSON.parse(job.build_package.files["build-job.json"]).software_unit_id;
    workspaces.set(target, packageDir);
    const outputDir = path.join(packageDir, ".test-artifacts");
    await fs.mkdir(outputDir, { recursive: true });
    const artifacts = Object.fromEntries(["firmware.bin", "firmware.elf", "build.log"]
      .map((name) => [name, path.join(outputDir, name)]));
    await Promise.all(Object.values(artifacts).map((file) => fs.writeFile(file, "artifact")));
    return { status: "succeeded", artifacts };
  };

  for (const target of ["camera_sender", "display_receiver"]) {
    const jobId = `legacy-${target}`;
    await service.submitJob({
      job_id: jobId,
      project_id: "legacy-distributed-project",
      mode: "build",
      build_package: { files: {
        "build-job.json": JSON.stringify({ software_unit_id: target }),
        "platformio.ini": `[env:${target}]\n`,
      } },
    });
  }
  await Promise.all(["camera_sender", "display_receiver"]
    .map((target) => service.jobs.get(`legacy-${target}`).promise));

  assert.notEqual(workspaces.get("camera_sender"), workspaces.get("display_receiver"));
  assert.match(workspaces.get("camera_sender"), /legacy-distributed-project--camera_sender--default/);
  assert.match(workspaces.get("display_receiver"), /legacy-distributed-project--display_receiver--default/);
});

test("incremental builds preserve generated ESP-IDF components and remove only stale package files", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-managed-components-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  });
  const service = createDefaultBuildDeployService(config);
  const observedGeneratedComponent = [];
  service.runner.run = async (job, packageDir) => {
    const generatedHeader = path.join(packageDir, "managed_components", "espressif__mqtt", "include", "mqtt_client.h");
    const generatedSource = path.join(packageDir, "managed_components", "espressif__mqtt", "mqtt_client.c");
    observedGeneratedComponent.push(await fs.readFile(generatedHeader, "utf8").catch(() => "missing"));
    if (job.job_id === "managed-components-1") {
      await fs.mkdir(path.dirname(generatedHeader), { recursive: true });
      await fs.writeFile(generatedHeader, "generated mqtt header");
      await fs.writeFile(generatedSource, "generated mqtt source");
      await fs.writeFile(path.join(packageDir, "managed_components", "espressif__mqtt", "CMakeLists.txt"), "idf_component_register()");
      await fs.writeFile(path.join(packageDir, "dependencies.lock"), "dependencies:\n  espressif/mqtt: 1.0.0\n");
      const platformioState = path.join(packageDir, ".pio", "build", "esp32dev");
      await fs.mkdir(platformioState, { recursive: true });
      await fs.writeFile(path.join(platformioState, "build.ninja"), `build mqtt: cc ${generatedSource}\n`);
    }
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

  await service.submitJob({
    job_id: "managed-components-1",
    project_id: "project-managed",
    mode: "build",
    build_package: { files: {
      "platformio.ini": "[env:test]\n",
      "src/main.cpp": "void setup() {}\n",
      "src/removed.cpp": "void removed() {}\n",
    } },
  });
  await service.jobs.get("managed-components-1").promise;
  await service.submitJob({
    job_id: "managed-components-2",
    project_id: "project-managed",
    mode: "build",
    build_package: { files: {
      "platformio.ini": "[env:test]\n",
      "src/main.cpp": "void setup() {}\n",
    } },
  });
  await service.jobs.get("managed-components-2").promise;

  const workspace = path.join(config.incrementalCacheDir, "project-managed--default--g0", "workspace");
  assert.deepEqual(observedGeneratedComponent, ["missing", "generated mqtt header"]);
  assert.equal(await fs.readFile(path.join(workspace, "managed_components", "espressif__mqtt", "include", "mqtt_client.h"), "utf8"), "generated mqtt header");
  assert.equal(await fs.readFile(path.join(workspace, "managed_components", "espressif__mqtt", "mqtt_client.c"), "utf8"), "generated mqtt source");
  await assert.rejects(fs.access(path.join(workspace, "src", "removed.cpp")), /ENOENT/);
});

test("incremental build repairs a PlatformIO cache with partial managed components", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-corrupt-managed-components-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  });
  const service = createDefaultBuildDeployService(config);
  let runCount = 0;
  service.runner.run = async (_job, packageDir) => {
    runCount += 1;
    const platformioState = path.join(packageDir, ".pio", "build", "esp32dev");
    if (runCount === 1) {
      await fs.mkdir(platformioState, { recursive: true });
      const missingSource = path.join(packageDir, "managed_components", "espressif__mqtt", "mqtt_client.c");
      await fs.writeFile(path.join(platformioState, "build.ninja"), `build mqtt: cc ${missingSource}\n`);
      await fs.mkdir(path.join(packageDir, "managed_components", "espressif__mqtt", "include"), { recursive: true });
      await fs.writeFile(path.join(packageDir, "managed_components", "espressif__mqtt", "remaining.txt"), "partial component");
      await fs.writeFile(path.join(packageDir, "dependencies.lock"), "dependencies:\n  espressif/mqtt: 1.0.0\n");
    } else {
      assert.equal(await fs.readFile(path.join(platformioState, "build.ninja"), "utf8").catch(() => "missing"), "missing");
      assert.equal(await fs.readFile(path.join(packageDir, "managed_components", "espressif__mqtt", "remaining.txt"), "utf8").catch(() => "missing"), "missing");
      assert.equal(await fs.readFile(path.join(packageDir, "dependencies.lock"), "utf8").catch(() => "missing"), "missing");
    }
    const outputDir = path.join(packageDir, `.test-artifacts-${runCount}`);
    await fs.mkdir(outputDir, { recursive: true });
    const artifacts = {
      "firmware.bin": path.join(outputDir, "firmware.bin"),
      "firmware.elf": path.join(outputDir, "firmware.elf"),
      "build.log": path.join(outputDir, "build.log"),
    };
    await Promise.all(Object.values(artifacts).map((file) => fs.writeFile(file, "artifact")));
    return { status: "succeeded", artifacts };
  };

  for (const jobId of ["corrupt-cache-1", "corrupt-cache-2"]) {
    await service.submitJob({
      job_id: jobId,
      project_id: "project-corrupt",
      mode: "build",
      build_package: { files: { "platformio.ini": "[env:test]\n", "src/main.cpp": "void setup() {}\n" } },
    });
    await service.jobs.get(jobId).promise;
    assert.equal(service.getJob(jobId).status, "succeeded");
  }
});

test("project clean removes every target cache and preserves other projects", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-project-clean-"));
  const config = createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  });
  const service = createDefaultBuildDeployService(config);
  const cameraCache = path.join(config.incrementalCacheDir, "project-clean--camera_sender--default");
  const displayCache = path.join(config.incrementalCacheDir, "project-clean--display_receiver--default");
  const unrelatedCache = path.join(config.incrementalCacheDir, "other-project--camera_sender--default");
  await Promise.all([cameraCache, displayCache, unrelatedCache].map((cacheDir) => fs.mkdir(cacheDir, { recursive: true })));

  const result = await service.cleanProjectCache({ project_id: "project-clean" });

  assert.deepEqual(result, { project_id: "project-clean", removed_cache_count: 2, cache_generation: 0, status: "clean" });
  await assert.rejects(fs.access(cameraCache), /ENOENT/);
  await assert.rejects(fs.access(displayCache), /ENOENT/);
  await fs.access(unrelatedCache);
});

test("project clean is rejected while a project build is running", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-project-clean-running-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  service.runner.run = async () => new Promise(() => {});
  await service.submitJob({
    job_id: "active-project-build",
    project_id: "project-active",
    mode: "build",
    build_package: { files: { "platformio.ini": "[env:test]\nplatform = espressif32\n" } },
  });

  await assert.rejects(
    service.cleanProjectCache({ project_id: "project-active" }),
    (error) => error.code === "build_in_progress" && error.status === 409,
  );
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

test("waiting device jobs can be replaced and cancelled before compilation", async () => {
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
  assert.equal((await service.cancelJob("waiting-new")).status, "cancelled");
  assert.equal(service.deviceJobLock.takeWaiting("device-1"), null);
});

test("a queued job observes cancellation requested through another build server", async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-queued-cancel-"));
  const service = createDefaultBuildDeployService(createConfig({
    BUILD_DEPLOY_RUNTIME_DIR: runtimeDir,
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  const cancelled = new Set();
  service.cancellationPollMs = 5;
  service.buildCoordination = {
    workerId: "worker-a",
    async registerJob() {},
    async saveJob() {},
    async getProjectCacheEpoch() { return 0; },
    async isCancellationRequested(jobId) { return cancelled.has(jobId); },
  };
  service.runner.run = async () => new Promise(() => {});
  const buildPackage = { files: { "build-job.json": "{}" } };
  await service.submitJob({ job_id: "queued-cancel-active", mode: "build", device_id: "device-queued", build_package: buildPackage });
  await service.submitJob({ job_id: "queued-cancel-waiting", mode: "build", device_id: "device-queued", build_package: buildPackage });

  cancelled.add("queued-cancel-waiting");
  await waitUntil(() => service.getJob("queued-cancel-waiting").status === "cancelled");

  assert.equal(service.deviceJobLock.takeWaiting("device-queued"), null);
});

async function waitUntil(predicate, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("Zustand wurde nicht rechtzeitig erreicht.");
}
