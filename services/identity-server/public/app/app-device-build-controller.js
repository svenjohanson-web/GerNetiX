// GerNetiX platform module extracted from app.js.
import { GerNetiXActionOps } from "@app/action-observability.js";
import { delay, deleteJson, escapeAttribute, escapeHtml, getJson, meta, postJson, projectById, putJson } from "@app/app-runtime-utils.js";
import { DASHBOARD_STALE_EVENT, SERIAL_SERVICE_CHOICE_EVENT, deviceOnboarding } from "@app/platform-components.js";
import { navigate } from "@app/platform-routing.js";
import { state } from "@app/platform-state.js";

const activeBuildJobIds = new Set();
let buildSubmissionPending = false;
let buildCancellationRequested = false;
const usbFirmwarePortAssignments = new Map();
let usbFlashAssignmentBatch = null;
let usbFlashPortDetector = null;
let usbFlashPortIdentification = null;
let ideFlashDialog = null;
let provisioningFlashDialog = null;

function renderLoadedIdeShell() {
  if (typeof renderIdeShell === "function") renderIdeShell();
}

function latestIdeFlashArtifact(project, softwareUnit) {
  const projectIds = new Set([project?.id, project?.slug, project?.project_server_id].filter(Boolean).map(String));
  const build = state.builds
    .filter((item) => item.status === "succeeded"
      && projectIds.has(String(item.project_server_id || item.project_id || item.project_slug || ""))
      && String(item.software_unit_id || "") === String(softwareUnit?.software_unit_id || ""))
    .sort((left, right) => Date.parse(right.finished_at || right.created_at || 0) - Date.parse(left.finished_at || left.created_at || 0))[0];
  const firmware = build?.artifacts?.find((artifact) => artifact.file_name === "firmware.bin")
    || build?.artifacts?.find((artifact) => /\.(?:bin|hex)$/i.test(artifact.file_name || ""));
  return firmware ? {
    name: firmware.file_name,
    version: build.version || build.build_job_id,
    sizeBytes: firmware.size_bytes,
    sha256: firmware.sha256,
  } : { name: `${softwareUnit?.title || "Projekt-Firmware"} · wird bei Bedarf gebaut` };
}

function openIdeFlashDialog() {
  const project = projectById(state.activeProjectId);
  if (!project) return setFlashStatus("error", "Bitte zuerst ein Projekt öffnen.");
  const softwareUnit = activeIdeSoftwareUnit(project);
  const device = allocatedIdeDevice(project);
  const flashboxes = inventoryFlashboxes();
  const flashable = usbFirmwareUnits(project).length > 0 || !projectSoftwareUnits(project).length;
  const otaReady = Boolean(device && device.connectivity_status === "online" && device.ota_status === "ready");
  ideFlashDialog ||= window.GerNetiXFlashDialog.create();
  ideFlashDialog.open({
    title: `${project.title || project.name || "Projekt"} flashen`,
    description: "Flash-Datei und Übertragungsweg werden hier verbindlich zusammengeführt. Status und Fehler erscheinen im Terminal.",
    artifact: latestIdeFlashArtifact(project, softwareUnit),
    methods: {
      usb: { enabled: flashable, reason: "Für dieses Projekt ist kein Firmware-Runner angeschlossen." },
      ota: { enabled: flashable && otaReady, reason: !device ? "Kein Device zugeordnet." : device.connectivity_status !== "online" ? `Device ist nicht online (${device.connectivity_status || "unknown"}).` : `Device ist nicht OTA-ready (${device.ota_status || "unknown"}).` },
      flashbox: { enabled: flashable && flashboxes.length > 0, reason: flashboxes.length ? "Für dieses Projekt ist kein Firmware-Runner angeschlossen." : "Keine FlashBox im Inventar verfügbar." },
    },
    async onExecute(method) {
      if (method === "usb") await startUsbFlash();
      if (method === "ota") await startOtaFlash();
      if (method === "flashbox") await startFlashBoxFlash();
    },
  });
}
function selectedBuildProfile(project = projectById(state.activeProjectId)) {
  return window.GerNetiXDeviceDebug?.buildProfile(project) || "standard";
}
function prepareFlashTarget(project, action, targetConfirmed = false) {
  const allUnits = projectSoftwareUnits(project);
  const flashableUnits = allUnits.filter((unit) => unit.build_system === "platformio");
  if (!allUnits.length) return true;
  if (!flashableUnits.length) {
    setFlashStatus("error", "Dieses Projekt besitzt keine Software-Einheit mit angeschlossenem Firmware-Runner.");
    return false;
  }
  if (flashableUnits.length === 1) {
    state.activeSoftwareUnitIds[project.id] = flashableUnits[0].software_unit_id;
    return true;
  }
  if (action === "usb") return true;
  if (targetConfirmed && flashableUnits.some((unit) => unit.software_unit_id === state.activeSoftwareUnitIds[project.id])) return true;
  state.pendingFlashAction = action;
  renderIdeSoftwareUnitSelection(project);
  const select = document.querySelector("#ideSoftwareUnitSelect");
  if (select?.value) state.activeSoftwareUnitIds[project.id] = select.value;
  const dialog = document.querySelector("#flashTargetChoiceDialog");
  if (dialog && !dialog.open) dialog.showModal();
  return false;
}

function confirmFlashTargetChoice() {
  const project = projectById(state.activeProjectId);
  const select = document.querySelector("#ideSoftwareUnitSelect");
  const action = state.pendingFlashAction;
  if (!project || !select?.value || !action) return;
  state.activeSoftwareUnitIds[project.id] = select.value;
  state.pendingFlashAction = "";
  document.querySelector("#flashTargetChoiceDialog")?.close();
  updateIdeProjectTools(project);
  if (action === "usb") startUsbFlash(true);
  if (action === "ota") startOtaFlash(true);
  if (action === "flashbox") startFlashBoxFlash(true);
}

function usbFirmwareUnits(project) {
  return projectSoftwareUnits(project).filter((unit) => unit.build_system === "platformio");
}

async function startBuild() {
  const action = window.GerNetiXActionOps?.begin("project.build.start", { timeoutMs: 900000 });
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project) {
    action?.fail("project_not_found");
    return setFlashStatus("error", buildActionFailureMessage(action, "Bitte zuerst ein Projekt öffnen."));
  }
  const softwareUnits = projectSoftwareUnits(project);
  const buildTargets = softwareUnits.length ? softwareUnits : [null];
  const unsupportedUnits = softwareUnits.filter((unit) => unit.build_system !== "platformio");
  if (unsupportedUnits.length) {
    const details = unsupportedUnits
      .map((unit) => `${unit.title || unit.software_unit_id} (${unit.build_system || "kein Buildsystem"})`)
      .join(", ");
    action?.fail("build_prerequisite_failed");
    return setFlashStatus("error", buildActionFailureMessage(action, `Gesamtbuild nicht gestartet. Für folgende Software-Einheiten fehlt ein Build-Runner: ${details}.`));
  }
  if (buildSubmissionPending || activeBuildJobIds.size > 0) {
    action?.fail("build_prerequisite_failed");
    return;
  }
  buildSubmissionPending = true;
  let actionStage = "source";
  updateBuildActionButton();
  setFlashStatus("running", `Gesamtbuild läuft: ${buildTargets.length} Software-Einheit${buildTargets.length === 1 ? "" : "en"}...`);
  try {
    await buildActionStep(action, "project.source.persist", () => persistCurrentSource(project, { action }), "source_persistence_failed");
    actionStage = "submit";
    const submitSpan = action?.startSpan("build.submit");
    const submissions = await Promise.allSettled(buildTargets.map((softwareUnit) => postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      software_unit_id: softwareUnit?.software_unit_id || "",
      device_id: device?.device_id || "",
      mode: "build",
      build_profile: selectedBuildProfile(project),
    }, { action })));
    const acceptedBuilds = submissions.flatMap((result, index) => result.status === "fulfilled"
      ? [{ build: result.value, softwareUnit: buildTargets[index] }]
      : []);
    const rejectedSubmissions = submissions.flatMap((result, index) => result.status === "rejected"
      ? [{ reason: result.reason, softwareUnit: buildTargets[index] }]
      : []);
    rejectedSubmissions.length ? submitSpan?.fail("build_submission_failed") : submitSpan?.succeed();
    const completionPromises = acceptedBuilds.map(({ build, softwareUnit }) => waitForCompletedBuild(build, {
      appendMemorySummary: false,
      suppressTerminalBuildResult: true,
      targetLabel: softwareUnit?.title || softwareUnit?.software_unit_id || "Firmware",
      action,
    }));
    buildSubmissionPending = false;
    updateBuildActionButton();
    actionStage = "wait";
    const waitSpan = action?.startSpan("build.wait");
    const completionResults = await Promise.allSettled(completionPromises);
    const completed = completionResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const rejectedCompletions = completionResults.filter((result) => result.status === "rejected");
    rejectedCompletions.length ? waitSpan?.fail("build_status_unavailable") : waitSpan?.succeed();
    state.builds.unshift(...completed);
    renderIdeProjectInformation(project);
    completed.filter((build) => !["succeeded", "cancelled"].includes(build.status)).forEach((build) => appendBuildFailureLog(build.build_log, build.error));
    completionResults.forEach((result, index) => {
      const label = acceptedBuilds[index].softwareUnit?.title || acceptedBuilds[index].softwareUnit?.software_unit_id || "Firmware";
      if (result.status === "rejected") {
        appendIdeTerminal("running", `Build-Ziel „${label}“: Status konnte vorläufig nicht abgerufen werden – ${result.reason?.message || "unbekannter Fehler"}. Der Build gilt dadurch nicht als fehlgeschlagen.`);
      } else if (result.value.status === "succeeded") {
        appendIdeTerminal("ok", `Build-Ziel „${label}“: erfolgreich.`);
      } else if (result.value.status === "cancelled") {
        appendIdeTerminal("running", `Build-Ziel „${label}“: abgebrochen.`);
      } else {
        appendIdeTerminal("error", `Build-Ziel „${label}“: fehlgeschlagen.`);
      }
    });
    rejectedSubmissions.forEach(({ reason, softwareUnit }) => {
      const label = softwareUnit?.title || softwareUnit?.software_unit_id || "Firmware";
      appendIdeTerminal("error", `Build-Ziel „${label}“: Auftrag konnte nicht angelegt werden – ${reason?.message || "unbekannter Fehler"}.`);
    });
    const succeeded = completed.filter((build) => build.status === "succeeded").length;
    const cancelled = completed.filter((build) => build.status === "cancelled").length;
    const unavailable = rejectedCompletions.length;
    const failed = completed.length - succeeded - cancelled + rejectedSubmissions.length;
    const verifySpan = action?.startSpan("build.verify");
    if (unavailable) verifySpan?.fail("build_status_unavailable");
    else if (cancelled) verifySpan?.fail("build_cancelled");
    else if (failed) verifySpan?.fail("build_execution_failed");
    else verifySpan?.succeed();
    if (!failed && !cancelled && !unavailable) completed.forEach(appendBuildMemorySummary);
    const summary = `${succeeded} von ${buildTargets.length} Software-Einheiten erfolgreich`;
    if (unavailable) setFlashStatus("running", `Gesamtbuild-Auswertung unterbrochen: ${unavailable} Statusabfrage${unavailable === 1 ? "" : "n"} nicht abgeschlossen. Diese Build-Ziele gelten nicht als fehlgeschlagen.`);
    else if (cancelled && !failed) setFlashStatus("running", `Gesamtbuild abgebrochen: ${cancelled} Software-Einheit${cancelled === 1 ? "" : "en"} abgebrochen.`);
    else setFlashStatus(
      failed ? "error" : "ok",
      failed ? buildActionFailureMessage(action, `Gesamtbuild fehlgeschlagen: ${summary}, ${failed} fehlgeschlagen${cancelled ? `, ${cancelled} abgebrochen` : ""}.`) : `Gesamtbuild erfolgreich: ${summary}.`,
    );
    if (unavailable) action?.fail("build_status_unavailable");
    else if (cancelled) action?.fail("build_cancelled");
    else if (failed) action?.fail(rejectedSubmissions.length ? "build_submission_failed" : "build_execution_failed");
    else action?.succeed();
    renderBuilds();
  } catch (error) {
    action?.fail(actionStage === "source"
      ? "source_persistence_failed"
      : actionStage === "wait" ? "build_status_unavailable" : buildFailureReason(error));
    setFlashStatus("error", buildActionFailureMessage(action, error.message));
  } finally {
    buildSubmissionPending = false;
    updateBuildActionButton();
  }
}

function buildActionFailureMessage(action, message) {
  return action?.failureMessage?.(message) || message;
}

function buildActionStep(action, spanType, operation, reasonCode) {
  return action ? action.step(spanType, operation, reasonCode) : operation();
}

function buildFailureReason(error) {
  if (error?.status === 404 || error?.code === "project_not_found") return "project_not_found";
  if (String(error?.code || "").includes("builder") || error?.status === 409) return "build_prerequisite_failed";
  return "build_submission_failed";
}

async function cleanProjectBuildCache() {
  const project = projectById(state.activeProjectId);
  if (!project) return setFlashStatus("error", "Bitte zuerst ein Projekt öffnen.");
  const button = document.querySelector("#cleanBuildButton");
  button.disabled = true;
  setFlashStatus("running", "Build-Cache des gesamten Projekts wird bereinigt...");
  try {
    const result = await postJson("/api/user-ide/build-cache/clean", { project_slug: project.slug });
    const count = Number(result.removed_cache_count || 0);
    appendIdeTerminal("ok", `Clean abgeschlossen: ${count} Build-Workspace${count === 1 ? "" : "s"} bereinigt.`);
    setFlashStatus("ok", "Clean erfolgreich. Der nächste Gesamtbuild wird vollständig neu aufgebaut.");
  } catch (error) {
    setFlashStatus("error", `Clean fehlgeschlagen: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function cancelActiveBuilds() {
  const jobIds = [...activeBuildJobIds];
  if (!jobIds.length || buildCancellationRequested) return;
  buildCancellationRequested = true;
  updateBuildActionButton();
  const results = await Promise.allSettled(jobIds.map((jobId) => postJson(
    `/api/user-ide/build-jobs/${encodeURIComponent(jobId)}/cancel`,
  )));
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    buildCancellationRequested = false;
    setFlashStatus("error", `Build-Abbruch konnte für ${rejected.length} Auftrag${rejected.length === 1 ? "" : "e"} nicht angefordert werden.`);
  } else {
    setFlashStatus("running", `Build-Abbruch angefordert: ${jobIds.length} laufende${jobIds.length === 1 ? "r Auftrag" : " Aufträge"}.`);
  }
  updateBuildActionButton();
}

function handleBuildButtonAction() {
  if (activeBuildJobIds.size > 0) {
    showCancelBuildConfirmation();
    return;
  }
  if (!buildSubmissionPending) startBuild();
}

function showCancelBuildConfirmation() {
  const count = activeBuildJobIds.size;
  if (!count || buildCancellationRequested) return;
  const dialog = document.querySelector("#cancelBuildConfirmDialog");
  const text = document.querySelector("#cancelBuildConfirmText");
  if (text) text.textContent = count === 1
    ? "Der laufende Build-Auftrag wird beendet. Bereits erzeugte Zwischenergebnisse werden nicht als fertiger Build übernommen."
    : `Alle ${count} laufenden Build-Aufträge werden beendet. Bereits erzeugte Zwischenergebnisse werden nicht als fertiger Gesamtbuild übernommen.`;
  if (dialog && !dialog.open) dialog.showModal();
}

async function confirmCancelActiveBuilds() {
  document.querySelector("#cancelBuildConfirmDialog")?.close();
  await cancelActiveBuilds();
}

function updateBuildActionButton() {
  const button = document.querySelector("#buildButton");
  if (!button) return;
  const activeCount = activeBuildJobIds.size;
  if (!activeCount) buildCancellationRequested = false;
  button.classList.toggle("build-cancel-active", activeCount > 0);
  if (activeCount > 0) {
    delete button.dataset.actionType;
    delete button.dataset.actionTimeout;
    button.disabled = buildCancellationRequested;
    button.textContent = buildCancellationRequested
      ? "Abbruch läuft…"
      : activeCount > 1 ? `Alle Builds abbrechen (${activeCount})` : "Build abbrechen";
    button.title = buildCancellationRequested
      ? "Der Abbruch der laufenden Build-Aufträge wurde angefordert."
      : "Öffnet die Bestätigung zum Abbrechen des laufenden Gesamtbuilds.";
  } else if (buildSubmissionPending) {
    delete button.dataset.actionType;
    delete button.dataset.actionTimeout;
    button.disabled = true;
    button.textContent = "Build startet…";
    button.title = "Die Build-Aufträge werden angelegt.";
  } else {
    button.dataset.actionType = "project.build.start";
    button.dataset.actionTimeout = "900000";
    button.disabled = false;
    button.textContent = "Build";
    button.title = button.dataset.idleTitle || "Baut alle Software-Einheiten des Projekts als gemeinsamen Gesamtbuild.";
  }
}

async function startUsbFlash(targetConfirmed = false, inventoryCheckConfirmed = false, usbMappingConfirmed = false) {
  const project = projectById(state.activeProjectId);
  if (!project) return setFlashStatus("error", "Bitte zuerst ein Projekt öffnen.");
  if (!prepareFlashTarget(project, "usb", targetConfirmed)) return;
  const firmwareUnits = usbFirmwareUnits(project);
  const serialServiceAvailable = await state.serialService.available();
  if (!serialServiceAvailable && !navigator.serial) {
    setFlashStatus("error", "Für USB wird Web Serial oder der GerNetiX WebHelper benötigt.");
    // Bitte an die Huelle, den Dialog zu zeigen -- statt sie von unten zu rufen.
    window.dispatchEvent(new CustomEvent(SERIAL_SERVICE_CHOICE_EVENT));
    return;
  }
  if (!serialServiceAvailable && firmwareUnits.length > 1 && !targetConfirmed) {
    state.pendingFlashAction = "usb";
    renderIdeSoftwareUnitSelection(project);
    const dialog = document.querySelector("#flashTargetChoiceDialog");
    if (dialog && !dialog.open) dialog.showModal();
    return;
  }
  let resolvedPort = "";
  if (serialServiceAvailable) {
    const confirmedUsbPort = usbMappingConfirmed ? selectedUsbPort() : "";
    await refreshUsbPorts(false);
    if (confirmedUsbPort && state.usbPorts.some((port) => port.port === confirmedUsbPort)) {
      const portSelect = document.querySelector("#usbPortSelect");
      if (portSelect) portSelect.value = confirmedUsbPort;
    }
    if (!state.usbPorts.length) {
      state.pendingUsbFlash = { mode: "start", projectId: project.id };
      showUsbPortMissingGuidance();
      return;
    }
    const usbSelectionMode = UsbFlashTargetModel.selectionMode(firmwareUnits.length, state.usbPorts.length);
    if (usbSelectionMode === "single-device-port-conflict") {
      showUsbPortChoiceDialog(project, "single-device-conflict");
      return;
    }
    if (usbSelectionMode === "firmware-port-mapping" && !usbMappingConfirmed) {
      showUsbPortChoiceDialog(project, "firmware-port-mapping");
      return;
    }
    if (usbSelectionMode === "firmware-port-mapping") {
      const selectedUnitId = document.querySelector("#usbFirmwareTargetSelect")?.value || "";
      if (!firmwareUnits.some((unit) => unit.software_unit_id === selectedUnitId)) {
        showUsbPortChoiceDialog(project, "firmware-port-mapping");
        return;
      }
      state.activeSoftwareUnitIds[project.id] = selectedUnitId;
      resolvedPort = selectedUsbPort();
      if (!resolvedPort || !state.usbPorts.some((port) => port.port === resolvedPort)) {
        showUsbPortChoiceDialog(project, "firmware-port-mapping");
        return;
      }
    } else {
      resolvedPort = state.usbPorts[0].port;
      const portSelect = document.querySelector("#usbPortSelect");
      if (portSelect) portSelect.value = resolvedPort;
    }
  }
  const softwareUnit = activeIdeSoftwareUnit(project);
  const device = allocatedIdeDevice(project);
  if (!inventoryCheckConfirmed && !usbInventoryWarningDismissed() && !inventoryDeviceForUsbFlash(device, resolvedPort)) {
    showUsbInventoryUnknownDialog(resolvedPort);
    return;
  }
  setFlashStatus("running", "Passender erfolgreicher Build wird geprüft...");
  let activeBuild = null;
  try {
    await persistCurrentSource(project);
    activeBuild = await reusableBuildForUsbFlash(project, softwareUnit);
    if (activeBuild) {
      appendIdeTerminal("ok", `Vorhandener Build für „${softwareUnit?.title || softwareUnit?.software_unit_id || "Firmware"}“ ist unverändert und wird direkt geflasht.`);
    } else {
      setFlashStatus("running", "Kein unveränderter vollständiger Build vorhanden. Inkrementeller PlatformIO-Build wird gestartet...");
      const build = await postJson("/api/user-ide/build-jobs", {
        project_slug: project.slug,
        software_unit_id: softwareUnit?.software_unit_id || "",
        device_id: device?.device_id || "",
        mode: "build_and_usb_flash",
        build_profile: selectedBuildProfile(project),
      });
      activeBuild = await waitForCompletedBuild(build);
      state.builds.unshift(activeBuild);
      renderIdeProjectInformation(project);
    }
    if (activeBuild.status !== "succeeded") {
      appendBuildFailureLog(activeBuild.build_log, activeBuild.error);
      throw new Error(activeBuild.error || "PlatformIO-Build ist fehlgeschlagen.");
    }
    setFlashStatus("running", serialServiceAvailable
      ? "Build erfolgreich. GerNetiX verbindet das USB-Gerät..."
      : "Build erfolgreich. USB-Gerät im Browser auswählen...");
    const flashResult = serialServiceAvailable
      ? await flashBuildViaSerialService(activeBuild, device)
      : await flashBuildViaWebSerial(activeBuild);
    await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(activeBuild.build_job_id)}/browser-usb-flash-result`, {
      status: "succeeded",
      chip_name: flashResult.chipName,
      logs: flashResult.logs,
    });
    activeBuild.flash_status = "succeeded";
    setUsbFlashSuccess(`USB-Flash erfolgreich: ${flashResult.chipName}`);
    renderBuilds();
    await finishUsbFlashAssignmentBatch(project.id, softwareUnit?.software_unit_id || "");
  } catch (error) {
    if (isUsbPortMissingError(error)) {
      state.pendingUsbFlash = activeBuild?.build_job_id
        ? { mode: "flash", projectId: project.id, build: activeBuild, deviceId: device?.device_id || "", port: resolvedPort, softwareUnitId: softwareUnit?.software_unit_id || "" }
        : { mode: "start", projectId: project.id };
      showUsbPortMissingGuidance();
      return;
    }
    if (activeBuild?.build_job_id) {
      await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(activeBuild.build_job_id)}/browser-usb-flash-result`, {
        status: "failed",
        error: error.message,
      }).catch(() => {});
    }
    usbFlashAssignmentBatch = null;
    setFlashStatus("error", error.message);
  }
}

async function reusableBuildForUsbFlash(project, softwareUnit) {
  const projectIds = new Set([project?.id, project?.slug, project?.project_server_id].filter(Boolean).map(String));
  const latestBuild = state.builds
    .filter((build) => build.status === "succeeded"
      && projectIds.has(String(build.project_server_id || build.project_id || build.project_slug || ""))
      && String(build.build_profile || "standard") === selectedBuildProfile(project)
      && String(build.software_unit_id || "") === String(softwareUnit?.software_unit_id || ""))
    .sort((left, right) => Date.parse(right.finished_at || right.created_at || 0) - Date.parse(left.finished_at || left.created_at || 0))[0] || null;
  if (!latestBuild?.build_job_id) return null;
  try {
    return await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(latestBuild.build_job_id)}/reuse-usb-flash`, {
      software_unit_id: softwareUnit?.software_unit_id || "",
      build_profile: selectedBuildProfile(project),
    });
  } catch (error) {
    if (error.status === 409) return null;
    throw error;
  }
}

async function flashBuildViaSerialService(build, device) {
  const manifest = Array.isArray(build.flash_manifest) ? build.flash_manifest : [];
  const required = ["bootloader.bin", "partitions.bin", "firmware.bin"];
  if (!required.every((name) => manifest.some((item) => item.name === name))) {
    throw new Error("Build enthält kein vollständiges ESP32-USB-Flashpaket.");
  }
  const files = await Promise.all(manifest.map(async (item) => {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`${item.name} konnte nicht geladen werden.`);
    return { name: item.name, data: new Uint8Array(await response.arrayBuffer()), address: Number(item.address) };
  }));
  const ports = await state.serialService.ports();
  state.usbPorts = ports.map((port) => ({ ...port, port: port.path, name: port.label }));
  renderUsbPortOptions();
  if (!ports.length) throw usbPortMissingError();
  const port = selectedUsbPort() || bestUsbPortForDevice(device)?.port || (ports.length === 1 ? ports[0].path : "");
  if (!port) throw new Error("Mehrere USB-Geräte sind verbunden. Wähle in GerNetiX den passenden USB-Port.");
  const probe = await state.serialService.probe(port);
  const seenLogs = new Set();
  const result = await state.serialService.flash({
    port,
    files,
    chip: "auto",
    flashMode: "dio",
    flashFreq: "40m",
    flashSize: "keep",
    onProgress(job) {
      GerNetiXFlashProgress.renderJob("#flashStatus", job, `${probe.chipName || "ESP32"}: Firmware wird geschrieben...`);
      for (const line of job.logs || []) {
        if (seenLogs.has(line)) continue;
        seenLogs.add(line);
        appendIdeTerminal("running", line);
      }
    },
  });
  return { chipName: probe.chipName || result.chipName || "ESP32", logs: result.logs || [] };
}

async function waitForCompletedBuild(build, options = {}) {
  let current = build;
  const seenProgress = new Set();
  let memorySummaryShown = false;
  let consecutiveStatusFailures = 0;
  const jobId = build.build_deploy_job_id || build.build_job_id;
  if (jobId) activeBuildJobIds.add(jobId);
  updateBuildActionButton();
  try {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      appendBuildProgress(current.progress, seenProgress, options);
      if (current.status === "succeeded" && jobId) {
        activeBuildJobIds.delete(jobId);
        updateBuildActionButton();
      }
      if (options.appendMemorySummary !== false && !memorySummaryShown && current.status === "succeeded") {
        appendBuildMemorySummary(current);
        memorySummaryShown = true;
      }
      const otaComplete = build.mode !== "build_and_flash"
        || ["rebooting", "confirmed", "delivered", "succeeded", "failed"].includes(current.flash_status);
      if (["failed", "replaced", "cancelled"].includes(current.status) || (current.status === "succeeded" && otaComplete)) return { ...build, ...current };
      if (attempt % 5 === 0) {
        const waitingForBoard = build.mode === "build_and_flash" && current.status === "succeeded";
        const message = current.status === "cancelling"
          ? "Build wird abgebrochen…"
          : waitingForBoard
            ? `Build fertig. OTA-Auftrag ist ${current.flash_status || "veröffentlicht"}; warte auf das Board... ${attempt}s`
            : `PlatformIO-Build läuft... ${attempt}s`;
        setFlashStatus("running", message);
      }
      await delay(1000);
      try {
        current = await getJson(`/api/user-ide/build-jobs/${encodeURIComponent(jobId)}/status`, { action: options.action });
        if (consecutiveStatusFailures > 0) {
          appendIdeTerminal("running", `Verbindung zur Build-Auswertung für „${options.targetLabel || "Firmware"}“ wiederhergestellt.`);
        }
        consecutiveStatusFailures = 0;
      } catch (error) {
        if (!isTransientBuildStatusError(error)) throw error;
        consecutiveStatusFailures += 1;
        if (consecutiveStatusFailures === 1) {
          appendIdeTerminal("running", `Verbindung zur Build-Auswertung für „${options.targetLabel || "Firmware"}“ unterbrochen. Der Build-Auftrag läuft serverseitig weiter; GerNetiX verbindet sich automatisch erneut.`);
        }
        if (consecutiveStatusFailures >= 60) {
          throw new Error("Die Build-Auswertung war länger als eine Minute nicht erreichbar. Der Build-Auftrag kann serverseitig weiterhin laufen.");
        }
      }
    }
    throw new Error("PlatformIO-Build hat das Zeitlimit überschritten.");
  } finally {
    if (jobId) activeBuildJobIds.delete(jobId);
    updateBuildActionButton();
  }
}

function isTransientBuildStatusError(error) {
  return error?.name === "TypeError" || [502, 503, 504].includes(Number(error?.status));
}

function appendBuildMemorySummary(build) {
  const output = [
    ...(Array.isArray(build?.progress) ? build.progress.map((entry) => entry?.message || "") : []),
    build?.build_log || "",
  ].join("\n");
  const flash = parsePlatformioMemoryUsage(output, "Flash");
  const ram = parsePlatformioMemoryUsage(output, "RAM");
  appendIdeTerminal("summary", `Speicherbelegung · Firmware-Partition (Flash): ${formatPlatformioMemoryUsage(flash)} · RAM: ${formatPlatformioMemoryUsage(ram)} · Flash-Wert = App-Slot, nicht gesamter Gerätespeicher`);
}

function parsePlatformioMemoryUsage(output, label) {
  const pattern = new RegExp(`^\\s*${label}:.*?(\\d+(?:[.,]\\d+)?)%\\s*\\(used\\s+(\\d+)\\s+bytes\\s+from\\s+(\\d+)\\s+bytes\\)`, "gim");
  let usage = null;
  for (const match of String(output || "").matchAll(pattern)) {
    usage = {
      percent: Number(match[1].replace(",", ".")),
      usedBytes: Number(match[2]),
      totalBytes: Number(match[3]),
    };
  }
  return usage;
}

function formatPlatformioMemoryUsage(usage) {
  if (!usage) return "nicht ermittelt";
  const percent = usage.percent.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return `${percent} % (${formatMemoryBytes(usage.usedBytes)} / ${formatMemoryBytes(usage.totalBytes)})`;
}

function formatMemoryBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 2 })} MB`;
  if (value >= 1024) return `${(value / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB`;
  return `${value.toLocaleString("de-DE")} B`;
}

function appendBuildProgress(progress, seenProgress, options = {}) {
  for (const entry of Array.isArray(progress) ? progress : []) {
    const key = String(entry?.sequence || `${entry?.at || ""}:${entry?.message || ""}`);
    if (seenProgress.has(key)) continue;
    seenProgress.add(key);
    const message = String(entry?.message || "");
    if (options.suppressTerminalBuildResult && /^(?:Build erfolgreich abgeschlossen\.?|PlatformIO-Build fehlgeschlagen\.?)$/i.test(message.trim())) continue;
    const kind = entry?.phase === "failed" ? "error" : "running";
    appendIdeTerminal(kind, message);
  }
}

function appendBuildFailureLog(buildLog, fallbackMessage = "") {
  const lines = String(buildLog || "").split(/\r?\n/).filter(Boolean);
  const relevant = lines.filter((line) => /fatal error:|error:|undefined reference|multiple definition|cannot find|region [`'"].*overflowed|\*\*\*|\[FAILED\]/i.test(line));
  const diagnosticLines = (relevant.length ? relevant : lines.slice(-6)).slice(-8);
  if (diagnosticLines.length > 0) {
    diagnosticLines.forEach((line) => appendIdeTerminal("error", line));
    return;
  }
  if (String(fallbackMessage || "").trim()) {
    appendIdeTerminal("error", `Fehlerursache: ${String(fallbackMessage).trim()}`);
    return;
  }
  appendIdeTerminal("error", "Der Build-Server hat keine technische Fehlerdiagnose geliefert.");
}

async function flashBuildViaWebSerial(build) {
  const manifest = Array.isArray(build.flash_manifest) ? build.flash_manifest : [];
  const required = ["bootloader.bin", "partitions.bin", "firmware.bin"];
  if (!required.every((name) => manifest.some((item) => item.name === name))) {
    throw new Error("Build enthält kein vollständiges ESP32-Web-Serial-Flashpaket.");
  }
  const fileArray = await Promise.all(manifest.map(async (item) => {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`${item.name} konnte nicht geladen werden.`);
    return { data: new Uint8Array(await response.arrayBuffer()), address: Number(item.address) };
  }));
  const totalBytes = fileArray.reduce((sum, file) => sum + file.data.byteLength, 0);
  const precedingBytes = fileArray.map((_, index) => fileArray.slice(0, index).reduce((sum, file) => sum + file.data.byteLength, 0));
  const port = await navigator.serial.requestPort();
  const { ESPLoader, Transport } = await loadIdeEsptoolModule();
  const transport = new Transport(port, false);
  state.activeSerialTransport = transport;
  const logs = [];
  const log = (value) => {
    const line = String(value || "").trim();
    if (!line) return;
    logs.push(line);
    appendIdeTerminal("running", line);
  };
  try {
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal: { clean() {}, writeLine: log, write: log },
      debugLogging: false,
    });
    const chipName = await loader.main();
    await loader.writeFlash({
      fileArray,
      flashMode: "dio",
      flashFreq: "40m",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (index, written, total) => {
        const percent = Math.min(100, Math.round(((precedingBytes[index] || 0) + Math.min(written, total)) / Math.max(totalBytes, 1) * 100));
        GerNetiXFlashProgress.render("#flashStatus", "running", `${chipName || "ESP32"}: Firmware wird geschrieben`, percent);
        if (percent % 10 === 0) log(`Firmware schreiben: ${percent}%`);
      },
    });
    await loader.after("hard_reset");
    await transport.disconnect();
    state.activeSerialTransport = null;
    return { chipName, logs };
  } catch (error) {
    try { await transport.disconnect(); } catch {}
    state.activeSerialTransport = null;
    throw error;
  }
}

async function loadIdeEsptoolModule() {
  if (!state.esptoolModule) state.esptoolModule = await import("/vendor/esptool-js/bundle.js");
  return state.esptoolModule;
}

async function startOtaFlash(targetConfirmed = false) {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project || !device) return setFlashStatus("error", "Bitte zuerst der IoT-Device-Komponente ein Inventar-Device zuordnen.");
  if (!prepareFlashTarget(project, "ota", targetConfirmed)) return;
  const softwareUnit = activeIdeSoftwareUnit(project);
  if (device.connectivity_status !== "online") return setFlashStatus("error", `Das zugeordnete Device ist nicht online (${device.connectivity_status || "unknown"}).`);
  if (device.ota_status !== "ready") return setFlashStatus("error", "Das zugeordnete Device ist nicht OTA-ready.");
  setFlashStatus("running", "Build und OTA-Flash laufen...");
  try {
    await persistCurrentSource(project);
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      software_unit_id: softwareUnit?.software_unit_id || "",
      device_id: device.device_id,
      mode: "build_and_flash",
      build_profile: selectedBuildProfile(project),
    });
    const completed = await waitForCompletedBuild(build);
    state.builds.unshift(completed);
    renderIdeProjectInformation(project);
    if (completed.status !== "succeeded") {
      appendBuildFailureLog(completed.build_log, completed.error);
      throw new Error(completed.error || "Build für das OTA-Update ist fehlgeschlagen.");
    }
    if (["rebooting", "confirmed", "delivered", "succeeded"].includes(completed.flash_status)) {
      setFlashStatus("ok", `OTA-Auftrag erfolgreich übergeben: ${completed.flash_status}`);
    } else {
      setFlashStatus("error", `Firmware gebaut, OTA-Übertragung nicht bestätigt: ${completed.flash_status || "unbekannter Status"}`);
    }
    renderBuilds();
  } catch (error) {
    setFlashStatus("error", error.message);
  }
}

function inventoryFlashboxes() {
  return state.devices.filter((device) => {
    const profile = String(device.hardware_profile_id || "").toLowerCase();
    return device.hardware_class === "flashbox" || profile.includes("hardware.flashbox.");
  });
}

async function startFlashBoxFlash(targetConfirmed = false) {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project || !device) return setFlashStatus("error", "Bitte zuerst der IoT-Device-Komponente ein Inventar-Device zuordnen.");
  if (!prepareFlashTarget(project, "flashbox", targetConfirmed)) return;
  const softwareUnit = activeIdeSoftwareUnit(project);
  const flashboxes = inventoryFlashboxes();
  if (!flashboxes.length) {
    return setFlashStatus("error", "Keine GerNetiX FlashBox im Inventar. Kaufe oder uebernimm zuerst eine FlashBox im Webshop/Inventar.");
  }
  const flashbox = flashboxes.find((item) => item.device_id === state.activeFlashboxDeviceId) || null;
  if (!flashbox) {
    return setFlashStatus("error", "Waehle zuerst eine verfuegbare FlashBox aus deinem Inventar.");
  }
  setFlashStatus("running", `Build fuer FlashBox-Flash wird vorbereitet (${flashbox.display_name || flashbox.device_id}).`);
  try {
    await persistCurrentSource(project);
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      software_unit_id: softwareUnit?.software_unit_id || "",
      device_id: device.device_id,
      mode: "build",
      build_profile: selectedBuildProfile(project),
      flash_transport: "flashbox",
      flashbox_device_id: flashbox.device_id,
    });
    const completed = await waitForCompletedBuild(build);
    state.builds.unshift(completed);
    renderIdeProjectInformation(project);
    if (completed.status !== "succeeded") {
      appendBuildFailureLog(completed.build_log, completed.error);
      throw new Error(completed.error || "Build fuer FlashBox-Flash ist fehlgeschlagen.");
    }
    const delivery = completed.result?.flashbox || completed.flashbox || {};
    const deliveryStatus = completed.flash_status || delivery.status || "veröffentlicht";
    setFlashStatus("ok", `Build fertig. FlashBox-Auftrag an ${flashbox.display_name || flashbox.device_id}: ${deliveryStatus}.`);
    renderBuilds();
  } catch (error) {
    setFlashStatus("error", error.message);
  }
}

async function checkAllocatedDeviceConnectivity() {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project || !device) return setFlashStatus("error", "Bitte zuerst der IoT-Device-Komponente ein Inventar-Device zuordnen.");
  const button = document.querySelector("#checkOtaConnectivityButton");
  button.disabled = true;
  setFlashStatus("running", `Erreichbarkeit von ${device.display_name || device.device_id} wird geprüft...`);
  try {
    const result = await postJson(`/api/user-ide/devices/${encodeURIComponent(device.device_id)}/connectivity-check`, {});
    if (!result.reachable) {
      setFlashStatus("error", result.message || "Das Board wurde im lokalen Netzwerk nicht gefunden.");
      return;
    }
    Object.assign(device, result.device || {}, { connectivity_status: "online" });
    updateIdeProjectTools(project);
    renderIdeDeviceAllocation(project);
    setFlashStatus("ok", `Board online: ${result.hostname || device.display_name || device.device_id}`);
  } catch (error) {
    setFlashStatus("error", `Online-Prüfung fehlgeschlagen: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function refreshRecoveryDevices() {
  setRecoveryStatus("running", "Devices werden aktualisiert...");
  try {
    const response = await getJson("/api/user-ide/devices");
    state.devices = response.items || [];
    if (!state.devices.some((device) => device.device_id === state.activeRecoveryDeviceId)) {
      state.activeRecoveryDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
    }
    state.recoveryCheckResult = null;
    renderLoadedIdeShell();
    renderDeviceRecovery();
    setRecoveryStatus("ok", state.devices.length ? `${state.devices.length} Device(s) geladen.` : "Keine Devices fuer diesen Account gefunden.");
  } catch (error) {
    setRecoveryStatus("error", error.message);
  }
}

async function checkRecoveryFirmware(mode) {
  const device = selectedRecoveryDevice();
  if (!device) {
    setRecoveryStatus("error", "Bitte zuerst ein Device waehlen.");
    return;
  }
  setRecoveryStatus("running", `Firmwarecheck ueber ${mode.toUpperCase()} laeuft...`);
  try {
    const result = await postJson("/api/user-ide/device-recovery/check-firmware", {
      device_id: device.device_id,
      mode,
      upload_port: mode === "usb" ? selectedRecoveryUsbPort(device) : "",
    });
    state.recoveryCheckResult = result;
    renderDeviceRecovery();
    setRecoveryStatus(result.status === "ready" ? "ok" : "error", result.summary);
  } catch (error) {
    setRecoveryStatus("error", error.message);
  }
}

function renderDeviceRecovery() {
  const select = document.querySelector("#recoveryDeviceSelect");
  if (!select) return;
  if (!state.activeRecoveryDeviceId && state.devices.length) {
    state.activeRecoveryDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0].device_id;
  }
  select.innerHTML = state.devices.length
    ? state.devices.map((device) => `<option value="${escapeHtml(device.device_id)}">${escapeHtml(device.display_name)} - ${escapeHtml(device.build_target_label || device.hardware_profile_id || "Device")}</option>`).join("")
    : `<option value="">Keine Devices</option>`;
  select.value = state.activeRecoveryDeviceId || "";
  const device = selectedRecoveryDevice();
  document.querySelector("#recoveryDeviceTitle").textContent = device ? device.display_name : "Kein Device gewaehlt";
  document.querySelector("#recoveryDeviceMeta").innerHTML = device ? [
    ["Device ID", device.device_id],
    ["Hardware", device.hardware_profile_id],
    ["Boardprofil", device.build_target_label || "kein Boardprofil"],
    ["Connectivity", device.connectivity_status || "unknown"],
    ["OTA", device.ota_status || "unknown"],
    ["USB", device.usb_flash_supported ? usbFlashLabel(device) : "nicht konfiguriert"],
  ].map(([key, value]) => meta(key, value)).join("") : "";
  document.querySelector("#recoveryDeviceList").innerHTML = state.devices.length ? state.devices.map((item) => `
    <button class="recovery-device-card ${item.device_id === state.activeRecoveryDeviceId ? "active-method" : ""}" type="button" data-recovery-device="${escapeHtml(item.device_id)}">
      <strong>${escapeHtml(item.display_name)}</strong>
      <span>${escapeHtml(item.build_target_label || item.hardware_profile_id || "Device")}</span>
      <small>${escapeHtml(item.connectivity_status || "unknown")} · OTA ${escapeHtml(item.ota_status || "unknown")}</small>
    </button>
  `).join("") : `<p class="empty">Keine Devices fuer diesen Account gefunden.</p>`;
  document.querySelectorAll("[data-recovery-device]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeRecoveryDeviceId = button.dataset.recoveryDevice;
      state.recoveryCheckResult = null;
      renderDeviceRecovery();
    });
  });
  const usbButton = document.querySelector("#recoveryCheckUsbButton");
  const otaButton = document.querySelector("#recoveryCheckOtaButton");
  usbButton.disabled = !device;
  otaButton.disabled = !device;
  renderRecoveryCheckResult();
}

function renderRecoveryCheckResult() {
  const target = document.querySelector("#recoveryCheckResult");
  if (!target) return;
  const result = state.recoveryCheckResult;
  if (!result) {
    target.innerHTML = `<p class="empty">Noch kein Firmwarecheck ausgefuehrt.</p>`;
    return;
  }
  target.innerHTML = `
    <article class="recovery-result ${result.status === "ready" ? "ok" : "blocked"}">
      <div>
        <p class="eyebrow">${escapeHtml(result.mode.toUpperCase())}</p>
        <h3>${escapeHtml(result.summary)}</h3>
        <p>${escapeHtml(result.next_action || "")}</p>
      </div>
      <dl class="meta-list compact">
        ${result.checks.map((check) => meta(check.check_id, `${check.status}: ${check.message}`)).join("")}
      </dl>
    </article>
  `;
}

function selectedRecoveryDevice() {
  return state.devices.find((device) => device.device_id === state.activeRecoveryDeviceId) || state.devices[0] || null;
}

function selectedRecoveryUsbPort(device) {
  return selectedUsbPort() || bestUsbPortForDevice(device)?.port || device?.upload_port || "";
}

function setRecoveryStatus(kind, text) {
  const status = document.querySelector("#recoveryStatus");
  if (!status) return;
  status.className = `flash-status ${kind}`;
  status.textContent = text;
  status.classList.toggle("hidden", !text);
}

function continueLastProject() {
  if (!state.workspace.lastProjectId) {
    navigate("/app/development-platform/");
    return;
  }
  const lastRoute = state.workspace.lastRoute || `/app/${state.workspace.lastMode}/?project=${encodeURIComponent(state.workspace.lastProjectId)}`;
  if (/^\/app\/(?:learn|projects)\//.test(lastRoute)) {
    navigate(`/app/learn/?project=${encodeURIComponent(state.workspace.lastProjectId)}`);
    return;
  }
  navigate(lastRoute);
}

async function discoverNetworkDevices() {
  return deviceOnboarding().discoverNetworkDevices();
}

async function identifyEsp32Bootloader() {
  return deviceOnboarding().identifyEsp32Bootloader();
}

async function scanProvisioningSerialPorts() {
  return deviceOnboarding().scanProvisioningSerialPorts();
}

async function selectProvisioningSerialPort() {
  return deviceOnboarding().selectProvisioningSerialPort();
}

async function flashProvisioningBasissoftware(options) {
  return deviceOnboarding().flashProvisioningBasissoftware(options);
}

function openProvisioningFlashDialog() {
  const availability = state.provisioningFirmwareAvailability || {};
  const artifact = availability.artifact || {};
  const usbReasons = deviceOnboarding().provisioningUsbFlashDisabledReasons();
  const usbReady = usbReasons.length === 0;
  const reason = usbReady ? "" : `Noch erforderlich: ${usbReasons.join(" · ")}`;
  provisioningFlashDialog ||= window.GerNetiXFlashDialog.create();
  provisioningFlashDialog.open({
    title: "Basissoftware flashen",
    description: "Provisioning verwendet denselben Flash-Auftrag wie IDE und Nachbauprojekte.",
    artifact: { name: artifact.filename || "merged-firmware.bin", version: artifact.version, sizeBytes: artifact.size_bytes, sha256: artifact.sha256,
      sourcePath: artifact.source_path, sourceVersion: artifact.source_version },
    methods: {
      usb: { enabled: usbReady, reason },
      ota: { enabled: false, reason: "Die Erstinstallation ist noch nicht OTA-fähig." },
      flashbox: { enabled: false, reason: "Für diesen Provisioning-Vorgang ist keine FlashBox ausgewählt." },
    },
    async onExecute(_method, terminal) {
      await flashProvisioningBasissoftware({ terminal });
      terminal.write("ok", "Der gemeinsame Flash-Auftrag ist abgeschlossen. Provisioning bereitet jetzt WLAN und Account-Zuordnung vor.");
    },
  });
}

async function scanProvisioningWifiNetworks() {
  return deviceOnboarding().scanProvisioningWifiNetworks();
}

async function connectProvisioningWifi() {
  return deviceOnboarding().connectProvisioningWifi();
}

function selectDeviceDiscoveryMethod() {
  return deviceOnboarding().selectDeviceDiscoveryMethod();
}

async function searchDevicesForInventory() {
  return deviceOnboarding().searchDevicesForInventory();
}

async function identifyAvrBootloaderExperimental() {
  return deviceOnboarding().identifyAvrBootloaderExperimental();
}

function renderNetworkDiscovery() {
  return deviceOnboarding().renderNetworkDiscovery();
}

async function claimDiscoveredDevice(discoveryId) {
  return deviceOnboarding().claimDiscoveredDevice(discoveryId);
}

async function claimSelectedDiscoveredDevices() {
  return deviceOnboarding().claimSelectedDiscoveredDevices();
}

function setDiscoveryStatus(kind, text) {
  return deviceOnboarding().setDiscoveryStatus(kind, text);
}

function renderDevices() {
  const count = document.querySelector("#inventoryDeviceCount");
  count.textContent = `${state.devices.length} ${state.devices.length === 1 ? "Geraet" : "Geraete"}`;
  document.querySelector("#deviceList").innerHTML = state.devices.length ? state.devices.map((device) => `
    <article class="device-row">
      <div class="device-card-main">
        <div class="device-card-title">
          <div>
            <h3>${escapeHtml(device.display_name)}</h3>
            <p>${escapeHtml(device.build_target_label || "ESP32-Board")}</p>
          </div>
          <span class="device-status-pill ${deviceStatusClass(device.connectivity_status)}">${escapeHtml(deviceConnectivityLabel(device.connectivity_status))}</span>
        </div>
        <dl class="device-facts">
          <div><dt>Gerätestatus</dt><dd>${escapeHtml(deviceAuthenticityLabel(device.authenticity_status))}</dd></div>
          <div><dt>Firmware-Update</dt><dd>${escapeHtml(deviceOtaLabel(device.ota_status))}</dd></div>
          <div><dt>USB</dt><dd>${escapeHtml(device.usb_flash_supported ? usbFlashLabel(device) : "Nicht eingerichtet")}</dd></div>
        </dl>
        <details class="device-technical">
          <summary>Technische Details</summary>
          <dl class="meta-list compact">
            ${meta("Device-ID", device.device_id)}
            ${meta("Hardwareprofil", device.hardware_profile_id)}
            ${meta("Node-Name", device.node_name || "nicht gesetzt")}
          </dl>
        </details>
        <div class="device-basissoftware-profile">
          <label>Update- und Speicherprofil
            <select data-device-profile-select="${escapeHtml(device.account_device_id)}">
              ${["full", "medium", "low"].map((profile) => `<option value="${profile}" ${deviceBasissoftwareProfileClass(device) === profile ? "selected" : ""}>${escapeHtml(deviceBasissoftwareProfileLabel(profile))}</option>`).join("")}
            </select>
          </label>
          <button class="secondary" type="button" data-save-device-profile="${escapeHtml(device.account_device_id)}">Profil ändern</button>
          <small>Jederzeit änderbar. Bei einem anderen Partitionslayout ist einmalig ein USB-Flash erforderlich.</small>
        </div>
        <div class="device-voice-ai-policy">
          <label class="device-voice-ai-toggle"><input type="checkbox" data-device-voice-enabled="${escapeHtml(device.account_device_id)}" ${device.voice_ai_policy?.enabled ? "checked" : ""}> KI-Geschichten für dieses Gerät freigeben</label>
          <label>Altersstufe
            <select data-device-voice-age-band="${escapeHtml(device.account_device_id)}">
              <option value="child_6_8" ${device.voice_ai_policy?.age_band === "child_6_8" ? "selected" : ""}>6–8 Jahre</option>
              <option value="child_9_12" ${device.voice_ai_policy?.age_band === "child_9_12" ? "selected" : ""}>9–12 Jahre</option>
              <option value="child_6_12" ${!device.voice_ai_policy?.age_band || device.voice_ai_policy?.age_band === "child_6_12" ? "selected" : ""}>6–12 Jahre</option>
            </select>
          </label>
          <button class="secondary" type="button" data-save-device-voice-policy="${escapeHtml(device.account_device_id)}">Freigabe speichern</button>
          <small>Aufnahmen sind auf 15 Sekunden begrenzt. GerNetiX speichert standardmäßig weder Rohaufnahme noch Transkript. Der Cloud-Provider ist derzeit zentral deaktiviert.</small>
        </div>
        <div class="device-card-actions">
          <button class="danger subtle-danger" type="button" data-unpair-device="${escapeHtml(device.account_device_id)}">Zuordnung aufheben</button>
        </div>
      </div>
    </article>
  `).join("") : `<div class="inventory-empty">
    <strong>Noch keine Boards registriert</strong>
    <span>Ist dein Board bereits im Hardwarekatalog, kannst du es direkt verbinden. Ein unbekanntes Board lässt du zuerst gemeinsam mit der KI erkennen und anlegen.</span>
    <div class="button-row">
      <a class="button-link" href="/app/device-management/provisioning/">Bekanntes Board verbinden</a>
      <a class="button-link" href="/app/hardware-lab/">Unbekanntes Board mit KI erkennen</a>
    </div>
  </div>`;
  document.querySelectorAll("[data-unpair-device]").forEach((button) => {
    button.addEventListener("click", () => unpairInventoryDevice(button.dataset.unpairDevice));
  });
  document.querySelectorAll("[data-save-device-profile]").forEach((button) => {
    button.addEventListener("click", () => saveDeviceBasissoftwareProfile(button.dataset.saveDeviceProfile));
  });
  document.querySelectorAll("[data-save-device-voice-policy]").forEach((button) => {
    button.addEventListener("click", () => saveDeviceVoiceAiPolicy(button.dataset.saveDeviceVoicePolicy));
  });
}

function deviceBasissoftwareProfileClass(device) {
  return device.instance_configuration?.basissoftware_profile?.class || "full";
}

function deviceBasissoftwareProfileLabel(profile) {
  return ({
    full: "FULL – Maximale Ausfallsicherheit",
    medium: "MEDIUM – Speicheroptimiert",
    low: "LOW – Minimalkonfiguration",
  })[profile] || profile;
}

async function saveDeviceBasissoftwareProfile(accountDeviceId) {
  const device = state.devices.find((item) => item.account_device_id === accountDeviceId);
  const select = document.querySelector(`[data-device-profile-select="${CSS.escape(accountDeviceId)}"]`);
  if (!device || !select) return;
  setInventoryStatus("running", `Profil für ${device.display_name} wird gespeichert...`);
  try {
    const result = await putJson(`/api/platform/devices/${encodeURIComponent(accountDeviceId)}`, {
      basissoftware_profile: select.value,
    });
    state.devices = state.devices.map((item) => item.account_device_id === accountDeviceId ? result.device : item);
    renderDevices();
    renderLoadedIdeShell();
    setInventoryStatus(result.requires_usb_reflash ? "running" : "ok", result.message);
  } catch (error) {
    setInventoryStatus("error", error.message);
  }
}

async function saveDeviceVoiceAiPolicy(accountDeviceId) {
  const device = state.devices.find((item) => item.account_device_id === accountDeviceId);
  const enabled = document.querySelector(`[data-device-voice-enabled="${CSS.escape(accountDeviceId)}"]`);
  const ageBand = document.querySelector(`[data-device-voice-age-band="${CSS.escape(accountDeviceId)}"]`);
  if (!device || !enabled || !ageBand) return;
  if (enabled.checked && !window.confirm("Voice AI für dieses Gerät aktivieren? Kurze Aufnahmen dürfen dann zur Verarbeitung an den später freigegebenen GerNetiX-Sprachdienst übertragen werden.")) return;
  setInventoryStatus("running", `Voice-AI-Freigabe für ${device.display_name} wird gespeichert...`);
  try {
    const result = await putJson(`/api/platform/devices/${encodeURIComponent(accountDeviceId)}/voice-ai-policy`, {
      enabled: enabled.checked,
      age_band: ageBand.value,
    });
    state.devices = state.devices.map((item) => item.account_device_id === accountDeviceId ? result.device : item);
    renderDevices();
    setInventoryStatus("ok", result.message);
  } catch (error) {
    setInventoryStatus("error", error.message);
  }
}

function deviceConnectivityLabel(status) {
  return ({ online: "Online", offline: "Offline", usb_connected: "USB verbunden", unknown: "Status unbekannt" })[status] || "Status unbekannt";
}

function deviceStatusClass(status) {
  return status === "online" || status === "usb_connected" ? "is-online" : status === "offline" ? "is-offline" : "is-unknown";
}

function deviceAuthenticityLabel(status) {
  return ({
    gernetix_verified: "Von GerNetiX bestätigt",
    gernetix_verified_pending_proof: "Bestätigung ausstehend",
    community_unverified: "Nicht bestätigt",
  })[status] || "Unbekannt";
}

function deviceOtaLabel(status) {
  return ({
    ready: "Bereit",
    updating: "Update läuft",
    blocked: "Nicht verfügbar",
    unsupported: "Nur USB",
    profile_change_pending: "Profilwechsel per USB erforderlich",
    unknown: "Noch nicht geprüft",
  })[status] || "Noch nicht geprüft";
}

function syncInventoryNodeNamePreview() {
  return deviceOnboarding().syncInventoryNodeNamePreview();
}

async function unpairInventoryDevice(accountDeviceId) {
  const device = state.devices.find((item) => item.account_device_id === accountDeviceId);
  if (!device) return;
  const confirmed = window.confirm(`Zuordnung von ${device.display_name} zu diesem Account aufheben? Das registrierte physische Device und seine Provisionierung bleiben erhalten.`);
  if (!confirmed) return;
  setInventoryStatus("running", `Account-Zuordnung von ${device.display_name} wird aufgehoben...`);
  try {
    await deleteJson(`/api/platform/devices/${encodeURIComponent(accountDeviceId)}`);
    state.devices = state.devices.filter((item) => item.account_device_id !== accountDeviceId);
    if (state.activeDeviceId === device.device_id) {
      state.activeDeviceId = state.devices.find((item) => item.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
    }
    renderLoadedIdeShell();
    renderDevices();
    // Meldung an die Uebersicht statt eines Aufrufs quer zum Nachbarn.
    window.dispatchEvent(new CustomEvent(DASHBOARD_STALE_EVENT));
    setInventoryStatus("ok", `${device.display_name} ist nicht mehr mit diesem Account gekoppelt.`);
  } catch (error) {
    setInventoryStatus("error", error.message);
  }
}

function setInventoryStatus(kind, text) {
  const status = document.querySelector("#inventoryStatus");
  if (!status) return;
  status.className = `flash-status ${kind}`;
  status.textContent = text;
}

function renderBuilds() {
  const target = document.querySelector("#buildList");
  if (!target) return;
  const project = projectById(state.activeProjectId);
  if (!project) {
    target.innerHTML = `<p class="empty">Öffne zuerst ein Projekt.</p>`;
    return;
  }
  const projectBuilds = state.builds.filter((build) => build.project_server_id === project.id);
  target.innerHTML = `<section class="project-version-actions"><div><p class="eyebrow">Git Light · Premium</p><h3>Projektverlauf</h3><p class="helper-text">Unveränderliche Projektstände speichern und jederzeit als neuen Restore-Stand wiederherstellen.</p></div><button type="button" data-project-version-action="save">Neue Version</button></section><section id="projectVersionList" class="build-list"><p class="helper-text">Versionen werden geladen …</p></section>${projectBuilds.length ? projectBuilds.map((build, index) => `
    <article class="build-row">
      <div>
        <h3>Build ${projectBuilds.length - index} · ${escapeHtml(buildArtifactVersionLabel(build))}</h3>
        <p>${escapeHtml(formatBuildDate(build.finished_at || build.created_at))} · ${escapeHtml(buildModeLabel(build.mode))}</p>
        <dl class="build-summary-list">
          ${meta("Ziel", buildTargetLabel(build, project))}
          ${meta("Basissoftware", buildBasisLabel(build, project))}
          ${meta("Dauer", buildDurationLabel(build))}
          ${meta("Gerät", build.device_label || "nicht zugeordnet")}
        </dl>
        ${renderBuildArtifacts(build)}
      </div>
      <dl class="meta-list">
        ${meta("Ergebnis", buildArtifactVersionLabel(build))}
        ${meta("Flash", buildFlashLabel(build.flash_status))}
        <details class="build-technical-details"><summary>Technische Kennung</summary><code>${escapeHtml(build.build_job_id)}</code></details>
      </dl>
    </article>
  `).join("") : `<p class="empty">Für dieses Projekt wurden noch keine Builds gestartet.</p>`}`;
  loadProjectVersions(project.id);
}

async function loadProjectVersions(projectId) {
  const target = document.querySelector("#projectVersionList");
  if (!target) return;
  try {
    const payload = await getJson(`/api/platform/projects/${encodeURIComponent(projectId)}/versions`);
    const versions = payload.items || [];
    target.innerHTML = versions.length ? versions.map((version, index) => `<article class="build-row project-version-row"><div><p class="eyebrow">${version.commit_kind === "restore" ? "Wiederherstellung" : `Version ${versions.length - index}`}</p><h3>${escapeHtml(version.message || "Projektversion")}</h3><p>${escapeHtml(formatBuildDate(version.created_at))} · ${version.sources?.length || 0} Dateien · ${version.includes_binary ? "mit Binary" : "ohne Binary"}</p><code title="SHA-256 des Projektstands">${escapeHtml((version.snapshot_sha256 || "").slice(0, 16))}${version.snapshot_sha256 ? "…" : ""}</code></div><button type="button" data-project-version-action="restore" data-version-id="${escapeAttribute(version.version_id)}">Wiederherstellen</button></article>`).join("") : `<p class="helper-text">Noch keine gespeicherte Projektversion.</p>`;
  } catch (error) {
    target.innerHTML = `<p class="helper-text ${error.status === 403 ? "" : "error-text"}">${error.status === 403 ? "Git Light ist eine Premium-Funktion." : "Versionen konnten nicht geladen werden."}</p>`;
  }
}

async function handleProjectVersionAction(button) {
  const projectId = state.activeProjectId;
  if (!projectId) return;
  if (button.dataset.projectVersionAction === "save") {
    document.querySelector("#projectVersionDialog").showModal();
    return;
  } else if (button.dataset.projectVersionAction === "restore") {
    if (!window.confirm("Diesen Projektstand wiederherstellen? Der aktuelle Stand bleibt als neue Version erhalten.")) return;
    await postJson(`/api/platform/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(button.dataset.versionId)}/restore`, {});
    await loadIdeProject();
  }
  renderBuilds();
}

async function submitProjectVersion(event) {
  event.preventDefault();
  const project = projectById(state.activeProjectId);
  const status = document.querySelector("#projectVersionStatus");
  const data = new FormData(event.target);
  const includeBinary = data.get("version_mode") === "binary";
  status.textContent = includeBinary ? "Projektstand wird eingefroren und frisch gebaut …" : "Projektversion wird gespeichert …";
  try {
    await persistCurrentSource(project);
    let buildJobId = null;
    if (includeBinary) {
      const device = allocatedIdeDevice(project);
      const build = await postJson("/api/user-ide/build-jobs", {
        project_slug: project.slug, device_id: device?.device_id || "", mode: "build",
      });
      const completed = await waitForCompletedBuild(build);
      state.builds.unshift(completed);
      if (completed.status !== "succeeded") throw new Error(`Build fehlgeschlagen: ${completed.error || "Unbekannter Buildfehler."}`);
      buildJobId = completed.build_job_id;
    }
    await postJson(`/api/platform/projects/${encodeURIComponent(project.id)}/versions`, {
      message: String(data.get("message") || "Projektstand gespeichert"),
      include_binary: includeBinary,
      build_job_id: buildJobId,
    });
    event.target.reset();
    document.querySelector("#projectVersionDialog").close();
    setFlashStatus("ok", includeBinary ? "Git-Light-Version mit Binary gespeichert." : "Git-Light-Version gespeichert.");
    renderBuilds();
  } catch (error) {
    status.textContent = error.message || "Projektversion konnte nicht gespeichert werden.";
  }
}

function buildArtifactVersionLabel(build) {
  if (build.status === "succeeded") return "erfolgreich";
  if (build.status === "failed") return "fehlgeschlagen";
  if (build.status === "cancelled") return "abgebrochen";
  if (build.status === "cancelling") return "wird abgebrochen";
  if (build.status === "queued") return "wartet";
  if (build.status === "running") return "läuft";
  return build.status || "ohne Ergebnis";
}

function buildModeLabel(mode) {
  return ({ build: "Build", build_and_usb_flash: "Build + USB-Flash", build_and_flash: "Build + OTA", prebuild: "Vorab-Build" })[mode] || mode || "Build";
}

function buildTargetLabel(build, project) {
  const config = build.build_config || project.buildConfig || {};
  return [config.environment || config.board, config.framework].filter(Boolean).join(" · ") || "nicht dokumentiert";
}

function buildBasisLabel(build, project) {
  const config = build.build_config || project.buildConfig || {};
  if (!config.firmware_basis_id) return "keine GerNetiX-Basissoftware";
  return [config.firmware_basis_id, config.firmware_basis_variant, config.firmware_basis_version].filter(Boolean).join(" · ");
}

function buildDurationLabel(build) {
  const start = Date.parse(build.created_at || "");
  const end = Date.parse(build.finished_at || "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "nicht erfasst";
  const seconds = Math.max(1, Math.round((end - start) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function buildFlashLabel(status) {
  return ({ succeeded: "erfolgreich geflasht", confirmed: "vom Board bestätigt", delivered: "bereitgestellt", not_requested: "nicht angefordert", "nicht angefordert": "nicht angefordert" })[status] || status || "nicht angefordert";
}

function formatBuildDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "Zeitpunkt unbekannt" : date.toLocaleString("de-DE");
}

function renderBuildArtifacts(build) {
  const downloadableNames = new Set(["bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.bin", "firmware.hex"]);
  const artifacts = (Array.isArray(build.artifacts) ? build.artifacts : [])
    .filter((artifact) => downloadableNames.has(artifact.file_name));
  if (!artifacts.length) return build.status === "succeeded"
    ? `<p class="build-artifact-note">Für diesen älteren Build ist kein herunterladbares Ergebnis hinterlegt.</p>`
    : "";
  return `<div class="build-artifact-list" aria-label="Build-Ergebnisse">
    ${artifacts.map((artifact) => `
      <a href="${escapeAttribute(artifact.download_url)}" download="${escapeAttribute(artifact.file_name)}">
        <strong>${escapeHtml(artifact.file_name)}</strong>
        <span>${escapeHtml(formatArtifactSize(artifact.size_bytes))}${artifact.sha256 ? ` · SHA-256 ${escapeHtml(String(artifact.sha256).slice(0, 12))}…` : ""}</span>
      </a>
    `).join("")}
  </div>`;
}

function formatArtifactSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "Größe unbekannt";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function selectedDevice() {
  return state.devices.find((device) => device.device_id === state.activeDeviceId) || state.devices[0] || null;
}

function syncSelectedDevicePort() {
  const device = selectedDevice();
  const select = document.querySelector("#usbPortSelect");
  if (!select) return;
  const matched = bestUsbPortForDevice(device);
  if (matched) {
    select.value = matched.port;
    return;
  }
  if (device && device.upload_port) select.value = device.upload_port;
}

async function refreshUsbPorts(showStatus = true) {
  try {
    const daemonAvailable = await state.serialService.available();
    const items = daemonAvailable
      ? await state.serialService.ports()
      : (await getJson("/api/platform/usb-serial/ports")).items || [];
    state.usbPorts = items.map((port) => ({
      ...port,
      port: port.port || port.path,
      name: port.name || port.label || port.manufacturer,
    }));
    renderUsbPortOptions();
    syncSelectedDevicePort();
    renderDevices();
    if (showStatus) setFlashStatus("ok", state.usbPorts.length
      ? `${state.usbPorts.length} USB-Serial-Port${state.usbPorts.length === 1 ? "" : "s"} gefunden.`
      : "Kein USB-Serial-Port gefunden.");
  } catch (error) {
    state.usbPorts = [];
    renderUsbPortOptions();
    if (showStatus) setFlashStatus("error", error.message);
  }
}

function renderUsbPortOptions() {
  const select = document.querySelector("#usbPortSelect");
  if (!select) return;
  const current = select.value;
  const detected = state.usbPorts.map((port) => `
    <option value="${escapeHtml(port.port)}">${escapeHtml(usbPortOptionLabel(port))}</option>
  `).join("");
  const automaticLabel = state.usbPorts.length
    ? "Automatisch ermitteln"
    : "Automatisch (kein USB-Port erkannt)";
  select.innerHTML = `<option value="">${automaticLabel}</option>${detected}`;
  select.title = state.usbPorts.length
    ? "Nur fuer USB-Flash: Port automatisch ermitteln oder einen erkannten Port auswaehlen."
    : "Nur fuer USB-Flash: Momentan wurde kein USB-Serial-Port erkannt.";
  if (current && Array.from(select.options).some((option) => option.value === current)) select.value = current;
  renderUsbPortMappingConfirmationState();
}

function usbPortOptionLabel(port) {
  const path = String(port.port || "");
  const description = String(port.name || port.manufacturer || "").trim();
  return !description || description === path ? path : `${path} · ${description}`;
}

function selectedUsbPort() {
  return document.querySelector("#usbPortSelect")?.value || "";
}

function usbPortMissingError(message = "Kein USB-Port gefunden.") {
  const error = new Error(message);
  error.code = "usb_port_not_found";
  return error;
}

function isUsbPortMissingError(error) {
  return error?.code === "usb_port_not_found"
    || /no such file or directory|serial_port_not_available|kein usb.port|port ist nicht verf(?:ü|ue)gbar/i.test(String(error?.message || ""));
}

function showUsbPortMissingGuidance() {
  const dialog = document.querySelector("#usbPortMissingDialog");
  const checkedAt = document.querySelector("#usbPortMissingCheckedAt");
  const macosSecurityHint = document.querySelector("#usbPortMacosSecurityHint");
  const status = document.querySelector("#flashStatus");
  if (!dialog) return;
  if (macosSecurityHint) {
    const clientPlatform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "");
    macosSecurityHint.classList.toggle("hidden", !/mac/i.test(clientPlatform));
  }
  if (status) {
    status.className = "flash-status hidden";
    status.textContent = "";
  }
  if (checkedAt) checkedAt.textContent = `Automatische Suche um ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}: kein Port erkannt.`;
  if (!dialog.open) dialog.showModal();
  appendIdeTerminal("error", "Kein USB-Port gefunden. Prüfe Kabel, USB-Hub, laufende Firmware, Download-Modus, andere serielle Programme und den GerNetiX Serial Service.");
}

function showUsbPortChoiceDialog(project, mode = "firmware-port-mapping") {
  const dialog = document.querySelector("#usbPortChoiceDialog");
  const select = document.querySelector("#usbPortSelect");
  const title = document.querySelector("#usbPortChoiceTitle");
  const intro = document.querySelector("#usbPortChoiceIntro");
  const warning = document.querySelector("#usbPortIdentityWarning");
  const firmwareSelect = document.querySelector("#usbFirmwareTargetSelect");
  const assignmentGrid = document.querySelector("#usbAssignmentGrid");
  const detected = document.querySelector("#usbPortDetectedList");
  const confirm = document.querySelector("#confirmUsbPortButton");
  if (!dialog || !select) return;
  stopUsbFlashPortIdentification();
  dialog.dataset.usbChoiceMode = mode;
  const status = document.querySelector("#flashStatus");
  if (status) {
    status.className = "flash-status hidden";
    status.textContent = "";
  }
  if (mode === "single-device-conflict") {
    if (title) title.textContent = "Nur ein USB-Gerät anschließen";
    if (intro) intro.textContent = "Dieses Projekt besitzt exakt ein IoT-Device. Für den eindeutigen USB-Flash darf deshalb nur ein USB-Gerät angeschlossen sein.";
    if (warning) warning.textContent = "Trenne alle anderen USB-Serial-Geräte und lasse nur das Zielboard verbunden. Ohne vorherige Provisionierung kann GerNetiX das konkrete Board nicht eindeutig identifizieren.";
    assignmentGrid?.classList.add("hidden");
    document.querySelector("#usbFlashPortIdentification")?.classList.add("hidden");
    if (detected) {
      detected.classList.remove("hidden");
      detected.innerHTML = `<strong>Momentan erkannt:</strong><ul>${state.usbPorts.map((port) => `<li>${escapeHtml(usbPortOptionLabel(port))}</li>`).join("")}</ul>`;
    }
    if (confirm) {
      confirm.disabled = false;
      confirm.textContent = "Erneut prüfen";
    }
  } else {
    const units = usbFirmwareUnits(project);
    if (title) title.textContent = "Firmware und USB-Ports zuordnen";
    if (intro) intro.textContent = "Dieses Projekt besitzt mehrere IoT-Devices. Ordne nur den Firmwares einen USB-Port zu, die du jetzt flashen möchtest. Zugeordnete Zeilen werden nacheinander geflasht; nicht zugeordnete Zeilen bleiben unverändert.";
    if (warning) warning.textContent = "Ohne vorherige Provisionierung kann GerNetiX nicht eindeutig erkennen, welches konkrete Board hinter einem USB-Port steckt. Prüfe die Port-Zuordnung deshalb sorgfältig.";
    assignmentGrid?.classList.remove("hidden");
    renderUsbFlashPortIdentification();
    detected?.classList.add("hidden");
    if (firmwareSelect) {
      firmwareSelect.innerHTML = units.map((unit) => `<option value="${escapeAttribute(unit.software_unit_id)}">${escapeHtml(usbFirmwareTargetLabel(unit))}</option>`).join("");
      const activeId = state.activeSoftwareUnitIds[project?.id] || "";
      firmwareSelect.value = units.some((unit) => unit.software_unit_id === activeId) ? activeId : units[0]?.software_unit_id || "";
    }
    if (confirm) {
      const selectedCount = selectedUsbFirmwarePortAssignments(project).length;
      confirm.disabled = selectedCount === 0;
      confirm.textContent = selectedCount === 1 ? "1 Zuordnung flashen" : `${selectedCount} Zuordnungen flashen`;
    }
    renderUsbFlashAssignmentLists(project);
  }
  if (!dialog.open) dialog.showModal();
  (mode === "single-device-conflict"
    ? confirm
    : document.querySelector("[data-usb-firmware-port-select]"))?.focus();
}

function renderUsbPortMappingConfirmationState() {
  const dialog = document.querySelector("#usbPortChoiceDialog");
  const confirm = document.querySelector("#confirmUsbPortButton");
  if (!confirm || dialog?.dataset.usbChoiceMode === "single-device-conflict") return;
  const project = projectById(state.activeProjectId);
  renderUsbFlashAssignmentLists(project);
  const selectedCount = selectedUsbFirmwarePortAssignments(project).length;
  confirm.disabled = selectedCount === 0;
  confirm.textContent = selectedCount === 1 ? "1 Zuordnung flashen" : `${selectedCount} Zuordnungen flashen`;
}

function usbFirmwareTargetLabel(unit) {
  const configuration = unit?.build_config?.board_configuration || {};
  const board = configuration.name || configuration.base_board_profile_id || unit?.build_config?.environment || unit?.build_config?.board || "Board nicht konfiguriert";
  return `${unit?.title || unit?.software_unit_id || "Firmware"} → ${board}`;
}

function usbFirmwarePortAssignmentsForProject(project) {
  if (!project?.id) return new Map();
  if (!usbFirmwarePortAssignments.has(project.id)) usbFirmwarePortAssignments.set(project.id, new Map());
  return usbFirmwarePortAssignments.get(project.id);
}

function setUsbFlashPortIdentificationStatus(kind, message) {
  const status = document.querySelector("#usbFlashPortIdentificationStatus");
  if (!status) return;
  status.className = message ? kind : "hidden";
  status.textContent = message || "";
}

function renderUsbPortIdentificationDialog(kind, { firmwareLabel = "", message = "", inferOther = false } = {}) {
  const dialog = document.querySelector("#usbPortIdentificationDialog");
  const title = document.querySelector("#usbPortIdentificationDialogTitle");
  const status = document.querySelector("#usbPortIdentificationDialogStatus");
  const cancel = dialog?.querySelector("[data-cancel-usb-port-identification]");
  const finish = document.querySelector("#finishUsbPortIdentificationButton");
  if (!dialog || !title || !status) return;
  const target = firmwareLabel ? `„${firmwareLabel}“` : "diese Firmware";
  if (kind === "waiting") {
    title.textContent = `Bitte jetzt das Board für ${target} abziehen.`;
    status.textContent = inferOther ? "Das andere Board wird automatisch zugeordnet." : "Warte auf Portänderung …";
  } else if (kind === "detected") {
    title.textContent = `Bitte das Board für ${target} wieder einstecken.`;
    status.textContent = "Board erkannt.";
  } else if (kind === "identified") {
    title.textContent = `Board für ${target} zugeordnet.`;
    status.textContent = message;
  } else {
    title.textContent = "Port-Erkennung fehlgeschlagen.";
    status.textContent = message;
  }
  status.className = kind;
  cancel?.classList.toggle("hidden", kind === "identified");
  finish?.classList.toggle("hidden", !["identified", "error"].includes(kind));
  if (!dialog.open) dialog.showModal();
}

function closeUsbPortIdentificationDialog({ cancelDetection = false } = {}) {
  if (cancelDetection && usbFlashPortIdentification?.active) stopUsbFlashPortIdentification({ clearResult: false });
  document.querySelector("#usbPortIdentificationDialog")?.close();
}

function renderUsbFlashPortIdentification() {
  const panel = document.querySelector("#usbFlashPortIdentification");
  const dialog = document.querySelector("#usbPortChoiceDialog");
  if (!panel) return;
  const visible = dialog?.dataset.usbChoiceMode === "firmware-port-mapping"
    && (state.usbPorts.length > 1 || usbFlashPortIdentification?.resultVisible);
  panel.classList.toggle("hidden", !visible);
}

async function listUsbFlashIdentificationPorts() {
  const daemonAvailable = await state.serialService.available();
  const items = daemonAvailable
    ? await state.serialService.ports()
    : (await getJson("/api/platform/usb-serial/ports")).items || [];
  return items.map((port) => ({
    ...port,
    port: port.port || port.path,
    name: port.name || port.label || port.manufacturer,
  }));
}

function ensureUsbFlashPortDetector() {
  if (usbFlashPortDetector || !window.GerNetiXUsbPortDisconnectDetector) return usbFlashPortDetector;
  usbFlashPortDetector = window.GerNetiXUsbPortDisconnectDetector.create({
    listPorts: listUsbFlashIdentificationPorts,
    pathOf: (port) => String(port?.port || port?.path || ""),
    labelOf: usbPortOptionLabel,
    onPorts: (ports) => {
      state.usbPorts = ports;
      renderUsbPortOptions();
      renderUsbFlashAssignmentLists(projectById(state.activeProjectId));
      renderUsbFlashPortIdentification();
    },
    onState: (event) => {
      const project = projectById(state.activeProjectId);
      if (event.type === "waiting") {
        usbFlashPortIdentification = { active: true, softwareUnitId: event.context?.softwareUnitId || "", resultVisible: true };
        setUsbFlashPortIdentificationStatus("waiting", `Ziehe jetzt das Board für „${event.context?.firmwareLabel || "die gewählte Firmware"}“ ab …`);
        const project = projectById(state.activeProjectId);
        renderUsbPortIdentificationDialog("waiting", {
          firmwareLabel: event.context?.firmwareLabel || "",
          inferOther: usbFirmwareUnits(project).length === 2 && state.usbPorts.length === 2,
        });
      } else if (event.type === "removed") {
        setUsbFlashPortIdentificationStatus("detected", `Erkannt: ${event.label} ist verschwunden. Stecke dieses Board jetzt wieder ein.`);
        renderUsbPortIdentificationDialog("detected", { firmwareLabel: event.context?.firmwareLabel || "", message: `${event.label} wurde abgezogen.` });
      } else if (event.type === "identified") {
        usbFlashPortIdentification = { active: false, softwareUnitId: event.context?.softwareUnitId || "", identifiedPort: event.path, resultVisible: true };
        let inferredAssignment = null;
        if (project && event.context?.softwareUnitId) {
          const assignments = usbFirmwarePortAssignmentsForProject(project);
          assignments.set(event.context.softwareUnitId, event.path);
          const units = usbFirmwareUnits(project);
          if (units.length === 2 && state.usbPorts.length === 2) {
            const remainingUnit = units.find((unit) => unit.software_unit_id !== event.context.softwareUnitId);
            const remainingPort = state.usbPorts.find((port) => port.port !== event.path);
            if (remainingUnit && remainingPort) {
              assignments.set(remainingUnit.software_unit_id, remainingPort.port);
              inferredAssignment = { unit: remainingUnit, port: remainingPort.port };
            }
          }
        }
        setUsbFlashPortIdentificationStatus("identified", inferredAssignment
          ? `Eindeutig zugeordnet: ${event.path} erhält „${event.context?.firmwareLabel || "die gewählte Firmware"}“. Damit erhält ${inferredAssignment.port} automatisch „${inferredAssignment.unit.title || inferredAssignment.unit.software_unit_id}“.`
          : `Zugeordnet: ${event.path} erhält „${event.context?.firmwareLabel || "die gewählte Firmware"}“.`);
        renderUsbPortIdentificationDialog("identified", {
          firmwareLabel: event.context?.firmwareLabel || "",
          message: inferredAssignment
            ? `${event.path} wurde erkannt. Die zweite Zuordnung wurde automatisch ergänzt.`
            : `${event.path} wurde erkannt und zugeordnet.`,
        });
      } else if (event.type === "error") {
        usbFlashPortIdentification = { active: false, resultVisible: true };
        setUsbFlashPortIdentificationStatus("error", event.message);
        renderUsbPortIdentificationDialog("error", { firmwareLabel: event.context?.firmwareLabel || "", message: event.message });
      }
      renderUsbFlashAssignmentLists(project);
      renderUsbFlashPortIdentification();
      renderUsbPortMappingConfirmationState();
    },
  });
  return usbFlashPortDetector;
}

function stopUsbFlashPortIdentification({ clearResult = true } = {}) {
  usbFlashPortDetector?.stop();
  if (clearResult) {
    usbFlashPortIdentification = null;
    setUsbFlashPortIdentificationStatus("", "");
    if (document.querySelector("#usbPortIdentificationDialog")?.open) document.querySelector("#usbPortIdentificationDialog").close();
  } else if (usbFlashPortIdentification) {
    usbFlashPortIdentification.active = false;
  }
  renderUsbFlashPortIdentification();
  const project = projectById(state.activeProjectId);
  renderUsbFlashAssignmentLists(project);
  renderUsbPortMappingConfirmationState();
}

function identifyUsbFlashPortForFirmware(project, softwareUnitId) {
  const unit = usbFirmwareUnits(project).find((candidate) => candidate.software_unit_id === softwareUnitId);
  if (!unit || state.usbPorts.length < 2 || usbFlashPortIdentification?.active) return;
  const detector = ensureUsbFlashPortDetector();
  if (!detector) {
    setUsbFlashPortIdentificationStatus("error", "Die USB-Port-Erkennung ist nicht verfügbar. Lade die Seite neu und versuche es erneut.");
    return;
  }
  detector.start(state.usbPorts, {
    softwareUnitId,
    firmwareLabel: unit.title || unit.software_unit_id,
  });
}

function latestBuildForUsbFirmware(project, softwareUnitId) {
  const projectIds = new Set([project?.id, project?.slug, project?.project_server_id].filter(Boolean).map(String));
  return state.builds
    .filter((build) => projectIds.has(String(build.project_server_id || build.project_id || build.project_slug || ""))
      && String(build.software_unit_id || "") === String(softwareUnitId || ""))
    .sort((left, right) => Date.parse(right.finished_at || right.created_at || 0) - Date.parse(left.finished_at || left.created_at || 0))[0] || null;
}

function renderUsbFlashAssignmentLists(project = projectById(state.activeProjectId)) {
  const target = document.querySelector("#usbFirmwarePortRows");
  if (!target) return;
  const units = usbFirmwareUnits(project);
  const assignments = usbFirmwarePortAssignmentsForProject(project);
  const validUnitIds = new Set(units.map((unit) => unit.software_unit_id));
  for (const unitId of assignments.keys()) if (!validUnitIds.has(unitId)) assignments.delete(unitId);
  const availablePorts = new Set(state.usbPorts.map((port) => port.port));
  for (const [unitId, port] of assignments) if (!availablePorts.has(port)) assignments.delete(unitId);
  const usedPorts = new Map([...assignments].map(([unitId, port]) => [port, unitId]));

  target.innerHTML = units.length ? units.map((unit) => {
    const config = unit.build_config || {};
    const boardConfiguration = config.board_configuration || {};
    const boardProfile = boardConfiguration.name
      || boardConfiguration.base_board_profile_id
      || unit.hardware_profile_id
      || unit.hardwareProfileId
      || "Keine Boardkonfiguration hinterlegt";
    const latestBuild = latestBuildForUsbFirmware(project, unit.software_unit_id);
    const buildStatus = latestBuild ? buildArtifactVersionLabel(latestBuild) : "noch nicht gebaut";
    const buildTime = latestBuild ? formatBuildDate(latestBuild.finished_at || latestBuild.created_at) : "";
    const selectedPort = assignments.get(unit.software_unit_id) || "";
    const identifyingThisUnit = usbFlashPortIdentification?.active && usbFlashPortIdentification.softwareUnitId === unit.software_unit_id;
    const identifyingAnotherUnit = usbFlashPortIdentification?.active && !identifyingThisUnit;
    const portOptions = state.usbPorts.map((port) => {
      const assignedToOther = usedPorts.has(port.port) && usedPorts.get(port.port) !== unit.software_unit_id;
      return `<option value="${escapeAttribute(port.port)}"${port.port === selectedPort ? " selected" : ""}${assignedToOther ? " disabled" : ""}>${escapeHtml(usbPortOptionLabel(port))}</option>`;
    }).join("");
    return `<div class="usb-flash-assignment-row" role="row">
      <div class="usb-flash-firmware-cell" role="cell">
        <strong>${escapeHtml(unit.title || unit.software_unit_id)}</strong>
        <div class="usb-flash-firmware-meta">
          <span><b>Board:</b> ${escapeHtml(boardProfile)}</span>
          <span class="usb-flash-build-state ${escapeAttribute(latestBuild?.status || "missing")}"><b>Letzter Build:</b> ${escapeHtml(buildStatus)}${buildTime ? ` · ${escapeHtml(buildTime)}` : ""}</span>
        </div>
      </div>
      <label class="usb-flash-port-cell" role="cell">
        <span class="sr-only">USB-Port für ${escapeHtml(unit.title || unit.software_unit_id)}</span>
        <select data-usb-firmware-port-select="${escapeAttribute(unit.software_unit_id)}" aria-label="USB-Port für ${escapeAttribute(unit.title || unit.software_unit_id)}"${usbFlashPortIdentification?.active ? " disabled" : ""}>
          <option value="">USB-Port wählen</option>${portOptions}
        </select>
        <button class="usb-flash-identify-port-button" type="button" data-identify-usb-flash-port="${escapeAttribute(unit.software_unit_id)}"${state.usbPorts.length < 2 || identifyingAnotherUnit || identifyingThisUnit ? " disabled" : ""}>${identifyingThisUnit ? "Board jetzt abziehen …" : "Port durch Abziehen zuordnen"}</button>
        <small>${selectedPort ? "Dieser Port erhält genau diese Firmware." : "Nicht ausgewählt – diese Firmware wird nicht geflasht."}</small>
      </label>
    </div>`;
  }).join("") : '<p class="usb-flash-assignment-empty">Dieses Projekt enthält keine PlatformIO-Firmware.</p>';
}

function updateUsbFirmwarePortAssignment(project, softwareUnitId, port) {
  const assignments = usbFirmwarePortAssignmentsForProject(project);
  if (port) assignments.set(softwareUnitId, port);
  else assignments.delete(softwareUnitId);
  renderUsbPortMappingConfirmationState();
}

function selectedUsbFirmwarePortAssignments(project) {
  if (usbFlashPortIdentification?.active) return [];
  const units = usbFirmwareUnits(project);
  const assignments = usbFirmwarePortAssignmentsForProject(project);
  const selected = UsbFlashTargetModel.selectedAssignments(
    units.map((unit) => unit.software_unit_id),
    state.usbPorts.map((port) => port.port),
    Object.fromEntries(assignments),
  );
  return selected.map((assignment) => ({
    softwareUnitId: assignment.firmwareId,
    port: assignment.port,
  }));
}

async function startUsbFlashAssignmentBatch(project) {
  const selectedAssignments = selectedUsbFirmwarePortAssignments(project);
  if (!selectedAssignments.length) return;
  usbFlashAssignmentBatch = {
    projectId: project.id,
    inventoryCheckConfirmed: false,
    remaining: selectedAssignments,
  };
  document.querySelector("#usbPortChoiceDialog")?.close();
  await continueUsbFlashAssignmentBatch();
}

async function continueUsbFlashAssignmentBatch() {
  const next = usbFlashAssignmentBatch?.remaining?.[0];
  const project = projectById(usbFlashAssignmentBatch?.projectId);
  if (!next || !project) {
    usbFlashAssignmentBatch = null;
    return;
  }
  state.activeSoftwareUnitIds[project.id] = next.softwareUnitId;
  const firmwareSelect = document.querySelector("#usbFirmwareTargetSelect");
  const portSelect = document.querySelector("#usbPortSelect");
  if (firmwareSelect) firmwareSelect.value = next.softwareUnitId;
  if (portSelect) portSelect.value = next.port;
  await startUsbFlash(true, Boolean(usbFlashAssignmentBatch.inventoryCheckConfirmed), true);
}

async function finishUsbFlashAssignmentBatch(projectId, softwareUnitId) {
  if (usbFlashAssignmentBatch?.projectId !== projectId || usbFlashAssignmentBatch.remaining?.[0]?.softwareUnitId !== softwareUnitId) return;
  usbFlashAssignmentBatch.remaining.shift();
  if (!usbFlashAssignmentBatch.remaining.length) {
    usbFlashAssignmentBatch = null;
    appendIdeTerminal("ok", "Alle zugeordneten Firmware-Einheiten wurden per USB geflasht.");
    return;
  }
  await continueUsbFlashAssignmentBatch();
}

function inventoryDeviceForUsbFlash(allocatedDevice, port) {
  if (allocatedDevice) return allocatedDevice;
  const normalizedPort = String(port || "").trim().toLowerCase();
  if (!normalizedPort) return null;
  return state.devices.find((device) => String(device.upload_port || "").trim().toLowerCase() === normalizedPort) || null;
}

function usbInventoryWarningStorageKey() {
  const accountId = state.account?.user_id || state.account?.username || "local";
  return `gernetix.usb.inventory-warning.dismissed.v1:${accountId}`;
}

function usbInventoryWarningDismissed() {
  try {
    return localStorage.getItem(usbInventoryWarningStorageKey()) === "true";
  } catch {
    return false;
  }
}

function persistUsbInventoryWarningPreference() {
  const checkbox = document.querySelector("#dismissUsbInventoryWarningCheckbox");
  if (!checkbox?.checked) return;
  try {
    localStorage.setItem(usbInventoryWarningStorageKey(), "true");
  } catch {
    // Die Praeferenz ist optional; USB-Flash darf nicht an Browser-Speicher scheitern.
  }
}

function showUsbInventoryUnknownDialog(port) {
  const dialog = document.querySelector("#usbInventoryUnknownDialog");
  const portHint = document.querySelector("#usbInventoryUnknownPort");
  const checkbox = document.querySelector("#dismissUsbInventoryWarningCheckbox");
  if (!dialog) return;
  if (checkbox) checkbox.checked = false;
  if (portHint) {
    portHint.textContent = port
      ? `Erkanntes USB-Ziel: ${port}`
      : "Das USB-Ziel wird gleich über die Geräteauswahl des Browsers bestimmt.";
  }
  if (!dialog.open) dialog.showModal();
}

async function retryUsbPortSearch() {
  const button = document.querySelector("#retryUsbPortSearchButton");
  if (button) button.disabled = true;
  await refreshUsbPorts(false);
  if (button) button.disabled = false;
  if (state.usbPorts.length) {
    document.querySelector("#usbPortMissingDialog")?.close();
    const pending = state.pendingUsbFlash;
    state.pendingUsbFlash = null;
    const pendingProject = projectById(pending?.projectId);
    const pendingSelectionMode = pendingProject
      ? UsbFlashTargetModel.selectionMode(usbFirmwareUnits(pendingProject).length, state.usbPorts.length)
      : "";
    if (pending?.mode === "flash" && pendingSelectionMode === "single-device-port-conflict") {
      state.pendingUsbFlash = pending;
      showUsbPortChoiceDialog(pendingProject, "single-device-conflict");
      return;
    }
    if (pending?.mode === "flash" && pending.port && state.usbPorts.some((port) => port.port === pending.port)) {
      const portSelect = document.querySelector("#usbPortSelect");
      if (portSelect) portSelect.value = pending.port;
    }
    setFlashStatus("running", `${state.usbPorts.length} USB-Serial-Port${state.usbPorts.length === 1 ? "" : "s"} gefunden. Flash-Vorgang wird fortgesetzt...`);
    if (pending?.mode === "flash" && pending.build) {
      await resumeUsbFlashWithCompletedBuild(pending);
    } else {
      await startUsbFlash(true);
    }
    return;
  }
  const checkedAt = document.querySelector("#usbPortMissingCheckedAt");
  if (checkedAt) checkedAt.textContent = `Erneute Suche um ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}: weiterhin kein Port erkannt.`;
}

async function resumeUsbFlashWithCompletedBuild(pending) {
  const build = pending.build;
  const device = state.devices.find((item) => item.device_id === pending.deviceId) || allocatedIdeDevice(projectById(pending.projectId));
  try {
    const flashResult = await flashBuildViaSerialService(build, device);
    await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(build.build_job_id)}/browser-usb-flash-result`, {
      status: "succeeded",
      chip_name: flashResult.chipName,
      logs: flashResult.logs,
    });
    build.flash_status = "succeeded";
    setUsbFlashSuccess(`USB-Flash erfolgreich: ${flashResult.chipName}`);
    renderBuilds();
    await finishUsbFlashAssignmentBatch(pending.projectId, pending.softwareUnitId || "");
  } catch (error) {
    if (isUsbPortMissingError(error)) {
      state.pendingUsbFlash = pending;
      showUsbPortMissingGuidance();
      return;
    }
    await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(build.build_job_id)}/browser-usb-flash-result`, {
      status: "failed",
      error: error.message,
    }).catch(() => {});
    usbFlashAssignmentBatch = null;
    setFlashStatus("error", error.message);
  }
}

function bestUsbPortForDevice(device) {
  if (!device || !state.usbPorts.length) return null;
  const profile = String(device.hardware_profile_id || "").toLowerCase();
  const label = `${device.display_name || ""} ${device.build_target_label || ""}`.toLowerCase();
  const candidates = state.usbPorts.map((port) => ({
    ...port,
    haystack: `${port.name || ""} ${port.device_id || ""} ${port.manufacturer || ""}`.toLowerCase(),
  }));
  if (profile.includes("esp32") || label.includes("esp32")) {
    return uniqueUsbPortMatch(candidates, /cp210|ch340|ch341|usb-serial|usb serial|silicon labs|wch|uart|esp32/);
  }
  if (profile.includes("arduino_nano") || label.includes("arduino")) {
    return uniqueUsbPortMatch(candidates, /arduino|ch340|ch341|usb-serial|usb serial|wch/);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function bestUsbPortForHardwareType(type) {
  if (!state.usbPorts.length) return null;
  const candidates = state.usbPorts.map((port) => ({
    ...port,
    haystack: `${port.name || ""} ${port.device_id || ""} ${port.manufacturer || ""}`.toLowerCase(),
  }));
  if (type === "esp32") {
    return uniqueUsbPortMatch(candidates, /cp210|ch340|ch341|usb-serial|usb serial|silicon labs|wch|uart|esp32/);
  }
  if (type === "arduino_nano") {
    return uniqueUsbPortMatch(candidates, /arduino|ch340|ch341|usb-serial|usb serial|wch/);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function uniqueUsbPortMatch(candidates, pattern) {
  if (candidates.length === 1) return candidates[0];
  const matches = candidates.filter((port) => pattern.test(port.haystack));
  return matches.length === 1 ? matches[0] : null;
}

function usbFlashLabel(device) {
  const matched = bestUsbPortForDevice(device);
  if (matched) return `bereit (${matched.port} aktuell erkannt)`;
  if (device.upload_port) return `bereit (${device.upload_port} Fallback)`;
  return "bereit (Port vor Flash erkennen)";
}

function setFlashStatus(kind, text, percent = null) {
  const status = document.querySelector("#flashStatus");
  GerNetiXFlashProgress.render(status, kind, text, percent);
  appendIdeTerminal(kind, text);
}

function setUsbFlashSuccess(text) {
  const status = document.querySelector("#flashStatus");
  status.className = "flash-status hidden";
  status.textContent = "";
  appendIdeTerminal("ok", text);
}

function appendIdeTerminal(kind, text) {
  const terminal = document.querySelector("#ideTerminalOutput");
  if (!terminal || !text) return;
  const normalizedText = String(text).replace(/\x1b\[[0-9;]*m/g, "").trim();
  ideFlashDialog?.write(kind, normalizedText);
  const previous = terminal.querySelector(".terminal-line:last-of-type");
  if (previous?.dataset.message === `${kind}:${normalizedText}`) return;
  if (kind === "running" && previous?.classList.contains("terminal-running")) {
    previous.textContent = `[${new Date().toLocaleTimeString()}] ${normalizedText}`;
    previous.dataset.message = `${kind}:${normalizedText}`;
    terminal.scrollTop = terminal.scrollHeight;
    return;
  }
  const line = document.createElement("span");
  line.className = `terminal-line terminal-${kind}`;
  line.dataset.message = `${kind}:${normalizedText}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${normalizedText}`;
  terminal.append(document.createTextNode("\n"), line);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearIdeTerminal() {
  const terminal = document.querySelector("#ideTerminalOutput");
  if (!terminal) return;
  terminal.innerHTML = '<span class="terminal-muted">GerNetiX Build-Terminal bereit.</span>';
}

export {
  checkAllocatedDeviceConnectivity,
  checkRecoveryFirmware,
  claimSelectedDiscoveredDevices,
  cleanProjectBuildCache,
  clearIdeTerminal,
  closeUsbPortIdentificationDialog,
  confirmCancelActiveBuilds,
  confirmFlashTargetChoice,
  connectProvisioningWifi,
  handleBuildButtonAction,
  handleProjectVersionAction,
  identifyAvrBootloaderExperimental,
  identifyEsp32Bootloader,
  identifyUsbFlashPortForFirmware,
  inventoryFlashboxes,
  loadIdeEsptoolModule,
  openIdeFlashDialog,
  openProvisioningFlashDialog,
  persistUsbInventoryWarningPreference,
  refreshRecoveryDevices,
  refreshUsbPorts,
  renderBuilds,
  renderDeviceRecovery,
  renderDevices,
  renderNetworkDiscovery,
  renderUsbPortMappingConfirmationState,
  renderUsbPortOptions,
  retryUsbPortSearch,
  scanProvisioningSerialPorts,
  scanProvisioningWifiNetworks,
  searchDevicesForInventory,
  selectDeviceDiscoveryMethod,
  selectProvisioningSerialPort,
  selectedUsbPort,
  setFlashStatus,
  setInventoryStatus,
  startBuild,
  startUsbFlash,
  startUsbFlashAssignmentBatch,
  stopUsbFlashPortIdentification,
  submitProjectVersion,
  syncInventoryNodeNamePreview,
  syncSelectedDevicePort,
  updateBuildActionButton,
  updateUsbFirmwarePortAssignment,
  usbFlashAssignmentBatch,
  waitForCompletedBuild,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: 5 Dateien.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  checkAllocatedDeviceConnectivity,
  checkRecoveryFirmware,
  claimSelectedDiscoveredDevices,
  cleanProjectBuildCache,
  clearIdeTerminal,
  closeUsbPortIdentificationDialog,
  confirmCancelActiveBuilds,
  confirmFlashTargetChoice,
  connectProvisioningWifi,
  handleBuildButtonAction,
  handleProjectVersionAction,
  identifyAvrBootloaderExperimental,
  identifyEsp32Bootloader,
  identifyUsbFlashPortForFirmware,
  inventoryFlashboxes,
  loadIdeEsptoolModule,
  openIdeFlashDialog,
  openProvisioningFlashDialog,
  persistUsbInventoryWarningPreference,
  refreshRecoveryDevices,
  refreshUsbPorts,
  renderBuilds,
  renderDeviceRecovery,
  renderDevices,
  renderNetworkDiscovery,
  renderUsbPortMappingConfirmationState,
  renderUsbPortOptions,
  retryUsbPortSearch,
  scanProvisioningSerialPorts,
  scanProvisioningWifiNetworks,
  searchDevicesForInventory,
  selectDeviceDiscoveryMethod,
  selectProvisioningSerialPort,
  selectedUsbPort,
  setFlashStatus,
  setInventoryStatus,
  startBuild,
  startUsbFlash,
  startUsbFlashAssignmentBatch,
  stopUsbFlashPortIdentification,
  submitProjectVersion,
  syncInventoryNodeNamePreview,
  syncSelectedDevicePort,
  updateBuildActionButton,
  updateUsbFirmwarePortAssignment,
  usbFlashAssignmentBatch,
  waitForCompletedBuild,
});
/* ---- /Uebergangsbruecke ---- */
