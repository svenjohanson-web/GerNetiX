const state = {
  session: null,
  processorBoards: [],
  flashboxes: [],
  firmwareArtifact: null,
  flashMode: null,
  serialPort: null,
  serialPortInfo: null,
  flashOperation: null,
  activeTransport: null,
  esptoolModule: null,
};

document.querySelector("#sessionForm").addEventListener("submit", createSession);
document.querySelector("#hardwareClass").addEventListener("change", selectHardwareTarget);
document.querySelector("#processorBoard").addEventListener("change", selectHardwareTarget);
document.querySelector("#flashbox").addEventListener("change", selectHardwareTarget);
document.querySelector("#mqttMode").addEventListener("change", renderMqttMode);
document.querySelector("#credentialResetButton").addEventListener("click", resetActiveCredential);
document.querySelector("#selectUsbDeviceButton").addEventListener("click", selectUsbDevice);
document.querySelector("#usbFlashButton").addEventListener("click", executeUsbFlash);
document.querySelector("#persistDeviceProvisioningButton").addEventListener("click", persistDeviceProvisioning);
document.querySelector("#cancelFlashButton").addEventListener("click", cancelUsbFlash);
document.querySelector("#completeButton").addEventListener("click", completeSession);
bootstrap();

async function bootstrap() {
  const health = await getJson("/health").catch(() => null);
  document.querySelector("#runnerBadge").textContent = health ? "Provisioning Tool" : "Nicht verbunden";
  const boards = await getJson("/api/provisioning-processor-boards").catch(() => ({ items: [] }));
  state.processorBoards = boards.items || [];
  const flashboxes = await getJson("/api/provisioning-flashboxes").catch(() => ({ items: [] }));
  state.flashboxes = flashboxes.items || [];
  state.flashMode = await getJson("/api/provisioning-flash-mode").catch(() => null);
  await restoreSessionFromBrowserState();
  renderHardwareTargets();
  renderMqttMode();
  renderFlashMode();
  await selectHardwareTarget();
  render();
}

async function createSession(event) {
  event.preventDefault();
  setStatus("flashStatus", "running", "Session und USB-Factory-Header werden vorbereitet...");
  try {
    const session = await postJson("/api/provisioning-sessions", {
      hardware_class: selectedHardwareClass(),
      serial_number: value("#serialNumber"),
      hardware_profile_id: value("#hardwareProfile"),
      provisioning_batch_id: value("#batchId"),
      firmware_version: value("#firmwareVersion"),
      provisioned_by: value("#actor"),
      processor_board_id: selectedHardwareClass() === "processor_board" ? value("#processorBoard") : "",
      flashbox_id: selectedHardwareClass() === "flashbox" ? value("#flashbox") : "",
      capabilities: selectedCapabilities(),
      mqtt_mode: value("#mqttMode"),
      service_endpoints: {
        device_management: value("#deviceManagementUrl"),
        build_deploy: value("#buildDeployUrl"),
        mqtt_broker: selectedMqttBrokerUrl(),
      },
      flash: {
        requested: selectedHardwareClass() === "processor_board",
        write_factory_header: selectedHardwareClass() === "processor_board",
      },
    });
    const manifest = await getJson(`/api/provisioning-sessions/${encodeURIComponent(session.session_id)}/manifest`);
    state.session = { ...session, manifest };
    saveBrowserSessionState(state.session);
    state.flashMode = await getJson("/api/provisioning-flash-mode").catch(() => state.flashMode);
    render();
    setStatus("flashStatus", "ok", "Session und USB-Factory-Header wurden vorbereitet. USB-Flash kann gestartet werden, sobald Firmware-Artefakt und USB-Geraet bereit sind.");
  } catch (error) {
    setStatus("flashStatus", "error", error.message);
  }
}

function renderMqttMode() {
  const local = value("#mqttMode") === "local";
  document.querySelector("#mqttVpsField").classList.toggle("hidden", local);
  document.querySelector("#mqttLocalHostField").classList.toggle("hidden", !local);
  document.querySelector("#mqttLocalPortField").classList.toggle("hidden", !local);
}

function selectedMqttBrokerUrl() {
  if (value("#mqttMode") === "vps") {
    const brokerUrl = value("#mqttVpsUrl");
    if (!brokerUrl.startsWith("mqtts://")) throw new Error("Der VPS-Broker muss eine mqtts://-Adresse verwenden.");
    return brokerUrl;
  }
  const host = value("#mqttLocalHost");
  const port = Number(value("#mqttLocalPort"));
  if (!isPrivateIpv4(host)) throw new Error("Bitte eine private IPv4-Adresse des lokalen Brokers eingeben.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Der lokale MQTT-Port muss zwischen 1 und 65535 liegen.");
  return `mqtt://${host}:${port}`;
}

function isPrivateIpv4(value) {
  const octets = String(value).split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

async function resetActiveCredential() {
  const serialNumber = value("#serialNumber");
  if (!serialNumber) {
    setStatus("flashStatus", "error", "Bitte zuerst eine Seriennummer eintragen.");
    return;
  }
  const confirmed = window.confirm(`Aktives Credential fuer ${serialNumber} zuruecksetzen? Danach kann dieses Device neu provisioniert werden.`);
  if (!confirmed) return;
  setStatus("flashStatus", "running", "Aktives Credential wird zurueckgesetzt...");
  try {
    const result = await postJson("/api/provisioning-credentials/reset", {
      serial_number: serialNumber,
      actor: value("#actor"),
      reason: "factory_reprovisioning",
    });
    state.session = null;
    clearBrowserSessionState();
    setStatus("flashStatus", "ok", `Credential zurueckgesetzt: ${result.credential_id}`);
    render();
  } catch (error) {
    setStatus("flashStatus", "error", error.message);
  }
}

async function selectHardwareTarget() {
  const hardwareClass = selectedHardwareClass();
  document.querySelector("#processorBoardField").classList.toggle("hidden", hardwareClass !== "processor_board");
  document.querySelector("#flashboxField").classList.toggle("hidden", hardwareClass !== "flashbox");
  document.querySelector("#serialNumber").value = defaultSerialNumberFor(hardwareClass, value("#serialNumber"));
  const target = selectedHardwareTarget();
  if (!target) return;
  document.querySelector("#hardwareProfile").value = target.hardware_profile_id || target.hardware_item_id;
  state.firmwareArtifact = hardwareClass === "processor_board"
    ? await getJson(`/api/provisioning-firmware-artifact?processor_board_id=${encodeURIComponent(target.hardware_item_id)}`).catch(() => target.factory_firmware_artifact || null)
    : target.factory_firmware_artifact || null;
  state.flashMode = await getJson("/api/provisioning-flash-mode").catch(() => state.flashMode);
  renderFlashMode();
  render();
}

async function executeUsbFlash() {
  if (!state.session) return;
  if (needsUsbTargetSelection()) {
    setStatus("flashStatus", "error", "Bitte waehle zuerst das angeschlossene USB-Geraet im Browser aus.");
    return;
  }
  const operation = startFlashOperation();
  document.querySelector("#usbFlashButton").disabled = true;
  resetFlashProgress();
  renderFlashJob({
    status: "running",
    runner: "web_serial",
    port: selectedUsbPort(),
    percent: 0,
    phase: "starting",
    message: "Browser-USB-Flash wird gestartet...",
    logs: [],
  });
  try {
    const result = await flashEsp32InBrowser(operation);
    if (operation.canceled || state.flashOperation?.id !== operation.id) return;
    const updated = await postJson(`/api/provisioning-sessions/${encodeURIComponent(state.session.session_id)}/browser-usb-flash-result`, {
      status: "flashed",
      actor: value("#actor"),
      port: selectedUsbPort(),
      chip_name: result.chipName || "",
      stdout: result.log || "",
    });
    state.session = updated;
    saveBrowserSessionState(state.session);
    finishFlashOperation();
    renderFlashJob({
      status: "completed",
      runner: "web_serial",
      port: selectedUsbPort(),
      percent: 100,
      phase: "completed",
      message: "Firmware wurde per Browser-USB geflasht.",
      logs: [],
    });
    setStatus("flashStatus", "ok", "Firmware wurde per Browser-USB geflasht.");
  } catch (error) {
    if (operation.canceled || error.name === "AbortError") {
      finishCanceledFlashOperation();
      return;
    }
    await recordBrowserFlashFailure(error);
    setStatus("flashStatus", "error", error.message);
    document.querySelector("#usbFlashButton").disabled = false;
    finishFlashOperation();
  }
}

async function cancelUsbFlash() {
  if (!state.flashOperation) return;
  if (state.flashOperation) {
    state.flashOperation.canceled = true;
    state.flashOperation.abortController.abort();
  }
  if (state.activeTransport) {
    state.activeTransport.disconnect().catch(() => {});
    state.activeTransport = null;
  }
  finishCanceledFlashOperation();
}

async function completeSession() {
  if (!state.session) return;
  setStatus("flashStatus", "running", "Device Management Registrierung wird abgeschlossen...");
  const completed = await postJson(`/api/provisioning-sessions/${encodeURIComponent(state.session.session_id)}/complete`, {
    completed_by: value("#actor"),
    quality_check_state: "passed",
    connectivity_status: "unknown",
    ota_status: "ready",
  });
  const manifest = await getJson(`/api/provisioning-sessions/${encodeURIComponent(completed.session_id)}/manifest`);
  state.session = { ...completed, manifest };
  saveBrowserSessionState(state.session);
  render();
}

async function persistDeviceProvisioning() {
  if (!state.session) return;
  setStatus("deviceProvisioningStatus", "running", "Device-Schluessel wird auf dem Board erzeugt und das mTLS-Zertifikat ausgestellt...");
  try {
    const updated = await postJson(`/api/provisioning-sessions/${encodeURIComponent(state.session.session_id)}/device-provisioning`, {
      actor: value("#actor"),
      device_url: value("#deviceProvisioningUrl"),
    });
    const manifest = await getJson(`/api/provisioning-sessions/${encodeURIComponent(updated.session_id)}/manifest`);
    state.session = { ...updated, manifest };
    saveBrowserSessionState(state.session);
    render();
    setStatus("deviceProvisioningStatus", "ok", "Device-Identitaet und mTLS-Zertifikat wurden dauerhaft eingerichtet.");
  } catch (error) {
    setStatus("deviceProvisioningStatus", "error", error.message);
  }
}

function render() {
  const session = state.session;
  const hardwareClass = session?.device?.hardware_class || selectedHardwareClass();
  const isFlashbox = hardwareClass === "flashbox";
  const flashNeedsArtifact = !state.flashMode?.artifact_ready;
  const flashRunning = Boolean(state.flashOperation);
  document.querySelector("#executionTitle").textContent = isFlashbox ? "Register & Pairing" : "USB-Flash";
  document.querySelector("#selectUsbDeviceButton").disabled = isFlashbox || Boolean(state.flashOperation);
  document.querySelector("#usbFlashButton").textContent = isFlashbox ? "Flashbox-Flash noch nicht aktiv" : "Firmware per USB flashen";
  document.querySelector("#persistDeviceProvisioningButton").textContent = isFlashbox ? "Flashbox-Identitaet speichern" : "Kennung speichern";
  document.querySelector("#completeButton").textContent = isFlashbox ? "Flashbox-Provisionierung abschliessen" : "Provisionierung abschliessen";
  document.querySelector("#usbFlashButton").disabled = isFlashbox || flashRunning || !session || flashNeedsArtifact || needsUsbTargetSelection() || session.status === "completed" || hasUsbFlashSucceeded(session);
  document.querySelector("#persistDeviceProvisioningButton").disabled = flashRunning || !session || session.status === "completed" || hasDeviceProvisioningStored(session);
  document.querySelector("#cancelFlashButton").disabled = !flashRunning;
  document.querySelector("#completeButton").disabled = !session || session.status === "completed" || !hasDeviceProvisioningStored(session);
  renderUsbBrowserStatus();
  renderFirmwareArtifact();
  renderFlashReadinessStatus();
  document.querySelector("#sessionMeta").innerHTML = session ? [
    ["session_id", session.session_id],
    ["status", session.status],
    ["hardware_class", session.device.hardware_class || ""],
    ["device_id", session.device.device_id],
    ["serial_number", session.device.serial_number],
    ["hardware_item", session.device.flashbox_id || session.device.processor_board_id || ""],
    ["credential_id", session.credential.credential_id],
    ["board_storage", session.device.local_provisioning_state || ""],
    ["firmware_artifact", session.manifest?.firmware?.artifact?.artifact_id || state.firmwareArtifact?.artifact_id || ""],
    ["artifact_source", session.manifest?.firmware?.artifact?.source || state.firmwareArtifact?.source || ""],
    ["flash_status", session.flash_plan?.status || ""],
  ].map(meta).join("") : state.firmwareArtifact ? [
    ["firmware_artifact", state.firmwareArtifact.artifact_id],
    ["artifact_source", state.firmwareArtifact.source],
    ["artifact_uri", state.firmwareArtifact.uri],
  ].map(meta).join("") : "";

  hideStatus("secretStatus");

  if (session?.device?.local_provisioning_state === "stored_on_board") {
    setStatus("deviceProvisioningStatus", "ok", "Device-Identität und mTLS-Zertifikat wurden dauerhaft eingerichtet.");
  } else if (session) {
    setStatus("deviceProvisioningStatus", "running", "Nach dem Flash Board booten lassen und Device-Identität einrichten.");
  } else {
    hideStatus("deviceProvisioningStatus");
  }

  const result = session?.usb_flash_result || session?.flash_plan?.last_flash_result;
  if (result) {
    const ok = result.status === "flashed";
    setStatus("flashStatus", ok ? "ok" : "error", `USB-Flash: ${result.status}${result.port ? ` auf ${result.port}` : ""}`);
    if (ok) {
      renderFlashJob({
        status: "completed",
        runner: result.runner,
        port: result.port,
        percent: 100,
        phase: "completed",
        message: `USB-Flash: ${result.status}${result.port ? ` auf ${result.port}` : ""}`,
        logs: [],
      });
    }
  }

  document.querySelector("#detailsBox").textContent = session
    ? JSON.stringify({
        manifest: session.manifest || null,
        flash_plan: session.flash_plan || null,
        usb_flash_result: session.usb_flash_result || null,
        device_management_registration: session.device_management_registration || null,
      }, null, 2)
    : "";
}

function renderFlashReadinessStatus() {
  if (state.flashOperation) return;
  const hardwareClass = state.session?.device?.hardware_class || selectedHardwareClass();
  if (hardwareClass === "flashbox") {
    if (!state.session) {
      setStatus("flashStatus", "running", "Bitte zuerst die Flashbox-Register-Session vorbereiten.");
      return;
    }
    if (hasDeviceProvisioningStored(state.session)) {
      setStatus("flashStatus", "ok", "Flashbox-Identitaet ist gespeichert. Abschluss kann registriert werden.");
      return;
    }
    setStatus("flashStatus", "running", "Flashbox wird als kaufbares Inventar-Geraet registriert. Der Firmware-Flash der Flashbox ist noch kein HMI-Schritt.");
    return;
  }
  if (!state.session) {
    setStatus("flashStatus", "running", "Bitte zuerst die Session vorbereiten.");
    return;
  }
  if (!state.flashMode?.artifact_ready) {
    setStatus("flashStatus", "running", "USB-Flash wartet auf das Firmware-Artefakt.");
    return;
  }
  if (needsUsbTargetSelection()) {
    setStatus("flashStatus", "running", "Bitte USB-Geraet im Browser auswaehlen.");
    return;
  }
  if (state.session.status === "completed" || hasUsbFlashSucceeded(state.session)) {
    return;
  }
  setStatus("flashStatus", "ok", "Browser-USB-Flash kann gestartet werden.");
}

async function selectUsbDevice() {
  if (!("serial" in navigator)) {
    setStatus("usbBrowserStatus", "error", "Dieser Browser unterstuetzt Web Serial nicht. Bitte Chrome oder Edge verwenden.");
    return;
  }
  try {
    state.serialPort = await navigator.serial.requestPort();
    state.serialPortInfo = state.serialPort.getInfo ? state.serialPort.getInfo() : {};
    render();
  } catch (error) {
    if (error.name === "NotFoundError") {
      setStatus("usbBrowserStatus", "running", "Keine USB-Auswahl getroffen.");
      return;
    }
    setStatus("usbBrowserStatus", "error", error.message);
  }
}

function renderUsbBrowserStatus() {
  const hardwareClass = state.session?.device?.hardware_class || selectedHardwareClass();
  if (hardwareClass === "flashbox") {
    document.querySelector("#selectUsbDeviceButton").disabled = true;
    setStatus("usbBrowserStatus", "running", "Fuer Flashbox-Register/Pairing wird hier kein Zielboard per Web Serial geflasht. Die Flashbox-Firmware bekommt spaeter einen eigenen signierten Update-/Recovery-Weg.");
    return;
  }
  if (!("serial" in navigator)) {
    setStatus("usbBrowserStatus", "error", "Web Serial ist nicht verfuegbar. Bitte Chrome oder Edge verwenden.");
    document.querySelector("#selectUsbDeviceButton").disabled = true;
    return;
  }
  document.querySelector("#selectUsbDeviceButton").disabled = Boolean(state.flashOperation);
  if (state.serialPort) {
    setStatus("usbBrowserStatus", "ok", `${selectedUsbPort()} ist im Browser ausgewaehlt.`);
    return;
  }
  setStatus("usbBrowserStatus", "running", "USB-Geraet im Browser auswaehlen. Danach kann die Firmware direkt per USB geflasht werden.");
}

function selectedUsbPort() {
  if (!state.serialPort) return "";
  const info = state.serialPortInfo || {};
  const vendorId = info.usbVendorId === undefined ? "" : info.usbVendorId.toString(16).padStart(4, "0").toUpperCase();
  const productId = info.usbProductId === undefined ? "" : info.usbProductId.toString(16).padStart(4, "0").toUpperCase();
  return vendorId && productId ? `WebSerial ${vendorId}:${productId}` : "WebSerial USB-Geraet";
}

function needsUsbTargetSelection() {
  const hardwareClass = state.session?.device?.hardware_class || selectedHardwareClass();
  if (hardwareClass === "flashbox") return false;
  return !state.serialPort;
}

async function flashEsp32InBrowser(operation) {
  const artifact = state.session?.manifest?.firmware?.artifact || state.firmwareArtifact;
  if (!artifact?.artifact_id) {
    throw new Error("Kein Firmware-Artefakt fuer den Browser-Flash vorhanden.");
  }
  const logLines = [];
  const log = (line) => {
    const text = String(line || "").trimEnd();
    if (!text) return;
    logLines.push(text);
    renderFlashJob({
      status: "running",
      runner: "web_serial",
      port: selectedUsbPort(),
      percent: Number(document.querySelector("#flashProgressPercent").textContent.replace("%", "")) || 0,
      phase: "writing",
      message: text,
      logs: logLines.slice(-30).map((entry) => ({ line: entry })),
    });
  };

  operation.abortController.signal.throwIfAborted?.();
  renderFlashJob({
    status: "running",
    runner: "web_serial",
    port: selectedUsbPort(),
    percent: 5,
    phase: "starting",
    message: "Firmware-Artefakt wird geladen...",
    logs: [],
  });
  const firmware = await fetchFirmwareBytes(artifact.artifact_id, operation.abortController.signal);
  operation.abortController.signal.throwIfAborted?.();
  const { ESPLoader, Transport } = await loadEsptoolModule();
  const transport = new Transport(state.serialPort, false);
  state.activeTransport = transport;
  const terminal = {
    clean() {},
    writeLine(data) {
      log(data);
    },
    write(data) {
      log(data);
    },
  };
  try {
    renderFlashJob({
      status: "running",
      runner: "web_serial",
      port: selectedUsbPort(),
      percent: 10,
      phase: "connecting",
      message: "ESP32 Bootloader wird verbunden...",
      logs: logLines.map((entry) => ({ line: entry })),
    });
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal,
      debugLogging: false,
    });
    const chipName = await loader.main();
    operation.abortController.signal.throwIfAborted?.();
    renderFlashJob({
      status: "running",
      runner: "web_serial",
      port: selectedUsbPort(),
      percent: 20,
      phase: "writing",
      message: `${chipName} verbunden. Firmware wird geschrieben...`,
      logs: logLines.map((entry) => ({ line: entry })),
    });
    await loader.writeFlash({
      fileArray: [{ data: firmware, address: parseFlashOffset(artifact.flash_offset || "0x0") }],
      flashMode: "dio",
      flashFreq: "40m",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (_fileIndex, written, total) => {
        const percent = 20 + Math.round((written / Math.max(total, 1)) * 75);
        renderFlashJob({
          status: "running",
          runner: "web_serial",
          port: selectedUsbPort(),
          percent,
          phase: "writing",
          message: `Firmware schreiben: ${Math.min(100, Math.round((written / Math.max(total, 1)) * 100))}%`,
          logs: logLines.slice(-30).map((entry) => ({ line: entry })),
        });
      },
    });
    operation.abortController.signal.throwIfAborted?.();
    renderFlashJob({
      status: "running",
      runner: "web_serial",
      port: selectedUsbPort(),
      percent: 98,
      phase: "resetting",
      message: "Board wird neu gestartet...",
      logs: logLines.map((entry) => ({ line: entry })),
    });
    await loader.after("hard_reset");
    await transport.disconnect();
    state.activeTransport = null;
    return {
      chipName,
      log: logLines.join("\n"),
    };
  } catch (error) {
    try {
      await transport.disconnect();
    } catch {}
    state.activeTransport = null;
    throw error;
  }
}

async function fetchFirmwareBytes(artifactId, signal) {
  const response = await fetch(`/api/provisioning-firmware-artifacts/${encodeURIComponent(artifactId)}/content`, { signal });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Firmware-Artefakt konnte nicht geladen werden: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function loadEsptoolModule() {
  if (!state.esptoolModule) {
    state.esptoolModule = await import("/vendor/esptool-js/bundle.js");
  }
  return state.esptoolModule;
}

function parseFlashOffset(value) {
  const text = String(value || "0x0").trim();
  const parsed = text.toLowerCase().startsWith("0x") ? Number.parseInt(text, 16) : Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function recordBrowserFlashFailure(error) {
  if (!state.session?.session_id) return;
  try {
    const updated = await postJson(`/api/provisioning-sessions/${encodeURIComponent(state.session.session_id)}/browser-usb-flash-result`, {
      status: "failed",
      actor: value("#actor"),
      port: selectedUsbPort(),
      error: error.message || String(error),
      stderr: error.stack || "",
    });
    state.session = updated;
    saveBrowserSessionState(state.session);
  } catch {}
}

async function restoreSessionFromBrowserState() {
  const sessionId = window.localStorage.getItem("gernetix.provisioning.sessionId") || "";
  if (!sessionId) return;
  try {
    const session = await getJson(`/api/provisioning-sessions/${encodeURIComponent(sessionId)}`);
    const manifest = await getJson(`/api/provisioning-sessions/${encodeURIComponent(sessionId)}/manifest`);
    state.session = { ...session, manifest };
    if (session.device?.hardware_class) document.querySelector("#hardwareClass").value = session.device.hardware_class;
  } catch {
    clearBrowserSessionState();
  }
}

function saveBrowserSessionState(session) {
  if (!session?.session_id) return;
  window.localStorage.setItem("gernetix.provisioning.sessionId", session.session_id);
}

function clearBrowserSessionState() {
  window.localStorage.removeItem("gernetix.provisioning.sessionId");
}

function hasUsbFlashSucceeded(session) {
  const result = session?.usb_flash_result || session?.flash_plan?.last_flash_result;
  return session?.flash_plan?.status === "usb_flashed" && result?.status === "flashed";
}

function hasDeviceProvisioningStored(session) {
  return session?.device?.local_provisioning_state === "stored_on_board";
}

function renderHardwareTargets() {
  const select = document.querySelector("#processorBoard");
  select.innerHTML = state.processorBoards.map((board) => `
    <option value="${escapeHtml(board.hardware_item_id)}">${escapeHtml(board.title || board.hardware_item_id)}</option>
  `).join("");
  const flashboxSelect = document.querySelector("#flashbox");
  flashboxSelect.innerHTML = state.flashboxes.map((flashbox) => `
    <option value="${escapeHtml(flashbox.hardware_item_id)}">${escapeHtml(flashbox.title || flashbox.hardware_item_id)}</option>
  `).join("");
}

function selectedHardwareClass() {
  return value("#hardwareClass") === "flashbox" ? "flashbox" : "processor_board";
}

function selectedHardwareTarget() {
  if (selectedHardwareClass() === "flashbox") {
    return state.flashboxes.find((item) => item.hardware_item_id === value("#flashbox")) || state.flashboxes[0] || null;
  }
  return state.processorBoards.find((item) => item.hardware_item_id === value("#processorBoard")) || state.processorBoards[0] || null;
}

function selectedCapabilities() {
  if (selectedHardwareClass() === "flashbox") {
    const target = selectedHardwareTarget();
    return Array.isArray(target?.capabilities) && target.capabilities.length
      ? target.capabilities
      : ["flashbox.self_update", "flashbox.usb_otg_host", "flashbox.target_flash", "flashbox.signed_manifest_download"];
  }
  return ["wifi", "ota", "mqtt", "flash_firmware"];
}

function defaultSerialNumberFor(hardwareClass, current) {
  if (hardwareClass === "flashbox" && /^GNX-ESP32-/i.test(current)) return "GNX-FLASHBOX-0001";
  if (hardwareClass === "processor_board" && /^GNX-FLASHBOX-/i.test(current)) return "GNX-ESP32-0002";
  return current;
}

function renderFlashMode() {
  if (!state.flashMode) return;
  const text = state.flashMode.artifact_ready
    ? "Browser-USB-Flash ist bereit, sobald ein USB-Geraet ausgewaehlt ist."
    : "Browser-USB-Flash wartet auf das Firmware-Artefakt.";
  setStatus("flashStatus", state.flashMode.artifact_ready ? "ok" : "running", text);
}

function renderFirmwareArtifact() {
  const hardwareClass = state.session?.device?.hardware_class || selectedHardwareClass();
  const artifact = state.session?.manifest?.firmware?.artifact || state.firmwareArtifact;
  document.querySelector("#firmwareArtifactMeta").innerHTML = artifact ? [
    ["artifact_id", artifact.artifact_id || ""],
    ["source", artifact.source || ""],
    ["uri", artifact.uri || ""],
    ["version", artifact.version || ""],
    ["sha256", artifact.sha256 || ""],
  ].map(meta).join("") : "";

  if (!artifact?.artifact_id) {
    if (hardwareClass === "flashbox") {
      setStatus("firmwareArtifactStatus", "running", "Flashbox-Firmware ist als eigenes Paket geplant; diese Register-Session legt zunaechst Inventar, Seriennummer und Geraeteidentitaet fest.");
      return;
    }
    setStatus("firmwareArtifactStatus", "error", "Kein Firmware-Artefakt fuer das gewaehlte Board bekannt.");
    return;
  }
  if (state.flashMode?.artifact_ready) {
    setStatus("firmwareArtifactStatus", "ok", "Firmware-Artefakt ist serverseitig vorhanden.");
    return;
  }
  setStatus(
    "firmwareArtifactStatus",
    "running",
    "Firmware-Artefakt ist nur referenziert. Es muss im SQLite Artifact Store liegen oder per PROVISIONING_FIRMWARE_FILE_PATH vom Server geladen werden.",
  );
}

function startFlashOperation() {
  const operation = {
    id: `flash-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    canceled: false,
    abortController: new AbortController(),
  };
  state.flashOperation = operation;
  render();
  return operation;
}

function finishFlashOperation() {
  state.flashOperation = null;
  render();
}

function finishCanceledFlashOperation() {
  state.flashOperation = null;
  renderFlashJob({
    status: "canceled",
    runner: "web_serial",
    port: selectedUsbPort(),
    percent: 0,
    phase: "failed",
    message: "USB-Flash wurde lokal abgebrochen.",
    logs: [],
  });
  setStatus("flashStatus", "error", "USB-Flash wurde lokal abgebrochen.");
  render();
}

function resetFlashProgress() {
  const progress = document.querySelector("#flashProgress");
  progress.classList.remove("hidden");
  document.querySelector("#flashProgressBar").style.width = "0%";
  document.querySelector("#flashProgressPercent").textContent = "0%";
  document.querySelector("#flashProgressText").textContent = "";
  document.querySelector(".progress-track").setAttribute("aria-valuenow", "0");
}

function renderFlashJob(job) {
  const percent = Math.max(0, Math.min(100, Number(job.percent || 0)));
  const progress = document.querySelector("#flashProgress");
  progress.classList.remove("hidden");
  document.querySelector("#flashProgressLabel").textContent = flashPhaseLabel(job.phase, job.runner);
  document.querySelector("#flashProgressPercent").textContent = `${percent}%`;
  document.querySelector("#flashProgressBar").style.width = `${percent}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", String(percent));
  document.querySelector("#flashProgressText").textContent = job.message || "";
  const statusKind = job.status === "failed" ? "error" : job.status === "completed" ? "ok" : "running";
  setStatus("flashStatus", statusKind, job.status === "failed"
    ? formatFlashJobFailure(job)
    : `${job.runner || "usb"}${job.port ? ` auf ${job.port}` : ""}: ${job.message || job.status}`);
  document.querySelector("#detailsBox").textContent = JSON.stringify({
    flash_job: {
      job_id: job.job_id || "",
      status: job.status,
      runner: job.runner,
      port: job.port,
      percent,
      phase: job.phase,
      message: job.message,
      started_at: job.started_at || "",
      updated_at: job.updated_at || "",
      completed_at: job.completed_at || "",
      recent_log: (job.logs || []).slice(-30),
      error: job.error || null,
    },
    result: job.result?.usb_flash_result || null,
  }, null, 2);
}

function formatFlashJobFailure(job = {}) {
  const result = job.result?.usb_flash_result || {};
  const error = job.error || {};
  const exitText = result.exit_code !== undefined && result.exit_code !== null
    ? `Exit-Code ${result.exit_code}`
    : "";
  const signalText = result.signal ? `Signal ${result.signal}` : "";
  const tail = lastLogLine(job.logs) || error.message || lastTextLine(result.stderr) || lastTextLine(result.stdout);
  const detail = tail || job.message || "Kein Detail-Log vom Flash-Prozess erhalten.";
  return [
    "USB-Flash fehlgeschlagen",
    job.runner || result.runner || "",
    job.port || result.port ? `auf ${job.port || result.port}` : "",
    exitText || signalText,
    detail,
  ].filter(Boolean).join(" - ");
}

function lastLogLine(logs = []) {
  const entry = logs.slice().reverse().find((item) => item.line && item.type !== "result");
  return entry?.line || "";
}

function lastTextLine(value = "") {
  const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

function flashPhaseLabel(phase, runner) {
  const labels = {
    queued: "USB-Flash wartet",
    starting: "USB-Flash startet",
    connecting: "Board verbinden",
    uploading_stub: "Flash-Stub laden",
    stub_running: "Flash-Stub bereit",
    configuring_flash: "Flash konfigurieren",
    erasing: "Flash loeschen",
    writing: "Firmware schreiben",
    verifying: "Firmware pruefen",
    resetting: "Board neu starten",
    finishing: "Abschluss",
    completed: "USB-Flash abgeschlossen",
    failed: "USB-Flash fehlgeschlagen",
  };
  return labels[phase] || "USB-Flash";
}

function setStatus(id, kind, text) {
  const node = document.querySelector(`#${id}`);
  node.className = `status ${kind}`;
  node.textContent = text;
}

function hideStatus(id) {
  const node = document.querySelector(`#${id}`);
  node.className = "status hidden";
  node.textContent = "";
}

function meta([label, value]) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

async function postJson(url, body, options = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
