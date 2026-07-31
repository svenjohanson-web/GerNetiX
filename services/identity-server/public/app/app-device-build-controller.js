// GerNetiX platform module extracted from app.js.
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

async function startBuild() {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project) return setFlashStatus("error", "Bitte zuerst ein Projekt öffnen.");
  const softwareUnits = projectSoftwareUnits(project);
  const buildTargets = softwareUnits.length ? softwareUnits : [null];
  const unsupportedUnits = softwareUnits.filter((unit) => unit.build_system !== "platformio");
  if (unsupportedUnits.length) {
    const details = unsupportedUnits
      .map((unit) => `${unit.title || unit.software_unit_id} (${unit.build_system || "kein Buildsystem"})`)
      .join(", ");
    return setFlashStatus("error", `Gesamtbuild nicht gestartet. Für folgende Software-Einheiten fehlt ein Build-Runner: ${details}.`);
  }
  setFlashStatus("running", `Gesamtbuild läuft: ${buildTargets.length} Software-Einheit${buildTargets.length === 1 ? "" : "en"}...`);
  try {
    await persistCurrentSource(project);
    const submissions = await Promise.allSettled(buildTargets.map((softwareUnit) => postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      software_unit_id: softwareUnit?.software_unit_id || "",
      device_id: device?.device_id || "",
      mode: "build",
    })));
    const acceptedBuilds = submissions.flatMap((result, index) => result.status === "fulfilled"
      ? [{ build: result.value, softwareUnit: buildTargets[index] }]
      : []);
    const rejectedSubmissions = submissions.flatMap((result, index) => result.status === "rejected"
      ? [{ reason: result.reason, softwareUnit: buildTargets[index] }]
      : []);
    const completionResults = await Promise.allSettled(acceptedBuilds.map(({ build, softwareUnit }) => waitForCompletedBuild(build, {
      appendMemorySummary: false,
      suppressTerminalBuildResult: true,
      targetLabel: softwareUnit?.title || softwareUnit?.software_unit_id || "Firmware",
    })));
    const completed = completionResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const rejectedCompletions = completionResults.filter((result) => result.status === "rejected");
    state.builds.unshift(...completed);
    renderIdeProjectInformation(project);
    completed.filter((build) => build.status !== "succeeded").forEach((build) => appendBuildFailureLog(build.build_log, build.error));
    completionResults.forEach((result, index) => {
      const label = acceptedBuilds[index].softwareUnit?.title || acceptedBuilds[index].softwareUnit?.software_unit_id || "Firmware";
      if (result.status === "rejected") {
        appendIdeTerminal("error", `Build-Ziel „${label}“: Ergebnis konnte nicht abgerufen werden – ${result.reason?.message || "unbekannter Fehler"}.`);
      } else if (result.value.status === "succeeded") {
        appendIdeTerminal("ok", `Build-Ziel „${label}“: erfolgreich.`);
      } else {
        appendIdeTerminal("error", `Build-Ziel „${label}“: fehlgeschlagen.`);
      }
    });
    rejectedSubmissions.forEach(({ reason, softwareUnit }) => {
      const label = softwareUnit?.title || softwareUnit?.software_unit_id || "Firmware";
      appendIdeTerminal("error", `Build-Ziel „${label}“: Auftrag konnte nicht angelegt werden – ${reason?.message || "unbekannter Fehler"}.`);
    });
    const succeeded = completed.filter((build) => build.status === "succeeded").length;
    const failed = completed.length - succeeded + rejectedSubmissions.length + rejectedCompletions.length;
    if (!failed) completed.forEach(appendBuildMemorySummary);
    const summary = `${succeeded} von ${buildTargets.length} Software-Einheiten erfolgreich`;
    setFlashStatus(
      failed ? "error" : "ok",
      failed ? `Gesamtbuild fehlgeschlagen: ${summary}, ${failed} fehlgeschlagen.` : `Gesamtbuild erfolgreich: ${summary}.`,
    );
    renderBuilds();
  } catch (error) {
    setFlashStatus("error", error.message);
  }
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

async function startUsbFlash(targetConfirmed = false) {
  const project = projectById(state.activeProjectId);
  if (!project) return setFlashStatus("error", "Bitte zuerst ein Projekt öffnen.");
  if (!prepareFlashTarget(project, "usb", targetConfirmed)) return;
  const softwareUnit = activeIdeSoftwareUnit(project);
  const device = allocatedIdeDevice(project);
  const serialServiceAvailable = await state.serialService.available();
  if (!serialServiceAvailable && !navigator.serial) {
    setFlashStatus("error", "Für USB wird Web Serial oder der GerNetiX WebHelper benötigt.");
    showSerialServiceChoiceDialog();
    return;
  }
  if (serialServiceAvailable) {
    await refreshUsbPorts(false);
    if (!state.usbPorts.length) {
      state.pendingUsbFlash = { mode: "start", projectId: project.id };
      showUsbPortMissingGuidance();
      return;
    }
    const resolvedPort = selectedUsbPort()
      || bestUsbPortForDevice(device)?.port
      || (state.usbPorts.length === 1 ? state.usbPorts[0].port : "");
    if (!resolvedPort && state.usbPorts.length > 1) {
      showUsbPortChoiceDialog();
      return;
    }
  }
  setFlashStatus("running", "Echter PlatformIO-Build wird gestartet...");
  let activeBuild = null;
  try {
    await persistCurrentSource(project);
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      software_unit_id: softwareUnit?.software_unit_id || "",
      device_id: device?.device_id || "",
      mode: "build_and_usb_flash",
    });
    activeBuild = await waitForCompletedBuild(build);
    state.builds.unshift(activeBuild);
    renderIdeProjectInformation(project);
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
  } catch (error) {
    if (isUsbPortMissingError(error)) {
      state.pendingUsbFlash = activeBuild?.build_job_id
        ? { mode: "flash", projectId: project.id, build: activeBuild, deviceId: device?.device_id || "" }
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
    setFlashStatus("error", error.message);
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
  for (let attempt = 0; attempt < 600; attempt += 1) {
    appendBuildProgress(current.progress, seenProgress, options);
    if (options.appendMemorySummary !== false && !memorySummaryShown && current.status === "succeeded") {
      appendBuildMemorySummary(current);
      memorySummaryShown = true;
    }
    const otaComplete = build.mode !== "build_and_flash"
      || ["rebooting", "confirmed", "delivered", "succeeded", "failed"].includes(current.flash_status);
    if (["failed", "replaced"].includes(current.status) || (current.status === "succeeded" && otaComplete)) return { ...build, ...current };
    if (attempt % 5 === 0) {
      const waitingForBoard = build.mode === "build_and_flash" && current.status === "succeeded";
      const message = waitingForBoard
        ? `Build fertig. OTA-Auftrag ist ${current.flash_status || "veröffentlicht"}; warte auf das Board... ${attempt}s`
        : `PlatformIO-Build läuft... ${attempt}s`;
      setFlashStatus("running", message);
    }
    await delay(1000);
    current = await getJson(`/api/user-ide/build-jobs/${encodeURIComponent(build.build_deploy_job_id || build.build_job_id)}/status`);
  }
  throw new Error("PlatformIO-Build hat das Zeitlimit überschritten.");
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
  const relevant = lines.filter((line) => /fatal error:|error:|\*\*\*|\[FAILED\]/i.test(line));
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
      reportProgress: (_index, written, total) => {
        const percent = Math.round((written / Math.max(total, 1)) * 100);
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
    renderIdeShell();
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

async function openProjectInIde(projectId) {
  state.activeProjectId = projectId;
  await postJson("/api/platform/workspace-state", {
    lastProjectId: projectId,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(projectId)}`,
  });
  navigate(`/app/ide/?project=${encodeURIComponent(projectId)}`);
  await loadIdeProject();
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

async function flashProvisioningBasissoftware() {
  return deviceOnboarding().flashProvisioningBasissoftware();
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
        <div class="device-card-actions">
          <button class="danger subtle-danger" type="button" data-unpair-device="${escapeHtml(device.account_device_id)}">Zuordnung aufheben</button>
        </div>
      </div>
    </article>
  `).join("") : `<div class="inventory-empty"><strong>Noch keine Boards registriert</strong><span>Öffne „Neues Board hinzufügen“, um ein Gerät zu suchen oder manuell zu erfassen.</span></div>`;
  document.querySelectorAll("[data-unpair-device]").forEach((button) => {
    button.addEventListener("click", () => unpairInventoryDevice(button.dataset.unpairDevice));
  });
  document.querySelectorAll("[data-save-device-profile]").forEach((button) => {
    button.addEventListener("click", () => saveDeviceBasissoftwareProfile(button.dataset.saveDeviceProfile));
  });
}

function deviceBasissoftwareProfileClass(device) {
  return device.instance_configuration?.basissoftware_profile?.class || "full";
}

async function claimFlashboxFromCode(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const claimCode = String(data.get("claim_code") || "").trim();
  if (!claimCode) {
    setFlashboxClaimStatus("error", "Bitte gib den Claim-Code der Flashbox ein.");
    return;
  }
  setFlashboxClaimStatus("running", "Flashbox wird deinem Account zugeordnet...");
  try {
    const result = await postJson("/api/platform/flashbox/claim", { claim_code: claimCode });
    state.devices = state.devices.filter((item) => item.account_device_id !== result.device.account_device_id).concat(result.device);
    state.activeDeviceId = state.activeDeviceId || result.device.device_id;
    renderDevices();
    renderIdeShell();
    renderDashboard();
    form.reset();
    setFlashboxClaimStatus("ok", `${result.device.display_name} ist jetzt im Inventar.`);
  } catch (error) {
    setFlashboxClaimStatus("error", error.message || "Flashbox konnte nicht uebernommen werden.");
  }
}

function setFlashboxClaimStatus(kind, text) {
  const status = document.querySelector("#flashboxClaimStatus");
  if (!status) return;
  status.className = `flash-status ${kind}`;
  status.textContent = text;
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
    renderIdeShell();
    setInventoryStatus(result.requires_usb_reflash ? "running" : "ok", result.message);
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
    renderIdeShell();
    renderDevices();
    renderDashboard();
    setInventoryStatus("ok", `${device.display_name} ist nicht mehr mit diesem Account gekoppelt.`);
  } catch (error) {
    setInventoryStatus("error", error.message);
  }
}

function setInventoryStatus(kind, text) {
  return deviceOnboarding().setInventoryStatus(kind, text);
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
  const artifacts = Array.isArray(build.artifacts) ? build.artifacts : [];
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
  const confirm = document.querySelector("#confirmUsbPortButton");
  if (confirm) confirm.disabled = !select.value;
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
  const status = document.querySelector("#flashStatus");
  if (!dialog) return;
  if (status) {
    status.className = "flash-status hidden";
    status.textContent = "";
  }
  if (checkedAt) checkedAt.textContent = `Automatische Suche um ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}: kein Port erkannt.`;
  if (!dialog.open) dialog.showModal();
  appendIdeTerminal("error", "Kein USB-Port gefunden. Prüfe Kabel, USB-Hub, laufende Firmware, Download-Modus, andere serielle Programme und den GerNetiX Serial Service.");
}

function showUsbPortChoiceDialog() {
  const dialog = document.querySelector("#usbPortChoiceDialog");
  const select = document.querySelector("#usbPortSelect");
  if (!dialog || !select) return;
  const status = document.querySelector("#flashStatus");
  if (status) {
    status.className = "flash-status hidden";
    status.textContent = "";
  }
  if (!dialog.open) dialog.showModal();
  select.focus();
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

function setFlashStatus(kind, text) {
  const status = document.querySelector("#flashStatus");
  status.className = `flash-status ${kind}`;
  status.textContent = text;
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
