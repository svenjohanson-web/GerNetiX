"use strict";

const { issueInternalToken } = require("../../../../shared/internal-api-auth");

function createBuildService({ readJsonBody, readUserActionContext, sessionService, loadUserIdeProjects, loadUserIdeDevices, platformSoftwareUnits, resolveBuildConfig, touchscreenGameBuildConfigurationProblems, projectServerJson, projectServerUserId, renderPlatformioIni, sendJson, otaBuildDeployJson, buildWorkerPoolJson, buildDeployJson, toBuildDeployPackage, toProjectBuildResult, completeBrowserFlashDefinitions, usesGerNetixOtaAppLayout, esp32FirmwareAddress, customerArtifactList, buildDeployBaseUrl, otaBuildDeployBaseUrl, internalApiSigningKey, userIdeState, touchWorkspace }) {
async function handleUserIdeBuildJob(req, res) {
  const body = await readJsonBody(req);
  const actionContext = readUserActionContext(req, "project.build.start");
  const actionHeaders = actionContext?.headers || {};
  const session = await sessionService.read(req);
  const projects = await loadUserIdeProjects(session);
  const devices = await loadUserIdeDevices(session);
  const project = projects.find((item) => item.slug === body.project_slug);
  let device = devices.find((item) => item.device_id === body.device_id || item.account_device_id === body.device_id) || null;
  const mode = body.mode || "build";
  const flashTransportRequested = body.flash_transport === "flashbox";
  const flashbox = flashTransportRequested
    ? devices.find((item) => item.device_id === body.flashbox_device_id || item.account_device_id === body.flashbox_device_id) || null
    : null;

  if (!project) {
    sendJson(res, 404, { error: "project_not_found", message: "Projekt wurde nicht gefunden." });
    return;
  }
  const softwareUnits = platformSoftwareUnits(project);
  const softwareUnitId = String(body.software_unit_id || project.active_software_unit_id || softwareUnits[0]?.software_unit_id || "").trim();
  const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === softwareUnitId) || null;
  if (softwareUnitId && !softwareUnit) {
    sendJson(res, 404, { error: "software_unit_not_found", message: "Die gewählte Softwareeinheit gehört nicht zu diesem Projekt." });
    return;
  }
  if (softwareUnit && softwareUnit.build_system !== "platformio") {
    sendJson(res, 409, { error: "software_unit_builder_not_supported", message: `Das Build-System ${softwareUnit.build_system} ist noch nicht an einen Build-Runner angebunden.` });
    return;
  }
  if (!device && softwareUnit?.device_id) {
    device = devices.find((item) => item.device_id === softwareUnit.device_id || item.account_device_id === softwareUnit.device_id) || null;
  }
  const resolvedBuildConfig = softwareUnit?.build_config || resolveBuildConfig(project, device || {});
  if (project.view_manifest?.template_id === "touchscreen_game_collection") {
    const problems = touchscreenGameBuildConfigurationProblems(project, resolvedBuildConfig);
    const sourcePayload = problems.length
      ? { items: [] }
      : await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, projectAccess(session, project));
    const sourceRoot = String(softwareUnit?.source_root || "").replace(/\/$/, "");
    const sourcePrefix = sourceRoot ? `${sourceRoot}/` : "";
    const sourcePaths = new Set((sourcePayload.items || []).map((source) => {
      const sourcePath = String(source.path || "");
      return sourcePrefix && sourcePath.startsWith(sourcePrefix) ? sourcePath.slice(sourcePrefix.length) : sourcePath;
    }));
    for (const requiredPath of ["src/user_main.cpp", "src/board_adapter.cpp", "src/game_application.cpp"]) {
      if (!sourcePaths.has(requiredPath)) problems.push(`Quelldatei ${requiredPath} fehlt`);
    }
    if (!problems.length) {
      const platformioIni = renderPlatformioIni(resolvedBuildConfig);
      if (!/^\s*\[env:es3c28p\]\s*$/m.test(platformioIni)) problems.push("platformio.ini enthaelt die Umgebung es3c28p nicht");
      if (!/^\s*framework\s*=\s*espidf\s*$/m.test(platformioIni)) problems.push("platformio.ini verwendet nicht ESP-IDF");
      if (!/^\s*board_build\.flash_size\s*=\s*16MB\s*$/mi.test(platformioIni)) problems.push("platformio.ini verwendet nicht 16 MB Flash");
      if (!/^\s*board_build\.partitions\s*=\s*partitions_full_16mb\.csv\s*$/mi.test(platformioIni)) problems.push("platformio.ini verwendet nicht das OTA-faehige Full-Partitionslayout");
      if (!/LovyanGFX/i.test(platformioIni)) problems.push("platformio.ini enthaelt LovyanGFX nicht");
      if (!/GERNETIX_BASISSOFTWARE_PROFILE_FULL=1/.test(platformioIni)) problems.push("platformio.ini aktiviert nicht das Full-Basisprofil");
    }
    if (problems.length) {
      sendJson(res, 409, {
        error: "touchscreen_game_build_configuration_invalid",
        message: `Build gesperrt: Die wirksame Konfiguration der Touchscreen-Spielesammlung ist widerspruechlich (${problems.join("; ")}). Erwartet werden ES3C28P, ESP-IDF, die vollstaendige GerNetiX-Basissoftware, Umgebung es3c28p, 16 MB Flash mit Full-A/B-Partitionen und die vollstaendigen Beispielquellen.`,
        problems,
      });
      return;
    }
  }
  if (!device && !["build", "build_and_usb_flash"].includes(mode)) {
    sendJson(res, 404, { error: "device_not_found", message: "Device wurde nicht gefunden." });
    return;
  }
  if (flashTransportRequested) {
    const hardwareProfile = String(flashbox?.hardware_profile_id || "").toLowerCase();
    const isFlashbox = flashbox?.hardware_class === "flashbox" || hardwareProfile.includes("hardware.flashbox.");
    if (!flashbox || !isFlashbox) {
      sendJson(res, 403, {
        error: "flashbox_not_in_inventory",
        message: "Die ausgewaehlte FlashBox gehoert nicht zum aktuellen Account-Inventar.",
      });
      return;
    }
    if (flashbox.device_id === device?.device_id) {
      sendJson(res, 409, {
        error: "flashbox_cannot_be_target",
        message: "Eine FlashBox kann nicht gleichzeitig der USB-Helper und das Zielgeraet sein.",
      });
      return;
    }
  }
  if (mode === "build_and_flash" && device.ota_status !== "ready") {
    sendJson(res, 409, { error: "device_not_ota_ready", message: "Das ausgewaehlte Device ist nicht OTA-ready." });
    return;
  }
  if (mode === "build_and_flash" && device.connectivity_status !== "online") {
    sendJson(res, 409, {
      error: "device_not_online",
      message: `Das ausgewaehlte Device ist nicht online (${device.connectivity_status || "unknown"}). OTA wurde nicht gestartet.`,
    });
    return;
  }
  if (mode === "build_and_flash") {
    const otaPreflight = await otaBuildDeployJson("/api/ota/preflight");
    if (!otaPreflight.ready) {
      const blockers = (otaPreflight.blockers || []).map((item) => item.message).filter(Boolean);
      sendJson(res, 409, {
        error: "ota_pipeline_not_ready",
        message: `OTA kann noch nicht gestartet werden: ${blockers.join(" ")}`,
        blockers: otaPreflight.blockers || [],
      });
      return;
    }
  }
  const projectServerJob = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`, {
    method: "POST",
    ...projectAccess(session, project, "project.write"),
    headers: actionHeaders,
    body: {
      mode,
      ...(actionContext ? { action_id: actionContext.actionId, action_type: actionContext.actionType } : {}),
      build_profile: body.build_profile || "standard",
      device_id: device?.device_id || null,
      software_unit_id: softwareUnit?.software_unit_id || "",
      build_config: resolvedBuildConfig,
    },
  });
  const buildPackage = await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/build-package`, { ...projectAccess(session, project), headers: actionHeaders });
  const buildDeployClient = mode === "build_and_flash"
    ? otaBuildDeployJson
    : (["build", "prebuild"].includes(mode) && !flashTransportRequested ? buildWorkerPoolJson : buildDeployJson);
  const buildDeployJob = await buildDeployClient("/api/build-jobs", {
    method: "POST",
    ...projectAccess(session, project, "build.job.request"),
    headers: actionHeaders,
    body: {
      job_id: projectServerJob.build_job_id,
      ...(actionContext ? { action_id: actionContext.actionId, action_type: actionContext.actionType } : {}),
      mode,
      build_profile: projectServerJob.build_profile || body.build_profile || "standard",
      project_id: project.project_server_id,
      software_unit_id: softwareUnit?.software_unit_id || "",
      device_id: device?.device_id || null,
      build_package: toBuildDeployPackage(buildPackage, device || {}, project),
      usb_flash: mode === "build_and_usb_flash" ? {
        upload_port: String(body.upload_port || device?.upload_port || "").trim(),
      } : null,
      deploy: mode === "build_and_flash" ? {
        requested: true,
        authorized: true,
        device_id: device.device_id,
      } : null,
      flashbox: flashTransportRequested ? {
        requested: true,
        flashbox_device_id: flashbox.device_id,
        flashbox_hardware_profile_id: flashbox.hardware_profile_id || "",
        target_device_id: device.device_id,
        target_hardware_profile_id: device.hardware_profile_id || "",
        manifest_type: "project_firmware_flash",
        transport: "flashbox_certificate_authenticated_mqtt_job",
      } : null,
    },
  });
  await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/submitted`, {
    method: "POST",
    ...projectAccess(session, project, "project.write"),
    headers: actionHeaders,
    body: {
      build_deploy_job_id: buildDeployJob.job_id,
    },
  });
  // Return the accepted job immediately so the browser can expose cancellation
  // while the worker compiles. Completion is synchronized by the status route.
  const completedBuildDeployJob = buildDeployJob;
  if (completedBuildDeployJob && ["succeeded", "failed", "cancelled"].includes(completedBuildDeployJob.status)) {
    await recordCompletedBuildJob(projectServerJob.build_job_id, completedBuildDeployJob, project, session);
  }

  const build = {
    build_job_id: projectServerJob.build_job_id,
    build_deploy_job_id: buildDeployJob.job_id,
    project_server_id: project.project_server_id,
    project_slug: project.slug,
    project_title: project.title,
    software_unit_id: softwareUnit?.software_unit_id || "",
    software_unit_title: softwareUnit?.title || "Firmware",
    device_id: device?.device_id || null,
    device_label: device?.display_name || "kein Device erforderlich",
    flashbox_device_id: flashbox?.device_id || null,
    flashbox_label: flashbox?.display_name || "",
    mode,
    status: completedBuildDeployJob ? completedBuildDeployJob.status : "submitted_to_build_deploy",
    created_at: projectServerJob.created_at,
    build_package_contract: `${buildPackage.files.length} Dateien: platformio.ini + Projektquellen`,
    artifact_url: completedBuildDeployJob?.result?.build?.primary_firmware?.download_url
      || completedBuildDeployJob?.result?.build?.artifacts?.["firmware.bin"]?.download_url
      || completedBuildDeployJob?.result?.build?.artifacts?.["firmware.hex"]?.download_url
      || "",
    build_id: completedBuildDeployJob?.result?.build?.build_id || "",
    artifacts: buildArtifactDownloads(projectServerJob.build_job_id, completedBuildDeployJob),
    flash_status: completedBuildDeployJob?.result?.build?.usb_flash?.status
      || completedBuildDeployJob?.result?.deploy?.status
      || "nicht angefordert",
    flash_manifest: browserFlashManifest(projectServerJob.build_job_id, completedBuildDeployJob, resolvedBuildConfig),
  };
  userIdeState.builds.unshift(build);
  touchWorkspace(session, project.project_server_id, body.mode === "learn" ? "learn" : "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 202, build);
}

async function recordCompletedBuildJob(jobId, completedJob, project, session) {
  if (!project?.project_server_id) throw new Error("A server-authorized project is required to record a build result.");
  return projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}/result`, {
    method: "POST",
    ...projectAccess(session, project, "project.write"),
    body: toProjectBuildResult(completedJob),
  });
}

function projectAccess(session, project, scope = "project.read") {
  const accountId = typeof projectServerUserId === "function"
    ? projectServerUserId(session)
    : String(project?.user_id || project?.owner_user_id || "");
  return {
    internalAuth: {
      scopes: [scope],
      delegation: { account_id: accountId, project_ids: [String(project.project_server_id)] },
    },
  };
}

function browserFlashManifest(jobId, completedJob, buildConfig = {}) {
  const artifacts = completedJob?.result?.build?.artifacts || {};
  const runnerManifest = Array.isArray(completedJob?.result?.build?.flash_manifest)
    ? completedJob.result.build.flash_manifest
    : [];
  const fallbackDefinitions = [
    ["bootloader.bin", esp32BootloaderAddress(buildConfig)],
    ["partitions.bin", 0x8000],
    ["boot_app0.bin", 0xe000],
    ["firmware.bin", esp32FirmwareAddress(buildConfig)],
  ];
  const definitions = completeBrowserFlashDefinitions(runnerManifest, fallbackDefinitions, {
    authoritativeFallbackNames: usesGerNetixOtaAppLayout(buildConfig) ? ["firmware.bin"] : [],
  });
  return definitions.filter(([name, address]) => artifacts[name] && Number.isInteger(address) && address >= 0).map(([name, address]) => ({
    name,
    address,
    url: `/api/user-ide/build-artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(name)}`,
    size_bytes: artifacts[name].size_bytes,
    sha256: artifacts[name].sha256,
  }));
}

function esp32BootloaderAddress(buildConfig = {}) {
  const target = [
    buildConfig.board,
    buildConfig.environment,
    buildConfig.board_configuration?.base_board_profile_id,
  ].filter(Boolean).join(" ").toLowerCase();
  return /esp32[-_]?s3|es3c28p/.test(target) ? 0x0000 : 0x1000;
}

function buildArtifactDownloads(jobId, completedJob) {
  const artifacts = completedJob?.result?.build?.artifacts || {};
  return customerArtifactList(jobId, artifacts);
}

async function proxyBuildArtifact(res, jobId, fileName, delegationContext) {
  const authHeaders = buildArtifactAuthHeaders(delegationContext);
  let upstream = await fetch(`${buildDeployBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`, { headers: authHeaders });
  if (upstream.status === 404 && otaBuildDeployBaseUrl !== buildDeployBaseUrl) {
    upstream = await fetch(`${otaBuildDeployBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`, { headers: authHeaders });
  }
  const content = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Content-Length": content.length,
    "Content-Disposition": `attachment; filename="${String(fileName).replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    "Cache-Control": "no-store",
  });
  res.end(content);
}

function buildArtifactAuthHeaders(context) {
  const scopes = ["artifact.download"];
  const common = { iss: "identity-server", sub: "identity-server", aud: "build-deploy-server", scopes };
  return {
    Authorization: `Bearer ${issueInternalToken(common, internalApiSigningKey)}`,
    "X-GerNetiX-Delegation": issueInternalToken({ ...common, kind: "delegated_user_action", context }, internalApiSigningKey),
  };
}


  return { handleUserIdeBuildJob, recordCompletedBuildJob, browserFlashManifest, proxyBuildArtifact };
}

module.exports = { createBuildService };
