const GerNetiXDeviceWifiSetup = (() => {
  let eventsBound = false;
  let currentContext = {};
  let networks = [];
  let running = false;
  let connected = false;
  let currentPorts = [];
  let portIdentification = null;
  let portDetector = null;

  const element = (selector) => document.querySelector(selector);

  function setStatus(kind, message) {
    const status = element("#deviceWifiSetupStatus");
    if (!status) return;
    status.className = `flash-status ${kind || "hidden"}`;
    status.textContent = message || "";
  }

  function portPath(port) {
    return String(port?.path || port?.port || "");
  }

  function portLabel(port) {
    const path = portPath(port);
    const detail = String(port?.label || port?.product || port?.manufacturer || "").trim();
    return detail && detail !== path ? `${detail} · ${path}` : path;
  }

  function selectedPort() {
    return element("#deviceWifiSetupPort")?.value || "";
  }

  function selectedNetwork() {
    const select = element("#deviceWifiSetupSsid");
    if (!select?.value) return null;
    if (select.value === "__manual__") {
      const ssid = element("#deviceWifiSetupManualSsid")?.value.trim() || "";
      return ssid ? { ssid, secure: true } : null;
    }
    return networks.find((network) => network.ssid === select.value) || { ssid: select.value, secure: true };
  }

  function setPortOptions(ports, preferredPort = "") {
    const select = element("#deviceWifiSetupPort");
    if (!select) return;
    const previousPort = preferredPort || select.value;
    select.innerHTML = ports.length
      ? ports.map((port) => `<option value="${escapeAttribute(portPath(port))}">${escapeHtml(portLabel(port))}</option>`).join("")
      : '<option value="">Kein USB-Gerät gefunden</option>';
    if (previousPort && ports.some((port) => portPath(port) === previousPort)) select.value = previousPort;
  }

  function setPortIdentificationStatus(kind, message) {
    const status = element("#deviceWifiPortIdentificationStatus");
    if (!status) return;
    status.className = message ? kind : "hidden";
    status.textContent = message || "";
  }

  function renderPortIdentification() {
    const panel = element("#deviceWifiPortIdentification");
    const button = element("#identifyDeviceWifiPortButton");
    const active = Boolean(portIdentification?.active);
    if (panel) panel.classList.toggle("hidden", currentPorts.length < 2 && !active && !portIdentification?.resultVisible);
    if (button) {
      button.disabled = running || active || currentPorts.length < 2;
      button.textContent = active ? "Portliste wird beobachtet …" : "Durch Abziehen erkennen";
    }
  }

  function stopPortIdentification({ keepResult = false } = {}) {
    portDetector?.stop();
    portIdentification = keepResult && portIdentification
      ? { ...portIdentification, active: false, resultVisible: true }
      : null;
    renderPortIdentification();
    renderActions();
  }

  function ensurePortDetector() {
    if (portDetector || !window.GerNetiXUsbPortDisconnectDetector) return portDetector;
    portDetector = window.GerNetiXUsbPortDisconnectDetector.create({
      listPorts: () => state.serialService.ports(),
      pathOf: portPath,
      labelOf: portLabel,
      onPorts: (ports) => {
        currentPorts = ports;
        setPortOptions(ports, selectedPort());
        renderPortIdentification();
      },
      onState: (event) => {
        if (event.type === "waiting") {
          portIdentification = { active: true, resultVisible: true };
          setPortIdentificationStatus("waiting", "Ziehe jetzt genau das Board ab, dessen Port du zuordnen möchtest …");
        } else if (event.type === "removed") {
          setPortIdentificationStatus("detected", `Erkannt: ${event.label} ist verschwunden. Das war das abgezogene Board. Stecke es jetzt wieder ein; GerNetiX wählt den Port automatisch aus.`);
        } else if (event.type === "identified") {
          portIdentification = { active: false, resultVisible: true, identifiedPort: event.path };
          currentContext.portPath = event.path;
          setPortOptions(currentPorts, event.path);
          setPortIdentificationStatus("identified", `Port zugeordnet und ausgewählt: ${event.path}`);
          setStatus("ok", "Das wieder eingesteckte Board ist ausgewählt. Du kannst jetzt dessen WLANs suchen.");
        } else if (event.type === "error") {
          portIdentification = { active: false, resultVisible: true };
          setPortIdentificationStatus("error", event.message);
        }
        renderPortIdentification();
        renderActions();
      },
    });
    return portDetector;
  }

  function identifyPortByDisconnect() {
    if (currentPorts.length < 2 || portIdentification?.active) return;
    const detector = ensurePortDetector();
    if (!detector) {
      setPortIdentificationStatus("error", "Die USB-Port-Erkennung ist nicht verfügbar. Lade die Seite neu und versuche es erneut.");
      return;
    }
    detector.start(currentPorts);
  }

  function renderActions() {
    const hasPort = Boolean(selectedPort());
    const network = selectedNetwork();
    const identifyingPort = Boolean(portIdentification?.active);
    const scanButton = element("#scanDeviceWifiNetworksButton");
    const connectButton = element("#connectDeviceWifiButton");
    const portSelect = element("#deviceWifiSetupPort");
    const refreshButton = element("#refreshDeviceWifiPortsButton");
    if (portSelect) portSelect.disabled = running || identifyingPort;
    if (refreshButton) refreshButton.disabled = running || identifyingPort;
    if (scanButton) {
      scanButton.disabled = running || identifyingPort || !hasPort;
      scanButton.textContent = running ? "Bitte warten …" : identifyingPort ? "Port wird erkannt …" : "WLANs suchen";
    }
    if (connectButton) {
      connectButton.disabled = running || identifyingPort || connected || !hasPort || !network;
      connectButton.textContent = connected ? "Verbunden" : running ? "Verbindung wird geprüft …" : "Mit WLAN verbinden";
    }
  }

  function renderNetworks() {
    const select = element("#deviceWifiSetupSsid");
    const fields = element("#deviceWifiSetupNetworkFields");
    if (!select || !fields) return;
    fields.classList.remove("hidden");
    select.innerHTML = [
      '<option value="">WLAN auswählen …</option>',
      ...networks.map((network) => `<option value="${escapeAttribute(network.ssid)}">${escapeHtml(network.ssid)}${network.secure === false ? " · offen" : ""}${Number.isFinite(Number(network.rssi)) ? ` · ${escapeHtml(network.rssi)} dBm` : ""}</option>`),
      '<option value="__manual__">Anderes oder verborgenes WLAN …</option>',
    ].join("");
    element("#deviceWifiSetupManualSsidLabel")?.classList.add("hidden");
    renderActions();
  }

  async function refreshPorts() {
    const select = element("#deviceWifiSetupPort");
    if (!select) return;
    running = true;
    select.disabled = true;
    select.innerHTML = '<option value="">Lokaler Serial Service wird geprüft …</option>';
    setStatus("running", "GerNetiX sucht lokal angeschlossene USB-Geräte …");
    renderActions();
    try {
      if (!await state.serialService.available()) {
        throw new Error("Der lokale GerNetiX Serial Service ist nicht erreichbar. Starte ihn über das GerNetiX Desktop-Prozesstool und versuche es erneut.");
      }
      const ports = await state.serialService.ports();
      currentPorts = ports;
      const preferredPort = String(currentContext.portPath || "");
      setPortOptions(ports, preferredPort);
      if (!ports.length) {
        setStatus("error", "Kein USB-Gerät gefunden. Prüfe Kabel und Stromversorgung. Bei fehlerhafter Firmware versetze das Board mit BOOT und RESET in den Download-Modus.");
      } else {
        setStatus("ok", ports.length === 1
          ? "Ein USB-Gerät wurde gefunden. Du kannst jetzt die WLANs suchen."
          : "Mehrere USB-Geräte wurden gefunden. Wähle das Gerät aus, das eingerichtet werden soll.");
      }
    } catch (error) {
      currentPorts = [];
      select.innerHTML = '<option value="">USB-Geräte konnten nicht geladen werden</option>';
      setStatus("error", error.message || "USB-Geräte konnten nicht geladen werden.");
    } finally {
      running = false;
      select.disabled = false;
      renderPortIdentification();
      renderActions();
    }
  }

  async function scan() {
    const port = selectedPort();
    if (!port) return;
    running = true;
    networks = [];
    element("#deviceWifiSetupNetworkFields")?.classList.add("hidden");
    setStatus("running", "Das Gerät sucht sichtbare WLANs …");
    renderActions();
    try {
      const response = await state.serialService.serialRequest(port, "wifi_scan");
      const strongestBySsid = new Map();
      for (const network of (response?.payload?.networks || []).filter((item) => item?.ssid)) {
        const known = strongestBySsid.get(network.ssid);
        if (!known || Number(network.rssi) > Number(known.rssi)) strongestBySsid.set(network.ssid, network);
      }
      networks = [...strongestBySsid.values()].sort((left, right) => Number(right.rssi) - Number(left.rssi));
      renderNetworks();
      setStatus("ok", networks.length
        ? "WLANs gefunden. Wähle das Zielnetzwerk aus."
        : "Kein sichtbares WLAN gefunden. Du kannst ein verborgenes WLAN manuell eingeben.");
    } catch (error) {
      setStatus("error", error.message || "Das Gerät konnte keine WLANs suchen.");
    } finally {
      running = false;
      renderActions();
    }
  }

  async function waitForConnection(port) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await delay(1000);
      const response = await state.serialService.serialRequest(port, "wifi_status");
      const wifiState = response?.payload?.state || "";
      if (wifiState === "connected") return response.payload || {};
      if (wifiState === "failed") {
        const reason = Number(response?.payload?.last_disconnect_reason || 0);
        throw new Error(`Das Gerät konnte keine WLAN-Verbindung aufbauen.${reason ? ` WLAN-Trennungsgrund ${reason}.` : " Prüfe Passwort und Reichweite."}`);
      }
    }
    throw new Error("Das Gerät verbindet noch. Prüfe Reichweite und Zugangsdaten und versuche es erneut.");
  }

  async function connect() {
    const port = selectedPort();
    const network = selectedNetwork();
    const passwordInput = element("#deviceWifiSetupPassword");
    if (!port || !network || !passwordInput) return;
    if (network.secure !== false && !passwordInput.value) {
      setStatus("error", "Bitte das WLAN-Passwort eingeben.");
      return;
    }
    running = true;
    setStatus("running", "WLAN-Daten werden lokal über USB übertragen. Danach prüft GerNetiX die Verbindung …");
    renderActions();
    try {
      try {
        await state.serialService.serialRequest(port, "wifi_connect", { ssid: network.ssid, password: passwordInput.value });
      } catch (error) {
        if (!/nicht rechtzeitig geantwortet/i.test(String(error?.message || ""))) throw error;
      } finally {
        passwordInput.value = "";
      }
      const result = await waitForConnection(port);
      connected = true;
      const address = result.ip || result.ip_address || result.address || "";
      setStatus("ok", `WLAN-Verbindung hergestellt.${address ? ` Das Gerät ist unter ${address} erreichbar.` : ""}`);
      if (typeof currentContext.onConnected === "function") await currentContext.onConnected({ portPath: port, network: network.ssid, status: result });
      window.dispatchEvent(new CustomEvent("gernetix:device-wifi-connected", { detail: { portPath: port, ssid: network.ssid, source: currentContext.source || "manual", status: result } }));
    } catch (error) {
      passwordInput.value = "";
      setStatus("error", error.message || "Das Gerät konnte nicht mit dem WLAN verbunden werden.");
    } finally {
      running = false;
      renderActions();
    }
  }

  async function open(options = {}) {
    stopPortIdentification();
    currentContext = { source: "manual", ...options };
    networks = [];
    running = false;
    connected = false;
    currentPorts = [];
    setPortIdentificationStatus("", "");
    element("#deviceWifiSetupNetworkFields")?.classList.add("hidden");
    element("#deviceWifiSetupManualSsidLabel")?.classList.add("hidden");
    if (element("#deviceWifiSetupManualSsid")) element("#deviceWifiSetupManualSsid").value = "";
    if (element("#deviceWifiSetupPassword")) element("#deviceWifiSetupPassword").value = "";
    const context = element("#deviceWifiSetupContext");
    const contextLabel = String(options.deviceLabel || options.projectLabel || "").trim();
    if (context) {
      context.textContent = contextLabel ? `Einrichtung für: ${contextLabel}` : "";
      context.classList.toggle("hidden", !contextLabel);
    }
    closeMainMenu();
    const dialog = element("#deviceWifiSetupDialog");
    if (!dialog?.open) dialog?.showModal();
    await refreshPorts();
  }

  function close() {
    if (running) return;
    stopPortIdentification();
    const password = element("#deviceWifiSetupPassword");
    if (password) password.value = "";
    element("#deviceWifiSetupDialog")?.close();
  }

  function bind() {
    if (eventsBound) return;
    eventsBound = true;
    element("#deviceWifiSetupDialog")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget || event.target.closest("[data-close-device-wifi-setup]")) close();
    });
    element("#deviceWifiSetupDialog")?.addEventListener("close", () => {
      stopPortIdentification();
      const password = element("#deviceWifiSetupPassword");
      if (password) password.value = "";
    });
    element("#refreshDeviceWifiPortsButton")?.addEventListener("click", refreshPorts);
    element("#identifyDeviceWifiPortButton")?.addEventListener("click", identifyPortByDisconnect);
    element("#scanDeviceWifiNetworksButton")?.addEventListener("click", scan);
    element("#connectDeviceWifiButton")?.addEventListener("click", connect);
    element("#deviceWifiSetupPort")?.addEventListener("change", renderActions);
    element("#deviceWifiSetupSsid")?.addEventListener("change", (event) => {
      element("#deviceWifiSetupManualSsidLabel")?.classList.toggle("hidden", event.target.value !== "__manual__");
      renderActions();
    });
    element("#deviceWifiSetupManualSsid")?.addEventListener("input", renderActions);
  }

  return { bind, close, connect, identifyPortByDisconnect, open, refreshPorts, scan };
})();

window.GerNetiXDeviceWifiSetup = GerNetiXDeviceWifiSetup;
