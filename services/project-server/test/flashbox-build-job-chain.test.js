const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createHttpApp: createProjectHttpApp, InMemoryProjectRepository, ProjectService } = require("../src");
const { createConfig, createDefaultBuildDeployService, createHttpApp: createBuildHttpApp } = require("../../build-deploy-server/src");
const { flashboxBuildSources, toBuildDeployPackage } = require("../../../tools/submit-flashbox-build-job");

test("executes the headless Flashbox build-job chain from Project Server package to persisted build result", async (t) => {
  const projectService = new ProjectService({ repository: new InMemoryProjectRepository() });
  const buildService = createDefaultBuildDeployService(createConfig({
    BUILD_RUNNER: "mock",
    NODE_ENV: "test",
  }));
  const projectServer = await listen(createProjectHttpApp({ service: projectService }));
  const buildServer = await listen(createBuildHttpApp({ service: buildService, artifactDir: buildService.artifactStore.artifactDir }));
  t.after(async () => {
    await close(buildServer);
    await close(projectServer);
  });

  const project = await request("POST", `${projectServer.url}/api/projects`, {
    project_id: "flashbox-firmware",
    user_id: "firmware-release",
    title: "GerNetiX Flashbox Firmware",
    hardware_profile_id: "hardware.flashbox.esp32_s3_usb_helper",
    build_config: {
      platform: "espressif32",
      board: "esp32-s3-devkitc-1",
      framework: "arduino",
      environment: "esp32_s3_usb_helper_flashbox",
    },
    sources: flashboxBuildSources(path.join(__dirname, "..", "..", "..")),
  });

  const created = await request("POST", `${projectServer.url}/api/projects/${project.project_id}/build-jobs`, {
    build_job_id: "flashbox-build-chain",
    mode: "build",
  });
  assert.equal(created.status, "created");

  const buildPackage = await request("GET", `${projectServer.url}/api/build-jobs/${created.build_job_id}/build-package`);
  assert.ok(buildPackage.files.some((file) => file.path === "src/main.cpp"));
  assert.ok(buildPackage.files.some((file) => file.path === "include/gernetix_flashbox_config.h"));
  assert.ok(buildPackage.files.some((file) => file.path === "lib/gernetix-runtime-core/library.json"));
  assert.ok(buildPackage.files.some((file) => file.path === "platformio.ini"));
  assert.match(toBuildDeployPackage(buildPackage).files["platformio.ini"], /lib_extra_dirs = lib/);

  const accepted = await request("POST", `${buildServer.url}/api/build-jobs`, {
    job_id: created.build_job_id,
    project_id: project.project_id,
    mode: "build",
    build_package: toBuildDeployPackage(buildPackage),
  });
  assert.ok(["running", "succeeded"].includes(accepted.status));

  const completed = await waitForBuild(buildServer.url, created.build_job_id);
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.result.build.primary_firmware.file_name, "firmware.bin");

  const submitted = await request("POST", `${projectServer.url}/api/build-jobs/${created.build_job_id}/submitted`, {
    build_deploy_job_id: completed.job_id,
  });
  assert.equal(submitted.status, "submitted");

  const recorded = await request("POST", `${projectServer.url}/api/build-jobs/${created.build_job_id}/result`, buildResultForProject(completed));
  assert.equal(recorded.status, "succeeded");
  assert.equal(recorded.result.build.primary_firmware.file_name, "firmware.bin");

  const artifacts = await request("GET", `${projectServer.url}/api/firmware-artifacts?build_job_id=${created.build_job_id}`);
  assert.deepEqual(artifacts.items.map((artifact) => artifact.file_name).sort(), ["build.log", "firmware.bin", "firmware.elf", "firmware.hex", "firmware.map"]);
});

function buildResultForProject(completed) {
  const artifacts = Object.values(completed.result.build.artifacts).map((artifact) => ({
    artifact_type: artifact.file_name === "build.log" ? "build_log" : "firmware",
    file_name: artifact.file_name,
    url: artifact.download_url,
    sha256: artifact.sha256,
    size_bytes: artifact.size_bytes,
  }));
  return {
    status: completed.status,
    build: completed.result.build,
    deploy: completed.result.deploy,
    logs: [completed.result.build.build_log],
    artifacts,
  };
}

async function waitForBuild(baseUrl, jobId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = await request("GET", `${baseUrl}/api/build-jobs/${jobId}`);
    if (["succeeded", "failed"].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Build-Job wurde nicht rechtzeitig abgeschlossen.");
}

async function listen(app) {
  const server = http.createServer((request, response) => app(request, response).catch((error) => {
    response.writeHead(error.status || 500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error.code || "internal", message: error.message }));
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

function close(instance) {
  return new Promise((resolve, reject) => instance.server.close((error) => error ? reject(error) : resolve()));
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${url}: ${payload.message || payload.error}`);
  return payload;
}
