(() => {
  const state = { port: null, reader: null, keepReading: false };
  const connectButton = document.querySelector("#connect");
  const resetButton = document.querySelector("#reset");
  const disconnectButton = document.querySelector("#disconnect");
  const scanButton = document.querySelector("#scan");
  const statusButton = document.querySelector("#status");
  const connectionState = document.querySelector("#connection-state");
  const scanState = document.querySelector("#scan-state");
  const networks = document.querySelector("#networks");
  const log = document.querySelector("#log");

  function writeLog(message) {
    log.textContent += `${new Date().toLocaleTimeString()}  ${message}\n`;
    log.scrollTop = log.scrollHeight;
  }

  function updateUi() {
    const connected = Boolean(state.port?.readable && state.port?.writable);
    connectButton.disabled = connected;
    resetButton.disabled = !connected;
    disconnectButton.disabled = !connected;
    scanButton.disabled = !connected;
    statusButton.disabled = !connected;
    connectionState.textContent = connected ? "Verbunden" : "Nicht verbunden";
  }

  function showNetworks(items) {
    networks.replaceChildren();
    if (!items.length) {
      networks.innerHTML = "<li>Keine WLANs sichtbar.</li>";
      return;
    }
    for (const network of items) {
      const entry = document.createElement("li");
      entry.textContent = `${network.ssid || "(verborgen)"} · ${network.rssi} dBm${network.secure ? " · gesichert" : " · offen"}`;
      networks.append(entry);
    }
  }

  async function readLoop() {
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (state.keepReading && state.port?.readable) {
        const result = await state.reader.read();
        if (result.done) break;
        pending += decoder.decode(result.value, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || "";
        for (const line of lines) {
          if (!line) continue;
          writeLog(`← ${line}`);
          try {
            const message = JSON.parse(line);
            if (message.type === "gernetix.serial_provisioning" && message.event === "wifi_networks") {
              showNetworks(message.payload?.networks || []);
              scanState.textContent = "Antwort erhalten.";
            }
            if (message.type === "gernetix.serial_provisioning" && message.event === "wifi_status") {
              scanState.textContent = `Boardstatus: ${message.payload?.state || "unbekannt"}`;
            }
          } catch { /* Boot- und Diagnoseausgaben bleiben als Rohtext sichtbar. */ }
        }
      }
    } catch (error) {
      writeLog(`LESEN FEHLER: ${error.message}`);
    }
  }

  async function connect() {
    if (!("serial" in navigator)) {
      connectionState.textContent = "Web Serial wird von diesem Browser nicht unterstützt.";
      return;
    }
    try {
      state.port = await navigator.serial.requestPort();
      await state.port.open({ baudRate: 115200, bufferSize: 8192 });
      state.keepReading = true;
      state.reader = state.port.readable.getReader();
      void readLoop();
      const info = state.port.getInfo?.() || {};
      writeLog(`Port geöffnet: USB ${Number(info.usbVendorId || 0).toString(16)}:${Number(info.usbProductId || 0).toString(16)}`);
    } catch (error) {
      writeLog(`VERBINDUNG FEHLER: ${error.message}`);
      state.port = null;
    }
    updateUi();
  }

  async function disconnect() {
    state.keepReading = false;
    try { await state.reader?.cancel(); } catch {}
    try { state.reader?.releaseLock(); } catch {}
    try { await state.port?.close(); } catch {}
    state.reader = null;
    state.port = null;
    writeLog("Port geschlossen.");
    updateUi();
  }

  async function resetBoard() {
    if (!state.port) return;
    resetButton.disabled = true;
    writeLog("→ Normalstart-Reset wird ausgelöst …");
    try {
      // GPIO0 bleibt freigegeben (DTR=false).  RTS pulst EN wie der
      // Hardware-Resetknopf, damit der ESP32 normal aus Flash startet.
      await state.port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await state.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      writeLog("→ Reset freigegeben – warte auf Boot-Ausgaben …");
    } catch (error) {
      writeLog(`RESET FEHLER: ${error.message}`);
    } finally {
      updateUi();
    }
  }

  async function sendCommand(action) {
    if (!state.port?.writable) return;
    scanButton.disabled = true;
    statusButton.disabled = true;
    scanState.textContent = action === "wifi_scan" ? "SSID-Suche wird gesendet …" : "WLAN-Status wird abgefragt …";
    const requestId = `webserial-test-${Date.now()}`;
    const command = `${JSON.stringify({ type: "gernetix.serial_provisioning", action, request_id: requestId })}\n`;
    try {
      const writer = state.port.writable.getWriter();
      await writer.write(new TextEncoder().encode(command));
      writeLog(`→ ${action}, request_id=${requestId}`);
      writer.releaseLock();
      scanState.textContent = "Gesendet – warte auf Rohantwort …";
    } catch (error) {
      writeLog(`SENDEN FEHLER: ${error.message}`);
      scanState.textContent = "Senden fehlgeschlagen.";
    } finally {
      updateUi();
    }
  }

  connectButton.addEventListener("click", connect);
  resetButton.addEventListener("click", resetBoard);
  disconnectButton.addEventListener("click", disconnect);
  scanButton.addEventListener("click", () => sendCommand("wifi_scan"));
  statusButton.addEventListener("click", () => sendCommand("wifi_status"));
  updateUi();
})();
