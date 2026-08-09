"use strict";

function createBuildRuntimeUtils({ projectServerJson, otaBuildDeployJson, buildDeployJson, renderPlatformioIni }) {
  function latestBuildStatus(project) {
    return project && project.build_count > 0 ? `${project.build_count} BuildJob(s)` : "";
  }

  async function loadBuildDeployJob(jobId, options = {}) {
    const projectJob = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}`, options).catch(() => null);
    const client = projectJob?.mode === "build_and_flash" ? otaBuildDeployJson : buildDeployJson;
    return client(`/api/build-jobs/${encodeURIComponent(jobId)}`, options);
  }

  function toBuildDeployPackage(buildPackage, device = {}, project = {}) {
    const files = Object.fromEntries((buildPackage.files || []).map((file) => [file.path, file.content]));
    const buildConfig = resolveBuildConfig(project, device);
    if (buildConfig && !buildConfig.firmware_basis_id && !files["platformio.ini"]) {
      files["platformio.ini"] = renderPlatformioIni(buildConfig);
    }
    return { package_id: buildPackage.package_id, contract: buildPackage.contract, files };
  }

  function resolveBuildConfig(project = {}, device = {}) {
    if (project.view_manifest?.template_id === "touchscreen_game_collection") return project.build_config || null;
    if (project.slug === "arduino-atmel-bare-metal" && project.build_config) return project.build_config;
    if (project.build_config?.firmware_basis_id) {
      return {
        ...project.build_config,
        board: device.build_config?.board || project.build_config.board,
        environment: device.build_config?.environment || project.build_config.environment,
        firmware_basis_variant: project.build_config.firmware_basis_variant || "comfort",
      };
    }
    return device.build_config || project.build_config || null;
  }

  function touchscreenGameBuildConfigurationProblems(project = {}, buildConfig = {}) {
    const problems = [];
    const baseBoardProfileId = String(buildConfig?.board_configuration?.base_board_profile_id || project.hardware_profile_id || "");
    if (baseBoardProfileId !== "hardware.processor_board.esp32_s3_es3c28p") problems.push(`Board ${baseBoardProfileId || "nicht gesetzt"}`);
    if (buildConfig?.platform !== "espressif32") problems.push(`Plattform ${buildConfig?.platform || "nicht gesetzt"}`);
    if (buildConfig?.framework !== "espidf") problems.push(`Framework ${buildConfig?.framework || "nicht gesetzt"}`);
    if (buildConfig?.board !== "4d_systems_esp32s3_gen4_r8n16") problems.push(`Build-Board ${buildConfig?.board || "nicht gesetzt"}`);
    if (buildConfig?.environment !== "es3c28p") problems.push(`Umgebung ${buildConfig?.environment || "nicht gesetzt"}`);
    if (Number(buildConfig?.flash_size_mb) !== 16) problems.push(`Flash ${buildConfig?.flash_size_mb || "nicht gesetzt"} MB`);
    if (buildConfig?.firmware_basis_id !== "gernetix-runtime-basissoftware") problems.push(`Basissoftware ${buildConfig?.firmware_basis_id || "nicht gesetzt"}`);
    if (buildConfig?.firmware_basis_variant !== "full") problems.push(`Basisprofil ${buildConfig?.firmware_basis_variant || "nicht gesetzt"}`);
    if (buildConfig?.user_source_path !== "src/user_main.cpp") problems.push(`Einstieg ${buildConfig?.user_source_path || "nicht gesetzt"}`);
    if (buildConfig?.user_target_path !== "src/user/user_app.cpp") problems.push(`Basis-Einstieg ${buildConfig?.user_target_path || "nicht gesetzt"}`);
    return problems;
  }

  function toProjectBuildResult(buildDeployJob) {
    const artifacts = buildDeployJob.result?.build?.artifacts || {};
    return {
      status: buildDeployJob.status,
      build: buildDeployJob.result?.build || null,
      deploy: buildDeployJob.result?.deploy || null,
      flashbox: buildDeployJob.result?.flashbox || null,
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

  return {
    latestBuildStatus,
    loadBuildDeployJob,
    toBuildDeployPackage,
    resolveBuildConfig,
    touchscreenGameBuildConfigurationProblems,
    toProjectBuildResult,
  };
}

module.exports = { createBuildRuntimeUtils };
