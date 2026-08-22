import { GerNetiXSerialService } from "@app/serial-service-client.js";

(function initializeGuidedNexiSetup() {
  "use strict";

  const root = document.querySelector("[data-nexi-guided-setup]");
  if (!root) return;

  const nativeFactory = GerNetiXSerialService;
  const hasWebSerial = "serial" in navigator;
  const serial = hasWebSerial ? createWebSerialTransport() : (nativeFactory ? nativeFactory.create() : null);
  const portSelect = root.querySelector("[data-setup-port]");
  const refreshButton = root.querySelector("[data-setup-refresh]");
  const guideButton = root.querySelector("[data-setup-guide]");
  const repeatButton = root.querySelector("[data-setup-repeat]");
  const progress = root.querySelector("[data-setup-progress]");
  const status = root.querySelector("[data-setup-status]");
  const phrase = root.querySelector("[data-setup-phrase]");
  const action = root.querySelector("[data-setup-action]");
  const references = root.querySelector("[data-setup-references]");
  const stepBar = root.querySelector("[data-setup-step-bar]");
  let busy = false;
  let pollingTimer = null;
  let pollInFlight = false;

  if (!serial) {
    status.textContent = "Dieser Browser unterstützt weder WebSerial noch den GerNetiX Serial Service. Öffne diese Seite in Chrome oder Edge, oder installiere den GerNetiX Serial Service.";
    root.dataset.setupState = "error";
    portSelect.disabled = true;
    refreshButton.disabled = true;
    guideButton.disabled = true;
    repeatButton.disabled = true;
    return;
  }

  function selectedPort() {
    return portSelect.value || "";
  }

  function explainError(error) {
    if (error?.code === "serial_transport_unavailable") {
      return "Dieser Browser unterstützt weder WebSerial noch den GerNetiX Serial Service. Öffne diese Seite in Chrome oder Edge, oder installiere den GerNetiX Serial Service.";
    }
    if (error?.code === "serial_permission_declined") {
      return "Für die Verbindung wurde kein Board ausgewählt. Klicke „Neu suchen“ und wähle das Board in der Browser-Anfrage aus.";
    }
    if (error?.code === "serial_request_timeout" || error?.code === "serial_service_request_timeout") {
      return "Nexi antwortet noch nicht. Drücke RESET, warte kurz und suche das Board erneut.";
    }
    if (error?.code === "serial_port_not_available") {
      return "Das ausgewählte Board ist nicht mehr verbunden. Prüfe das USB-Kabel und suche erneut.";
    }
    if (error?.code === "serial_request_rejected") {
      return "Diese Firmware kennt die geführte Einrichtung noch nicht. Flashe zuerst den aktuellen Nexi-Build.";
    }
    return "Der lokale USB-Dienst oder Nexi ist nicht erreichbar. Prüfe Kabel und GerNetiX Serial Service.";
  }

  function boardRequest(command, timeoutMs = 10000) {
    const port = selectedPort();
    if (!port) throw Object.assign(new Error("port_missing"), { code: "serial_port_not_available" });
    return serial.serialRequest(port, command, {}, { timeoutMs });
  }

  function render(payload) {
    const audioState = String(payload.audio_state || "");
    const audioStateLabel = audioState === "ready"
      ? "Lautsprecher bereit"
      : audioState === "unavailable"
        ? "Lautsprecher nicht verfügbar"
        : audioState === "not_played"
          ? "Lautsprecher noch nicht angesprochen"
          : "Lautsprecherstatus unbekannt";
    const stepIndex = Math.max(0, Number(payload.step_index) || 0);
    const stepCount = Math.max(1, Number(payload.step_count) || 8);
    const referenceIndex = Math.max(0, Number(payload.reference_index) || 0);
    const referenceCount = Math.max(1, Number(payload.reference_count) || 2);
    const complete = payload.complete === true;
    root.dataset.setupState = String(payload.state || "starting");
    progress.textContent = complete
      ? "Einrichtung abgeschlossen"
      : stepIndex > 0
        ? `Satz ${stepIndex} von ${stepCount}`
        : "Nexi startet";
    phrase.textContent = payload.phrase ? `„${payload.phrase}“` : "Noch kein Satz aktiv";
    phrase.hidden = !payload.phrase;
    status.textContent = `${String(payload.instruction || "Nexi bereitet die Einrichtung vor …")} (${audioStateLabel})`;
    action.textContent = payload.expected_action === "press_and_hold_key2"
      ? "Jetzt KEY2 gedrückt halten"
      : payload.expected_action === "release_key2"
        ? "Sprechen und KEY2 loslassen"
        : payload.expected_action === "restart_device"
          ? "Nexi neu starten"
          : complete ? "Nexi ist bereit" : "Einen Moment warten";
    references.textContent = stepIndex > 0 && !complete
      ? `Aufnahme ${Math.min(referenceIndex, referenceCount)} von ${referenceCount}`
      : complete ? "Alle acht Sätze lokal gespeichert" : "";
    stepBar.style.setProperty("--setup-progress", `${complete ? 100 : (Math.max(0, stepIndex - 1) / stepCount) * 100}%`);
    repeatButton.disabled = busy || !selectedPort();
  }

  function updateControls() {
    const hasPort = Boolean(selectedPort());
    portSelect.disabled = busy;
    refreshButton.disabled = busy;
    guideButton.disabled = busy || !hasPort;
    repeatButton.disabled = busy || !hasPort;
    guideButton.textContent = "Nexi-Anleitung läuft automatisch";
  }

  function applyGuidedSetupPayload(response) {
    const responsePayloadData = response && typeof response.payload === "object" ? response.payload : {};
    if (responsePayloadData.schema_version !== 1) {
      throw Object.assign(new Error("unsupported_setup_schema"), { code: "serial_request_rejected" });
    }
    render(responsePayloadData);
    return responsePayloadData;
  }

  async function readStatus() {
    return applyGuidedSetupPayload(await boardRequest("nexi_setup_status"));
  }

  async function triggerSpeakPrompt() {
    return applyGuidedSetupPayload(await boardRequest("nexi_setup_repeat"));
  }

  function startPolling() {
    globalThis.clearInterval(pollingTimer);
    pollingTimer = globalThis.setInterval(async () => {
      if (busy || pollInFlight || !selectedPort() || document.hidden) return;
      pollInFlight = true;
      try {
        await readStatus();
      } catch (error) {
        status.textContent = explainError(error);
        root.dataset.setupState = "error";
      } finally {
        pollInFlight = false;
      }
    }, 750);
  }

  async function refreshPorts(options = {}) {
    if (busy) return;
    busy = true;
    status.textContent = "Suche angeschlossene Boards …";
    updateControls();
    try {
      const previous = selectedPort();
      const ports = await serial.ports(options);
      portSelect.replaceChildren();
      for (const port of ports) {
        const option = document.createElement("option");
        option.value = String(port.path || port.port || "");
        option.textContent = String(port.label || option.value);
        portSelect.append(option);
      }
      if (previous && ports.some((port) => (port.path || port.port) === previous)) {
        portSelect.value = previous;
      }
      if (!ports.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Kein Board gefunden";
        portSelect.append(option);
        status.textContent = "Verbinde Nexi mit einem USB-Datenkabel und suche erneut.";
        root.dataset.setupState = "error";
      } else {
        await readStatus();
        startPolling();
      }
    } catch (error) {
      status.textContent = explainError(error);
      root.dataset.setupState = "error";
    } finally {
      busy = false;
      updateControls();
    }
  }

  refreshButton.addEventListener("click", () => refreshPorts({ allowPrompt: true }));
  portSelect.addEventListener("change", async () => {
    try { await readStatus(); startPolling(); }
    catch (error) { status.textContent = explainError(error); root.dataset.setupState = "error"; }
    updateControls();
  });
  guideButton.addEventListener("click", async () => {
    updateControls();
    try { await readStatus(); }
    catch (error) { status.textContent = explainError(error); root.dataset.setupState = "error"; }
  });
  repeatButton.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    updateControls();
    try { await triggerSpeakPrompt(); }
    catch (error) { status.textContent = explainError(error); root.dataset.setupState = "error"; }
    finally { busy = false; updateControls(); }
  });
  globalThis.addEventListener("pagehide", () => {
    globalThis.clearInterval(pollingTimer);
  });

  updateControls();
  refreshPorts();

  function createWebSerialTransport() {
    const portMap = new Map();

    function describePort(port, index) {
      const info = port.getInfo ? port.getInfo() : {};
      const vendorHex = info.usbVendorId !== undefined ? info.usbVendorId.toString(16).padStart(4, "0") : "0000";
      const productHex = info.usbProductId !== undefined ? info.usbProductId.toString(16).padStart(4, "0") : "0000";
      return { key: `webserial:${vendorHex}:${productHex}:${index}`, vendorId: info.usbVendorId, productId: info.usbProductId };
    }

    async function ports(options = {}) {
      portMap.clear();
      let candidatePorts = await navigator.serial.getPorts();
      if (!candidatePorts.length && options.allowPrompt) {
        try {
          candidatePorts = [await navigator.serial.requestPort()];
        } catch (error) {
          if (error?.name !== "NotFoundError") throw error;
          candidatePorts = [];
        }
      }
      return candidatePorts.map((port, index) => {
        const { key, vendorId, productId } = describePort(port, index);
        portMap.set(key, { port, vendorId, productId });
        return { path: key, label: `USB-Board ${index + 1} (WebSerial)` };
      });
    }

    async function ensureConnection(key) {
      const entry = portMap.get(key);
      if (!entry) throw Object.assign(new Error("port_missing"), { code: "serial_port_not_available" });
      let { port } = entry;
      if (port.readable && port.writable) return { port, openedHere: false };
      try { await port.close(); } catch { /* Port war bereits geschlossen. */ }
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 500));
        try {
          const replacement = (await navigator.serial.getPorts()).find((candidate) => {
            const info = candidate.getInfo ? candidate.getInfo() : {};
            return info.usbVendorId === entry.vendorId && info.usbProductId === entry.productId;
          });
          if (replacement) {
            port = replacement;
            entry.port = replacement;
          }
          await port.open({ baudRate: 115200 });
          return { port, openedHere: true };
        } catch (cause) {
          if (port.readable && port.writable) return { port, openedHere: false };
          if (attempt === 3) {
            throw Object.assign(
              new Error("Die USB-Verbindung zum Board konnte nach dem Reset nicht neu geöffnet werden."),
              { code: "serial_port_not_available", cause },
            );
          }
          try { await port.close(); } catch { /* Wird im naechsten Versuch erneut geoeffnet. */ }
        }
      }
      throw Object.assign(new Error("port_unreachable"), { code: "serial_port_not_available" });
    }

    async function serialRequest(key, action, payload = {}, options = {}) {
      const requestId = crypto.randomUUID();
      const timeoutMs = Math.max(1, Number(options.timeoutMs) || 10000);
      let reader = null;
      let writer = null;
      let openedHere = false;
      let port = null;
      try {
        const connection = await ensureConnection(key);
        port = connection.port;
        openedHere = connection.openedHere;
        reader = port.readable.getReader();
        writer = port.writable.getWriter();
        const command = new TextEncoder().encode(
          `${JSON.stringify({ type: "gernetix.serial_provisioning", action, request_id: requestId, ...payload })}\n`,
        );
        await writer.write(command);
        const decoder = new TextDecoder();
        let buffer = "";
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const result = await Promise.race([
            reader.read(),
            new Promise((resolve) => globalThis.setTimeout(() => resolve({ timeout: true }), Math.max(1, deadline - Date.now()))),
          ]);
          if (result?.timeout || result.done) break;
          buffer += decoder.decode(result.value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            let message;
            try { message = JSON.parse(line); } catch { continue; }
            if (message.type !== "gernetix.serial_provisioning" || message.request_id !== requestId) continue;
            if (message.event === "error") {
              throw Object.assign(new Error("Das Board hat die Anfrage abgelehnt."), { code: "serial_request_rejected" });
            }
            return message;
          }
        }
        throw Object.assign(new Error("Das Board hat nicht rechtzeitig geantwortet."), { code: "serial_request_timeout" });
      } finally {
        try { await reader?.cancel(); } catch { /* Reader ist bereits geschlossen. */ }
        try { reader?.releaseLock(); } catch { /* Reader-Lock ist bereits frei. */ }
        try { writer?.releaseLock(); } catch { /* Writer-Lock ist bereits frei. */ }
        if (openedHere) { try { await port.close(); } catch { /* Port ist bereits geschlossen. */ } }
      }
    }

    return { ports, serialRequest };
  }
})();
