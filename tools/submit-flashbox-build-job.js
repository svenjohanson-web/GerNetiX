#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const projectServerUrl = trimUrl(process.env.PROJECT_SERVER_BASE_URL || "http://project-server:4800");
const buildServerUrl = trimUrl(process.env.BUILD_DEPLOY_BASE_URL || "http://build-deploy-server:4400");
const projectId = "system-flashbox-build-verification";

async function main() {
  const project = await request("POST", `${projectServerUrl}/api/projects`, {
    project_id: projectId,
    user_id: "system-build-verification",
    plan_id: "premium",
    title: "GerNetiX Flashbox Build Verification",
    description: "Headless verification project for the containerized Flashbox build pipeline.",
    hardware_profile_id: "hardware.flashbox.esp32_s3_usb_helper",
    build_config: {
      platform: "espressif32",
      board: "esp32-s3-devkitc-1",
      framework: "arduino",
      environment: "esp32_s3_usb_helper_flashbox",
    },
    sources: flashboxBuildSources(root),
  });
  const buildJobId = `flashbox-build-${Date.now()}`;
  const buildJob = await request("POST", `${projectServerUrl}/api/projects/${encodeURIComponent(project.project_id)}/build-jobs`, {
    build_job_id: buildJobId,
    mode: "build",
  });
  const buildPackage = await request("GET", `${projectServerUrl}/api/build-jobs/${encodeURIComponent(buildJob.build_job_id)}/build-package`);
  const submitted = await request("POST", `${buildServerUrl}/api/build-jobs`, {
    job_id: buildJob.build_job_id,
    project_id: project.project_id,
    mode: "build",
    build_package: toBuildDeployPackage(buildPackage),
  });
  await request("POST", `${projectServerUrl}/api/build-jobs/${encodeURIComponent(buildJob.build_job_id)}/submitted`, {
    build_deploy_job_id: submitted.job_id,
  });
  const completed = await waitForCompletion(submitted.job_id);
  await request("POST", `${projectServerUrl}/api/build-jobs/${encodeURIComponent(buildJob.build_job_id)}/result`, toProjectBuildResult(completed));

  if (completed.status !== "succeeded") {
    throw new Error(completed.error?.message || "Flashbox PlatformIO build failed.");
  }
  console.log(JSON.stringify({
    status: "succeeded",
    project_id: project.project_id,
    build_job_id: buildJob.build_job_id,
    artifacts: completed.result.build.artifacts,
  }, null, 2));
}

function flashboxBuildSources(workspaceRoot) {
  const flashboxRoot = path.join(workspaceRoot, "firmware", "gernetix-flashbox");
  const runtimeCoreRoot = path.join(workspaceRoot, "firmware", "shared", "gernetix-runtime-core");
  const flashboxSources = readFiles(flashboxRoot).map((file) => ({
    path: file.relativePath,
    content: file.relativePath === "platformio.ini"
      ? rewriteFlashboxPlatformioIni(file.content)
      : file.content,
  }));
  const runtimeCoreSources = readFiles(runtimeCoreRoot).map((file) => ({
    path: `lib/gernetix-runtime-core/${file.relativePath}`,
    content: file.content,
  }));
  return [...flashboxSources, ...runtimeCoreSources];
}

function rewriteFlashboxPlatformioIni(content) {
  return content.replace(/^lib_extra_dirs\s*=\s*\.\.\/shared\s*$/m, "lib_extra_dirs = lib");
}

function readFiles(directory) {
  const files = [];
  walk(directory, directory, files);
  return files;
}

function walk(rootDir, currentDir, files) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== ".pio") walk(rootDir, fullPath, files);
      continue;
    }
    files.push({
      relativePath: path.relative(rootDir, fullPath).replace(/\\/g, "/"),
      content: fs.readFileSync(fullPath, "utf8"),
    });
  }
}

function toBuildDeployPackage(buildPackage) {
  return {
    package_id: buildPackage.package_id,
    files: Object.fromEntries((buildPackage.files || []).map((file) => [file.path, file.content])),
  };
}

function toProjectBuildResult(buildDeployJob) {
  const artifacts = buildDeployJob.result?.build?.artifacts || {};
  return {
    status: buildDeployJob.status,
    build: buildDeployJob.result?.build || null,
    deploy: buildDeployJob.result?.deploy || null,
    error: buildDeployJob.error || null,
    artifacts: Object.values(artifacts).map((artifact) => ({
      file_name: artifact.file_name,
      url: artifact.download_url,
      sha256: artifact.sha256,
      size_bytes: artifact.size_bytes,
      artifact_type: artifact.file_name === "build.log" ? "build_log" : "firmware",
    })),
  };
}

async function waitForCompletion(jobId) {
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    const job = await request("GET", `${buildServerUrl}/api/build-jobs/${encodeURIComponent(jobId)}`);
    if (["succeeded", "failed", "replaced"].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Flashbox build job timed out after twenty minutes.");
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${url}: ${payload.message || payload.error || response.status}`);
  return payload;
}

function trimUrl(value) {
  return String(value).replace(/\/+$/, "");
}

if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({ status: "failed", error: error.message }, null, 2));
  process.exitCode = 1;
});

module.exports = { flashboxBuildSources, rewriteFlashboxPlatformioIni, toBuildDeployPackage, toProjectBuildResult };
