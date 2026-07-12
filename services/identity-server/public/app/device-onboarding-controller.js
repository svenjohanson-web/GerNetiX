const DeviceOnboardingController = (() => {
  function create(deps) {
    const {
      state,
      model,
      getJson,
      postJson,
      delay,
      fallbackProcessorBoards,
      renderDashboard,
      renderDevices,
      renderEsp32UsbPortOptions,
      renderIdeShell,
      renderInventoryUsbPortOptions,
      escapeHtml,
      meta,
    } = deps;

    async function discoverNetworkDevices() {
      const board = selectedInventoryBoard();
      if (board && !model.allowedActions(board).wifiDiscovery) {
        setDiscoveryStatus("running", "Dieser Hardware-Typ bietet laut Katalog keine WLAN-Suche.");
        return;
      }
      state.inventoryEsp32Method = "wlan";
      state.discoveredDevices = [];
      renderNetworkDiscovery();
      setDiscoveryStatus("running", "Lokales Netzwerk wird nach gernetix-* Nodes durchsucht...");
      try {
        const family = board ? selectedInventoryHardwareFamily() : "";
        const query = family ? `?processor_family=${encodeURIComponent(family)}` : "";
        const result = await getJson(`/api/platform/devices/discover${query}`);
        state.discoveredDevices = (result.items || []).filter((device) => {
          if (!family) return true;
          const detected = hardwareTypeForProfile(device.hardware_profile_id);
          return detected === family || detected === "unknown" || family === "other";
        });
        renderNetworkDiscovery();
        const found = state.discoveredDevices.length;
        setDiscoveryStatus("ok", found
          ? `${found} Board${found === 1 ? "" : "s"} gefunden. Markiere die Boards, die auf dein Konto laufen sollen.`
          : "Noch kein gernetix-* Node gefunden. Das Board muss im gleichen Kunden-WLAN erreichbar sein; fuer USB-Zustaende nutze die USB-Methode.");
      } catch (error) {
        setDiscoveryStatus("error", error.message);
      }
    }

    async function identifyEsp32Bootloader() {
      const board = selectedInventoryBoard();
      if (board && !model.allowedActions(board).usbIdentification) {
        setDiscoveryStatus("running", "USB-Pruefung ist fuer diesen Hardware-Typ im Katalog nicht vorgesehen.");
        return;
      }
      if (state.inventoryEsp32Method !== "usb") {
        state.inventoryEsp32Method = "usb";
        state.discoveredDevices = [];
        renderNetworkDiscovery();
        setDiscoveryStatus("running", "USB gewaehlt. Bitte USB-Port auswaehlen und erneut pruefen.");
        return;
      }
      const port = document.querySelector("#esp32UsbPort").value;
      const ports = port
        ? state.usbPorts.filter((item) => item.port === port || item.path === port).concat({ port, name: "Manuell ausgewaehlter USB-Port" }).slice(0, 1)
        : usbDiscoveryPorts();
      if (!ports.length) {
        setDiscoveryStatus("error", "Keine passende USB-Serial-Schnittstelle gefunden. Bitte Board per USB anschliessen und erneut suchen.");
        return;
      }
      state.discoveredDevices = ports.map((usbPort) => ({
        discovery_id: `bootloader-browser-${usbPort.port}`,
        source_url: usbPort.port,
        display_name: `${usbDiscoveryLabel(usbPort, board)} per Browser-Web-Serial`,
        hardware_profile_id: board?.hardware_item_id || board?.hardware_profile_id || usbHardwareProfileForPort(usbPort),
        runtime_version: "",
        firmware_version: "",
        provisioning_state: "bootloader_check_required",
        connectivity_status: "usb_browser_required",
        ownership_status: "unregistered",
        esp32_inventory_state: "bootloader_only",
        treatment: "USB-Serial-Port anhand bekannter Adapter-/Board-Strings gefunden. Per Browser-Web-Serial pruefen oder Basissoftware flashen; danach im Kunden-WLAN erneut suchen.",
        already_in_inventory: false,
      }));
      renderNetworkDiscovery();
      setDiscoveryStatus("ok", `${state.discoveredDevices.length} USB-Kandidat${state.discoveredDevices.length === 1 ? "" : "en"} gefunden. Markiere die Boards, die auf dein Konto laufen sollen.`);
    }

    function selectDeviceDiscoveryMethod() {
      const select = document.querySelector("#deviceDiscoveryMethod");
      state.inventoryEsp32Method = select?.value || "";
      if (state.inventoryEsp32Method) state.discoveredDevices = [];
      renderNetworkDiscovery();
      setDiscoveryStatus("running", state.inventoryEsp32Method === "usb"
        ? "USB ausgewaehlt. Waehle bei Bedarf den USB-Port und klicke auf Suchen."
        : "WLAN ausgewaehlt. Klicke auf Suchen, um gernetix-* Nodes im Netzwerk zu finden.");
    }

    async function searchDevicesForInventory() {
      const method = document.querySelector("#deviceDiscoveryMethod")?.value || state.inventoryEsp32Method || "wlan";
      state.inventoryEsp32Method = method;
      if (method === "usb") return identifyEsp32Bootloader();
      return discoverNetworkDevices();
    }

    async function identifyAvrBootloaderExperimental() {
      if (!("serial" in navigator)) {
        setDiscoveryStatus("error", "Dieser Browser unterstuetzt Web Serial nicht. Bitte Chrome oder Edge auf Desktop verwenden.");
        return;
      }
      setDiscoveryStatus("running", "Arduino-Nano-Bootloader wird experimentell per Browser-Web-Serial geprueft...");
      state.avrBootloaderResult = null;
      try {
        const port = await navigator.serial.requestPort();
        const result = await probeAvrBootloader(port);
        state.avrBootloaderResult = result;
        renderNetworkDiscovery();
        if (result.detected) {
          document.querySelector("#inventoryDisplayName").value = "Mein Arduino Nano";
          document.querySelector("#inventoryConnectivityStatus").value = "usb_connected";
          setInventoryStatus("ok", "Nano-Bootloader experimentell erkannt. Seriennummer bitte eintragen, dann manuell registrieren und pairen.");
          setDiscoveryStatus("ok", `STK500v1-Bootloader hat bei ${result.baudRate} Baud geantwortet. Das Board wurde nicht geflasht.`);
        } else {
          setDiscoveryStatus("error", "Kein STK500v1-Bootloader erkannt. Das kann an falschem Board, Reset-Timing, Treiber oder anderer Bootloader-Variante liegen.");
        }
      } catch (error) {
        if (error.name === "NotFoundError") {
          setDiscoveryStatus("running", "Keine serielle Schnittstelle ausgewaehlt.");
          return;
        }
        setDiscoveryStatus("error", error.message || "Arduino-Nano-Bootloader konnte nicht geprueft werden.");
      }
    }

    async function probeAvrBootloader(port) {
      const attempts = [57600, 115200];
      const errors = [];
      for (const baudRate of attempts) {
        try {
          const response = await tryAvrBootloaderSync(port, baudRate);
          if (response.detected) return response;
          errors.push(`${baudRate}: keine STK500-Antwort`);
        } catch (error) {
          errors.push(`${baudRate}: ${error.message}`);
        }
      }
      return {
        detected: false,
        baudRate: "",
        protocol: "stk500v1",
        detail: errors.join("; "),
      };
    }

    async function tryAvrBootloaderSync(port, baudRate) {
      let reader = null;
      let writer = null;
      try {
        await port.open({ baudRate });
        await resetSerialBootloader(port);
        reader = port.readable.getReader();
        writer = port.writable.getWriter();
        const responseBytes = [];
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await writer.write(Uint8Array.from([0x30, 0x20]));
          const chunk = await readSerialBytes(reader, 220);
          responseBytes.push(...chunk);
          if (hasStk500SyncResponse(responseBytes)) {
            return {
              detected: true,
              baudRate,
              protocol: "stk500v1",
              detail: `Antwortbytes: ${responseBytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}`,
            };
          }
          await delay(80);
        }
        return {
          detected: false,
          baudRate,
          protocol: "stk500v1",
          detail: "Keine 0x14/0x10 Bootloader-Antwort",
        };
      } finally {
        try { writer?.releaseLock(); } catch {}
        try { await reader?.cancel(); } catch {}
        try { reader?.releaseLock(); } catch {}
        try { if (port.readable || port.writable) await port.close(); } catch {}
      }
    }

    async function resetSerialBootloader(port) {
      if (typeof port.setSignals !== "function") {
        await delay(350);
        return;
      }
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await delay(80);
      await port.setSignals({ dataTerminalReady: true, requestToSend: false });
      await delay(350);
    }

    async function readSerialBytes(reader, timeoutMs) {
      const timeout = delay(timeoutMs).then(() => ({ timeout: true, value: undefined }));
      const result = await Promise.race([reader.read(), timeout]);
      return result?.value ? Array.from(result.value) : [];
    }

    function hasStk500SyncResponse(bytes) {
      for (let index = 0; index < bytes.length - 1; index += 1) {
        if (bytes[index] === 0x14 && bytes[index + 1] === 0x10) return true;
      }
      return false;
    }

    function renderNetworkDiscovery() {
      const list = document.querySelector("#networkDiscoveryList");
      if (!list) return;
      renderEsp32UsbPortOptions();
      syncInventoryNodeNamePreview();
      const board = selectedInventoryBoard();
      const actions = discoveryActionsForBoard(board);
      const family = board ? selectedInventoryHardwareFamily() : "";
      const isAvr = family === "avr_8bit";
      const usesWirelessOrUsb = actions.wifiDiscovery || actions.usbIdentification;
      const showGenericMethods = usesWirelessOrUsb && !isAvr;
      document.querySelector("#esp32DiscoveryActions").classList.toggle("hidden", !showGenericMethods);
      renderDiscoveryMethodOptions(actions);
      const isUsbSelected = actions.usbIdentification && state.inventoryEsp32Method === "usb";
      document.querySelector("#avrDiscoveryActions").classList.toggle("hidden", !isAvr);
      document.querySelector("#esp32UsbPortLabel").classList.toggle("hidden", !isUsbSelected);
      document.querySelector("#claimSelectedDiscoveredDevicesButton").classList.toggle("hidden", !actions.wifiDiscovery && !actions.usbIdentification);
      document.querySelector("#deviceInventoryForm").classList.toggle("hidden", actions.wifiDiscovery && Boolean(board));
      document.querySelector("#inventoryTypeHint").textContent = inventoryTypeHintText();
      if (isAvr) {
        list.innerHTML = renderAvrBootloaderResult();
        updateClaimSelectedButton();
        return;
      }
      if (!actions.wifiDiscovery && !actions.usbIdentification) {
        list.innerHTML = `<p class="empty">Fuer diesen Hardware-Typ ist keine Netzwerksuche noetig.</p>`;
        updateClaimSelectedButton();
        return;
      }
      if (!state.discoveredDevices.length) {
        list.innerHTML = `<p class="empty">Waehle WLAN oder USB und klicke auf Suchen. Die Board-Auswahl ist fuer die Suche optional.</p>`;
        updateClaimSelectedButton();
        return;
      }
      list.innerHTML = state.discoveredDevices.map((device) => `
        <article class="discovery-row ${device.ownership_status === "other_account" ? "is-locked" : ""}">
          <label class="discovery-select">
            <input
              type="checkbox"
              data-select-discovered-device="${escapeHtml(device.discovery_id)}"
              ${canClaimDiscoveredDevice(device) ? "" : "disabled"}
            />
          </label>
          <div class="discovery-main">
            <h3>${escapeHtml(device.display_name || device.serial_number || device.source_url)}</h3>
            <p>${escapeHtml(device.source_url)}</p>
            <strong class="state-badge ${escapeHtml(model.classifyDiscoveredDevice(device, board))}">${escapeHtml(model.stateText(model.classifyDiscoveredDevice(device, board)))}</strong>
            <strong class="ownership-badge ${escapeHtml(device.ownership_status || "unknown")}">${escapeHtml(ownershipStatusText(device))}</strong>
            <p class="helper-text">${escapeHtml(device.treatment || esp32TreatmentText(device))}</p>
          </div>
          <dl class="meta-list">
            ${meta("serial_number", device.serial_number || "unbekannt")}
            ${meta("hostname", device.hostname || "unbekannt")}
            ${meta("hardware_profile_id", device.hardware_profile_id || "unbekannt")}
            ${meta("connectivity_status", device.connectivity_status || "unbekannt")}
            ${meta("provisioning_state", device.provisioning_state || "unbekannt")}
            ${meta("runtime_version", device.runtime_version || "unbekannt")}
          </dl>
        </article>
      `).join("");
      document.querySelectorAll("[data-select-discovered-device]").forEach((checkbox) => {
        checkbox.addEventListener("change", updateClaimSelectedButton);
      });
      updateClaimSelectedButton();
    }

    function renderDiscoveryMethodOptions(actions) {
      const select = document.querySelector("#deviceDiscoveryMethod");
      const searchButton = document.querySelector("#deviceDiscoverySearchButton");
      if (!select || !searchButton) return;
      const methods = [
        actions.wifiDiscovery ? { value: "wlan", label: "WLAN" } : null,
        actions.usbIdentification ? { value: "usb", label: "USB" } : null,
      ].filter(Boolean);
      select.innerHTML = methods.map((method) => `<option value="${method.value}">${method.label}</option>`).join("");
      if (!methods.some((method) => method.value === state.inventoryEsp32Method)) {
        state.inventoryEsp32Method = methods[0]?.value || "";
      }
      select.value = state.inventoryEsp32Method;
      searchButton.disabled = !methods.length;
    }

    function renderAvrBootloaderResult() {
      const result = state.avrBootloaderResult;
      if (!result) {
        return `<p class="empty">Arduino Nano wird experimentell per Browser-Web-Serial gegen STK500v1-Bootloader getestet. Es wird nichts geflasht.</p>`;
      }
      return `
        <article class="discovery-row avr-result ${result.detected ? "" : "is-locked"}">
          <label class="discovery-select">
            <input type="checkbox" disabled />
          </label>
          <div class="discovery-main">
            <h3>${result.detected ? "Arduino Nano Bootloader erreichbar" : "Arduino Nano Bootloader nicht erkannt"}</h3>
            <p>${escapeHtml(result.protocol)}${result.baudRate ? ` - ${escapeHtml(result.baudRate)} Baud` : ""}</p>
            <strong class="state-badge ${result.detected ? "experimental_ok" : "experimental_failed"}">
              ${result.detected ? "Experimentell erkannt" : "Experimentell nicht erkannt"}
            </strong>
            <p class="helper-text">${result.detected
              ? "Der Browser konnte den STK500v1-Handshake lesen. Bitte Seriennummer eintragen und das Board manuell registrieren und pairen."
              : "Nicht jedes Nano-kompatible Board antwortet mit dieser Variante. Treiber, Reset-Timing und Bootloader koennen abweichen."}</p>
          </div>
          <dl class="meta-list">
            ${meta("Protokoll", result.protocol)}
            ${meta("Baudrate", result.baudRate || "unbekannt")}
            ${meta("Flash", "nicht ausgefuehrt")}
            ${meta("Lokale Installation", "nicht erforderlich")}
            ${meta("Detail", result.detail || "kein Detail")}
          </dl>
        </article>
      `;
    }

    function inventoryTypeHintText() {
      const board = selectedInventoryBoard();
      if (!board) return "WLAN sucht nach erreichbaren gernetix-* Nodes. USB sucht nach bekannten USB-Serial-/Board-Strings. Die Board-Auswahl ist nur fuer manuelles Provisioning oder als Fallback noetig.";
      const family = selectedInventoryHardwareFamily();
      const modelHint = model.inventoryHint(board);
      if (family === "esp32" || family === "esp8266") {
        const versionHint = model.needsBasissoftwareVersionCheck(board)
          ? ` Mindestversion Basissoftware: ${board.min_basissoftware_version}.`
          : "";
        return `${modelHint} WLAN sucht erreichbare Nodes im Kunden-Netz. USB prueft blanke oder fremd geflashte Boards per Browser-Web-Serial.${versionHint}`;
      }
      if (family === "avr_8bit") {
        return `${modelHint} Der Bootloader-Handshake ist experimentell. Keine avrdude-Installation, kein lokaler Helper.`;
      }
      return modelHint;
    }

    function discoveryActionsForBoard(board) {
      if (board) return model.allowedActions(board);
      return {
        wifiDiscovery: true,
        usbIdentification: true,
        usbFlash: false,
        ota: false,
        basissoftware: false,
        captiveSetup: false,
      };
    }

    async function claimDiscoveredDevice(discoveryId) {
      const discovered = state.discoveredDevices.find((item) => item.discovery_id === discoveryId);
      if (!discovered) return;
      setDiscoveryStatus("running", `${discovered.display_name || discovered.serial_number} wird registriert und mit deinem Account verbunden...`);
      try {
        const device = await postJson("/api/platform/devices/from-discovery", withOnboardingIdentity(discovered));
        state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
        state.discoveredDevices = state.discoveredDevices.filter((item) => item.discovery_id !== discoveryId);
        state.activeDeviceId = device.device_id;
        renderIdeShell();
        renderNetworkDiscovery();
        renderDevices();
        renderDashboard();
        setDiscoveryStatus("ok", `${device.display_name} wurde provisioniert und mit deinem Account verbunden.`);
      } catch (error) {
        setDiscoveryStatus("error", error.message);
      }
    }

    async function claimSelectedDiscoveredDevices() {
      const selectedIds = Array.from(document.querySelectorAll("[data-select-discovered-device]:checked"))
        .map((checkbox) => checkbox.dataset.selectDiscoveredDevice);
      const selected = selectedIds
        .map((id) => state.discoveredDevices.find((item) => item.discovery_id === id))
        .filter(canClaimDiscoveredDevice);
      if (!selected.length) {
        setDiscoveryStatus("error", "Bitte zuerst ein uebernehmbares Board aus der Trefferliste auswaehlen.");
        updateClaimSelectedButton();
        return;
      }
      setDiscoveryStatus("running", `${selected.length} Board${selected.length === 1 ? " wird" : "s werden"} registriert und gepairt...`);
      const claimed = [];
      try {
        for (const discovered of selected) {
          const device = await postJson("/api/platform/devices/from-discovery", withOnboardingIdentity(discovered));
          claimed.push(device);
          state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
          state.discoveredDevices = state.discoveredDevices.map((item) => item.discovery_id === discovered.discovery_id
            ? { ...item, already_in_inventory: true, ownership_status: "current_account" }
            : item);
          state.activeDeviceId = device.device_id;
        }
        renderIdeShell();
        renderNetworkDiscovery();
        renderDevices();
        renderDashboard();
        setDiscoveryStatus("ok", `${claimed.length} Board${claimed.length === 1 ? "" : "s"} wurde${claimed.length === 1 ? "" : "n"} provisioniert und mit deinem Account verbunden.`);
      } catch (error) {
        renderNetworkDiscovery();
        setDiscoveryStatus("error", error.message);
      }
    }

    function withOnboardingIdentity(device) {
      const shortName = model.normalizeShortName(document.querySelector("#inventoryBoardShortName")?.value || device.display_name || device.hostname);
      const nodeName = model.nodeName(shortName || device.hostname || device.serial_number);
      const board = selectedInventoryBoard();
      return {
        ...device,
        board_short_name: shortName,
        node_name: nodeName,
        display_name: device.display_name || shortName || nodeName,
        technical_capability_ids: device.technical_capability_ids || device.capability_ids || board?.capability_ids || [],
      };
    }

    function updateClaimSelectedButton() {
      const button = document.querySelector("#claimSelectedDiscoveredDevicesButton");
      if (!button) return;
      const selectedIds = Array.from(document.querySelectorAll("[data-select-discovered-device]:checked"))
        .map((checkbox) => checkbox.dataset.selectDiscoveredDevice);
      const count = selectedIds
        .map((id) => state.discoveredDevices.find((item) => item.discovery_id === id))
        .filter(canClaimDiscoveredDevice)
        .length;
      button.disabled = count === 0;
      button.textContent = count
        ? `${count} ausgewaehlte${count === 1 ? "s" : ""} Board${count === 1 ? "" : "s"} uebernehmen`
        : "Provisionieren und mit Account verbinden";
    }

    function canClaimDiscoveredDevice(device) {
      const claimableStates = new Set(["node_online", "bootloader_only"]);
      return device
        && !device.already_in_inventory
        && device.ownership_status !== "other_account"
        && claimableStates.has(device.esp32_inventory_state);
    }

    function ownershipStatusText(device) {
      if (device.already_in_inventory || device.ownership_status === "current_account") return "Gehoert deinem Konto";
      if (device.ownership_status === "other_account") return "Gehoert bereits einem anderen Konto";
      if (device.ownership_status === "unregistered") return "Noch keinem bekannten Konto zugeordnet";
      return "Kontostatus unbekannt";
    }

    function esp32TreatmentText(device) {
      if (device.esp32_inventory_state === "node_online") return "Kann nach Kontopruefung registriert und gepairt werden.";
      if (device.esp32_inventory_state === "basissoftware_setup_ap") return "Per USB provisionieren, weil der Setup-AP die Backend-Verbindung trennt.";
      if (device.esp32_inventory_state === "bootloader_only") return "Basissoftware per Browser-Web-Serial/USB flashen und danach registrieren.";
      return "Zustand pruefen, bevor das Board provisioniert wird.";
    }

    function renderDeviceInventoryForm() {
      const boards = state.processorBoards.length ? state.processorBoards : fallbackProcessorBoards();
      const familyOptions = processorFamilyOptionsFromBoards(boards);
      if (!state.inventoryProcessorFamily || !familyOptions.some((type) => type.id === state.inventoryProcessorFamily)) {
        state.inventoryProcessorFamily = familyOptions[0]?.id || "esp32";
      }
      document.querySelector("#inventoryProcessorFamily").innerHTML = familyOptions.map((type) => `
        <option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>
      `).join("");
      document.querySelector("#inventoryProcessorFamily").value = state.inventoryProcessorFamily;
      const boardsForFamily = boards.filter((board) => hardwareTypeForBoard(board) === state.inventoryProcessorFamily);
      const hardwareOptions = hardwareOptionsFromBoards(boardsForFamily);
      if (state.inventoryHardwareType && !hardwareOptions.some((type) => type.id === state.inventoryHardwareType)) {
        state.inventoryHardwareType = "";
      }
      document.querySelector("#inventoryHardwareType").innerHTML = [
        `<option value="">ProcessorBoard waehlen</option>`,
        ...hardwareOptions.map((type) => `
        <option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>
      `),
      ].join("");
      document.querySelector("#inventoryHardwareType").value = state.inventoryHardwareType;
      const selectedBoards = boardsForFamily.filter((board) => boardId(board) === state.inventoryHardwareType);
      document.querySelector("#inventoryHardwareProfile").innerHTML = selectedBoards.map((board) => `
        <option value="${escapeHtml(board.hardware_item_id || board.hardware_profile_id)}">${escapeHtml(board.title || board.hardware_item_id || board.hardware_profile_id)}</option>
      `).join("");
      renderInventoryUsbPortOptions();
      const actions = model.allowedActions(selectedInventoryBoard());
      document.querySelector("#inventoryUsbPortLabel").classList.toggle("hidden", actions.wifiDiscovery || !actions.usbIdentification);
      if (!document.querySelector("#inventoryDisplayName").value.trim()) {
        document.querySelector("#inventoryDisplayName").value = selectedInventoryBoard()?.title || "Mein Board";
      }
      syncInventoryNodeNamePreview();
      syncInventoryCapabilities();
      renderNetworkDiscovery();
    }

    function selectInventoryProcessorFamily() {
      state.inventoryProcessorFamily = document.querySelector("#inventoryProcessorFamily").value;
      state.inventoryHardwareType = "";
      state.inventoryEsp32Method = "";
      state.discoveredDevices = [];
      state.avrBootloaderResult = null;
      renderDeviceInventoryForm();
      setDiscoveryStatus("running", `${model.familyLabel(state.inventoryProcessorFamily)} gewaehlt. Waehle jetzt das konkrete ProcessorBoard.`);
    }

    function selectInventoryHardwareType() {
      state.inventoryHardwareType = document.querySelector("#inventoryHardwareType").value;
      state.inventoryEsp32Method = "";
      state.discoveredDevices = [];
      state.avrBootloaderResult = null;
      renderDeviceInventoryForm();
      const board = selectedInventoryBoard();
      if (!board) {
        setDiscoveryStatus("running", "Waehle ein konkretes ProcessorBoard aus dem Hardware-Katalog.");
        return;
      }
      const actions = model.allowedActions(board);
      setDiscoveryStatus("running", actions.wifiDiscovery || actions.usbIdentification
        ? `${board?.title || "ProcessorBoard"} gewaehlt. Waehle jetzt einen passenden Erkennungsweg.`
        : "Bereit fuer manuelle Registrierung und Pairing.");
    }

    function syncInventoryCapabilities() {
      const boardId = document.querySelector("#inventoryHardwareProfile").value;
      if (!boardId) {
        document.querySelector("#inventoryCapabilities").value = "";
        syncInventoryNodeNamePreview();
        return;
      }
      const board = state.processorBoards.find((item) => item.hardware_item_id === boardId || item.hardware_profile_id === boardId)
        || fallbackProcessorBoards().find((item) => item.hardware_item_id === boardId);
      document.querySelector("#inventoryCapabilities").value = (board?.capability_ids || []).map((item) => String(item).replace(/^capability\./, "")).join(", ");
      syncInventoryNodeNamePreview();
    }

    function syncInventoryNodeNamePreview() {
      const shortNameInput = document.querySelector("#inventoryBoardShortName");
      const preview = document.querySelector("#inventoryNodeNamePreview");
      if (!shortNameInput || !preview) return;
      const normalized = model.normalizeShortName(shortNameInput.value || "mein-board");
      preview.textContent = model.nodeName(normalized || "mein-board");
    }

    function processorFamilyOptionsFromBoards(boards) {
      const seen = new Set();
      return boards
        .map((board) => hardwareTypeForBoard(board))
        .filter((family) => {
          if (!family || family === "unknown" || seen.has(family)) return false;
          seen.add(family);
          return true;
        })
        .map((family) => ({ id: family, label: model.familyLabel(family) }));
    }

    function hardwareOptionsFromBoards(boards) {
      const seen = new Set();
      return boards
        .filter((board) => {
          const id = boardId(board);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((board) => ({ id: boardId(board), label: model.boardLabel(board) }));
    }

    function selectedInventoryBoard() {
      const boards = state.processorBoards.length ? state.processorBoards : fallbackProcessorBoards();
      return boards.find((board) => boardId(board) === state.inventoryHardwareType && hardwareTypeForBoard(board) === state.inventoryProcessorFamily)
        || boards.find((board) => boardId(board) === state.inventoryHardwareType)
        || null;
    }

    function selectedInventoryHardwareFamily() {
      return hardwareTypeForBoard(selectedInventoryBoard()) || state.inventoryProcessorFamily || "other";
    }

    function hardwareTypeForBoard(board) {
      if (!board) return "";
      return model.boardFamily(board);
    }

    function boardId(board) {
      return board?.hardware_item_id || board?.hardware_profile_id || "";
    }

    function hardwareTypeForProfile(value) {
      const normalized = String(value || "").toLowerCase();
      if (normalized.includes("esp8266") || normalized.includes("esp-12")) return "esp8266";
      if (normalized.includes("esp32") || normalized.includes("esp_wroom") || normalized.includes("esp-wroom") || normalized.includes("wroom-32")) return "esp32";
      if (normalized.includes("avr") || normalized.includes("atmega328p") || normalized.includes("arduino_nano") || normalized.includes("arduino nano")) return "avr_8bit";
      return "unknown";
    }

    function usbDiscoveryPorts() {
      return state.usbPorts.filter(isLikelySupportedUsbSerialPort);
    }

    function isLikelySupportedUsbSerialPort(port) {
      const text = usbPortText(port);
      return /cp210|ch340|ch341|usb-serial|usb serial|silicon labs|wch|uart|esp32|espressif|arduino/.test(text);
    }

    function usbHardwareProfileForPort(port) {
      const text = usbPortText(port);
      if (/arduino|atmega|nano/.test(text)) return "hardware.processor_board.arduino_nano_r3_atmega328p";
      if (/esp8266|esp-12|d1 mini|wemos/.test(text)) return "hardware.processor_board.wemos_d1_mini_esp12f";
      return "hardware.processor_board.generic_esp_wroom32";
    }

    function usbDiscoveryLabel(port, board) {
      if (board?.title) return board.title;
      const text = usbPortText(port);
      if (/arduino|atmega|nano/.test(text)) return "Arduino/AVR Board";
      if (/esp8266|esp-12|d1 mini|wemos/.test(text)) return "ESP8266 Board";
      if (/esp32|espressif|cp210|ch340|ch341|silicon labs|wch/.test(text)) return "ESP32 Board";
      return "USB-Serial Board";
    }

    function usbPortText(port) {
      return [
        port?.port,
        port?.path,
        port?.name,
        port?.manufacturer,
        port?.device_id,
        port?.vendor_id,
        port?.product_id,
      ].join(" ").toLowerCase();
    }

    async function createInventoryDevice(event) {
      event.preventDefault();
      if (!selectedInventoryBoard()) {
        setInventoryStatus("error", "Bitte zuerst ein ProcessorBoard aus dem Hardware-Katalog waehlen.");
        return;
      }
      setInventoryStatus("running", "Gerät wird registriert und mit dem Account gepairt...");
      const shortName = model.normalizeShortName(document.querySelector("#inventoryBoardShortName").value);
      const nodeName = model.nodeName(shortName || document.querySelector("#inventoryDisplayName").value);
      try {
        const device = await postJson("/api/platform/devices", {
          display_name: document.querySelector("#inventoryDisplayName").value.trim(),
          serial_number: document.querySelector("#inventorySerialNumber").value.trim(),
          board_short_name: shortName,
          node_name: nodeName,
          hardware_profile_id: document.querySelector("#inventoryHardwareProfile").value,
          technical_capability_ids: document.querySelector("#inventoryCapabilities").value.split(",").map((item) => item.trim()).filter(Boolean),
          connectivity_status: document.querySelector("#inventoryConnectivityStatus").value,
        });
        state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
        state.activeDeviceId = device.device_id;
        renderIdeShell();
        renderDevices();
        setInventoryStatus("ok", `${device.display_name} wurde registriert und mit deinem Account verbunden.`);
        document.querySelector("#inventorySerialNumber").value = "";
      } catch (error) {
        setInventoryStatus("error", error.message);
      }
    }

    function setDiscoveryStatus(kind, text) {
      const status = document.querySelector("#networkDiscoveryStatus");
      if (!status) return;
      status.className = `flash-status ${kind}`;
      status.textContent = text;
    }

    function setInventoryStatus(kind, text) {
      const status = document.querySelector("#inventoryStatus");
      if (!status) return;
      status.className = `flash-status ${kind}`;
      status.textContent = text;
    }

    return {
      claimDiscoveredDevice,
      claimSelectedDiscoveredDevices,
      createInventoryDevice,
      discoverNetworkDevices,
      identifyAvrBootloaderExperimental,
      identifyEsp32Bootloader,
      renderDeviceInventoryForm,
      renderNetworkDiscovery,
      searchDevicesForInventory,
      selectDeviceDiscoveryMethod,
      selectInventoryHardwareType,
      selectInventoryProcessorFamily,
      selectedInventoryHardwareFamily,
      setDiscoveryStatus,
      setInventoryStatus,
      syncInventoryCapabilities,
      syncInventoryNodeNamePreview,
    };
  }

  return { create };
})();
