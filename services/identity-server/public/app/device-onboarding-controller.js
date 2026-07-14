const DeviceOnboardingController = (() => {
  function create(deps) {
    const {
      state,
      model,
      getJson,
      postJson,
      delay,
      loadIdeEsptoolModule,
      fallbackProcessorBoards,
      renderDashboard,
      renderDevices,
      renderIdeShell,
      renderInventoryUsbPortOptions,
      escapeHtml,
      meta,
    } = deps;

    async function discoverNetworkDevices() {
      state.inventoryEsp32Method = "wlan";
      state.discoveredDevices = [];
      renderNetworkDiscovery();
      setDiscoveryStatus("running", "Lokales Netzwerk wird nach gernetix-* Nodes durchsucht...");
      try {
        const result = await getJson("/api/platform/devices/discover");
        state.discoveredDevices = result.items || [];
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
      if (!("serial" in navigator)) {
        setDiscoveryStatus("error", "Web Serial ist in diesem Browser nicht verfuegbar. Verwende das GerNetiX USB Helper Tool.");
        return;
      }
      setDiscoveryStatus("running", "Web-Serial-Portauswahl wird geoeffnet...");
      try {
        const port = await navigator.serial.requestPort();
        const info = port.getInfo ? port.getInfo() : {};
        const vendorId = usbIdentifier(info.usbVendorId);
        const productId = usbIdentifier(info.usbProductId);
        const identifier = vendorId && productId ? `${vendorId}:${productId}` : "browser-selected";
        state.provisioningSerialPort = port;
        setDiscoveryStatus("running", "Kompatibler Bootloader wird geprueft...");
        const bootloader = await probeCompatibleBootloader(port);
        if (!bootloader.detected) {
          state.discoveredDevices = [];
          renderNetworkDiscovery();
          setDiscoveryStatus("error", bootloader.portBusy
            ? "Der serielle Port ist noch durch einen anderen Zugriff belegt. Schließe andere Serial-Monitore, lade die Seite neu und versuche es erneut."
            : `Kein kompatibler ESP- oder Arduino-Bootloader erkannt${bootloader.detail ? `: ${bootloader.detail}` : "."}`);
          return;
        }
        state.discoveredDevices = [{
          discovery_id: `web-serial-${identifier}`,
          source_url: `Web Serial ${identifier}`,
          display_name: bootloader.label,
          hardware_profile_id: bootloader.hardwareProfileId,
          detected_hardware_profile_id: bootloader.hardwareProfileId,
          runtime_version: "",
          firmware_version: "",
          bootloader_type: bootloader.type,
          bootloader_name: bootloader.name,
          bootloader_detail: bootloader.detail,
          provisioning_state: "compatible_bootloader_detected",
          connectivity_status: "usb_bootloader_ready",
          ownership_status: "unregistered",
          esp32_inventory_state: "bootloader_only",
          treatment: `${bootloader.name} erkannt. Das Flashen einer kompatiblen Basissoftware ist möglich.`,
          already_in_inventory: false,
        }];
        renderNetworkDiscovery();
        setDiscoveryStatus("ok", `Kompatibler Bootloader gefunden: ${bootloader.name}. Basissoftware kann geflasht werden.`);
      } catch (error) {
        if (error.name === "NotFoundError") {
          setDiscoveryStatus("running", "Keine serielle Schnittstelle ausgewählt.");
          return;
        }
        setDiscoveryStatus("error", error.message || "Der serielle Port konnte nicht über Web Serial ausgewählt werden.");
      }
    }

    function usbIdentifier(value) {
      return value === undefined ? "" : Number(value).toString(16).padStart(4, "0").toUpperCase();
    }

    async function probeCompatibleBootloader(port) {
      const esp = await probeEspBootloader(port);
      if (esp.detected) return esp;
      if (esp.portBusy) return esp;
      await delay(150);
      const avr = await probeAvrBootloader(port);
      if (avr.detected) {
        return {
          detected: true,
          type: "arduino_stk500v1",
          name: "Arduino Bootloader (STK500v1)",
          label: "Arduino-kompatibles Board",
          hardwareProfileId: "hardware.processor_board.arduino_nano_r3_atmega328p",
          detail: `${avr.baudRate} Baud`,
        };
      }
      return {
        detected: false,
        portBusy: esp.portBusy,
        detail: [esp.detail, avr.detail].filter(Boolean).join("; "),
      };
    }

    async function probeEspBootloader(port) {
      let transport = null;
      try {
        const { ESPLoader, Transport } = await loadIdeEsptoolModule();
        transport = new Transport(port, false);
        const loader = new ESPLoader({
          transport,
          baudrate: 115200,
          terminal: { clean() {}, writeLine() {}, write() {} },
          debugLogging: false,
        });
        const info = port.getInfo ? port.getInfo() : {};
        const isEspressifUsbJtag = info.usbVendorId === 0x303A && info.usbProductId === 0x1001;
        const chipName = await loader.main(isEspressifUsbJtag ? "usb_reset" : "default_reset");
        return {
          detected: true,
          type: "espressif_rom",
          name: `${chipName || "ESP32"} Bootloader`,
          label: `${chipName || "ESP32"}-kompatibles Board`,
          hardwareProfileId: espHardwareProfile(chipName),
          detail: chipName || "Espressif ROM Bootloader",
        };
      } catch (error) {
        const detail = error.message || "Kein Espressif-ROM-Bootloader erkannt";
        return {
          detected: false,
          portBusy: /busy|already open|failed to open|in use|networkerror/i.test(detail),
          detail,
        };
      } finally {
        try { await transport?.disconnect(); } catch {}
        try { if (port.readable || port.writable) await port.close(); } catch {}
      }
    }

    function espHardwareProfile(chipName) {
      const name = String(chipName || "").toLowerCase();
      if (name.includes("esp8266")) return "hardware.processor_board.wemos_d1_mini_esp12f";
      if (name.includes("esp32-s3") || name.includes("esp32s3")) return "hardware.processor_board.generic_esp32_s3_wroom1";
      if (name.includes("esp32-c6") || name.includes("esp32c6")) return "hardware.processor_board.generic_esp32_c6_wroom1";
      return "hardware.processor_board.generic_esp_wroom32";
    }

    function selectDeviceDiscoveryMethod(event) {
      const method = event?.target?.value
        || document.querySelector('input[name="deviceDiscoveryMethod"]:checked')?.value
        || "";
      if (!new Set(["wlan", "usb"]).has(method)) return;
      state.inventoryEsp32Method = method;
      state.discoveredDevices = [];
      state.avrBootloaderResult = null;
      state.provisioningKnownBoardId = "";
      state.provisioningFeatureSelections = {};
      state.provisioningDatasheetUrl = "";
      renderNetworkDiscovery();
      setDiscoveryStatus("running", state.inventoryEsp32Method === "usb"
        ? ("serial" in navigator
          ? "USB ausgewaehlt. Oeffne jetzt die Web-Serial-Portauswahl."
          : "Web Serial ist nicht verfuegbar. Verwende das GerNetiX USB Helper Tool.")
        : "WLAN ausgewaehlt. Dieser Weg funktioniert nur mit bereits provisionierten Boards im gleichen lokalen Netzwerk.");
    }

    async function searchDevicesForInventory() {
      const method = document.querySelector('input[name="deviceDiscoveryMethod"]:checked')?.value || state.inventoryEsp32Method;
      if (!method) {
        setDiscoveryStatus("error", "Bitte zuerst WLAN oder USB als Provisioning-Weg waehlen.");
        return;
      }
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
      syncInventoryNodeNamePreview();
      const board = null;
      const actions = discoveryActionsForBoard();
      const isAvr = false;
      const usesWirelessOrUsb = actions.wifiDiscovery || actions.usbIdentification;
      const showGenericMethods = usesWirelessOrUsb && !isAvr;
      renderDiscoveryMethodOptions(actions);
      const hasSelectedMethod = state.inventoryEsp32Method === "wlan" || state.inventoryEsp32Method === "usb";
      const isUsbSelected = actions.usbIdentification && state.inventoryEsp32Method === "usb";
      const isWifiSelected = actions.wifiDiscovery && state.inventoryEsp32Method === "wlan";
      document.querySelector("#provisioningWorkflowPanel").classList.toggle("hidden", !hasSelectedMethod);
      document.querySelector("#provisioningWifiNotice").classList.toggle("hidden", !isWifiSelected);
      document.querySelector("#provisioningUsbNotice").classList.toggle("hidden", !isUsbSelected);
      document.querySelector("#provisioningWorkflowTitle").textContent = isUsbSelected ? "Board per USB verbinden" : "Provisioniertes Board per WLAN suchen";
      document.querySelector("#esp32DiscoveryActions").classList.toggle("hidden", !showGenericMethods || !isWifiSelected);
      document.querySelector("#avrDiscoveryActions").classList.toggle("hidden", !isAvr || !isUsbSelected);
      document.querySelector("#provisioningWebSerialActions").classList.toggle("hidden", !isUsbSelected || !("serial" in navigator));
      document.querySelector("#provisioningUsbHelperHint").classList.toggle("hidden", !isUsbSelected || ("serial" in navigator));
      document.querySelector("#claimSelectedDiscoveredDevicesButton").classList.toggle("hidden", !hasSelectedMethod || (!actions.wifiDiscovery && !actions.usbIdentification));
      document.querySelector("#deviceInventoryForm").classList.toggle("hidden", !isUsbSelected);
      document.querySelector("#provisioningFoundBoardDetails").classList.toggle("hidden", !state.discoveredDevices.some(canClaimDiscoveredDevice));
      const hasDetectedBootloader = isUsbSelected && state.discoveredDevices.some((device) => device.bootloader_type);
      document.querySelector("#provisioningBoardFeatures").classList.toggle("hidden", !hasDetectedBootloader);
      if (hasDetectedBootloader) renderBoardFeatureChecklist();
      document.querySelector("#inventoryTypeHint").textContent = inventoryTypeHintText();
      if (!hasSelectedMethod) {
        list.innerHTML = `<p class="empty">Waehle zuerst WLAN oder USB als Provisioning-Weg.</p>`;
        updateClaimSelectedButton();
        return;
      }
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
        list.innerHTML = state.inventoryEsp32Method === "usb"
          ? `<p class="empty">Verbinde das Board per USB und waehle den Port ueber Web Serial aus.</p>`
          : `<p class="empty">Suche nach einem bereits provisionierten Board im gleichen lokalen WLAN. Die Board-Auswahl ist optional.</p>`;
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
          <dl class="meta-list">${discoveryMetadata(device)}</dl>
        </article>
      `).join("");
      document.querySelectorAll("[data-select-discovered-device]").forEach((checkbox) => {
        checkbox.addEventListener("change", updateClaimSelectedButton);
      });
      updateClaimSelectedButton();
    }

    function renderBoardFeatureChecklist() {
      const target = document.querySelector("#provisioningBoardFeatureList");
      const status = document.querySelector("#provisioningBoardFeatureStatus");
      if (!target || !status) return;
      renderKnownBoardSelection();
      const catalogStatus = state.boardFeatureCatalogStatus || { state: "idle", message: "" };
      status.className = `flash-status ${catalogStatus.state === "error" ? "error" : "hidden"}`;
      status.textContent = catalogStatus.message || "";
      if (!state.boardFeatureCatalog.length) {
        target.innerHTML = catalogStatus.state === "loading" ? '<p class="empty">Ausstattungsoptionen werden geladen...</p>' : "";
        return;
      }
      const selections = state.provisioningFeatureSelections || {};
      target.innerHTML = state.boardFeatureCatalog.map((feature) => {
        const selected = selections[feature.feature_id] || {};
        return `<article class="board-feature-row" data-board-feature-row="${escapeHtml(feature.feature_id)}">
          <label class="board-feature-toggle">
            <input type="checkbox" data-board-feature-enabled="${escapeHtml(feature.feature_id)}" ${selected.enabled ? "checked" : ""} />
            <span>${escapeHtml(feature.title)}</span>
          </label>
          <div class="board-feature-fields ${selected.enabled ? "" : "hidden"}">
            ${featureSelect("Art", "hardware", feature.hardware_options, selected.hardware)}
            ${featureSelect("Treiber", "driver", feature.driver_options, selected.driver)}
            ${featureSelect("Anschluss", "connection", feature.connection_options, selected.connection)}
            ${featureSelect("Größe / Wert", "value", feature.value_options, selected.value)}
          </div>
          <p class="board-feature-datasheet"><strong>Datenblatt:</strong> ${escapeHtml(feature.datasheet_hint || "Exakte Boardbezeichnung und Schaltplan prüfen.")}</p>
        </article>`;
      }).join("");
      document.querySelector("#provisioningDatasheetUrl").value = state.provisioningDatasheetUrl || "";
      target.querySelectorAll("[data-board-feature-enabled]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => updateBoardFeatureSelection(checkbox.dataset.boardFeatureEnabled));
      });
      target.querySelectorAll("[data-board-feature-field]").forEach((select) => {
        select.addEventListener("change", () => updateBoardFeatureSelection(select.closest("[data-board-feature-row]").dataset.boardFeatureRow));
      });
      document.querySelector("#provisioningDatasheetUrl").oninput = (event) => {
        state.provisioningDatasheetUrl = event.target.value.trim();
      };
    }

    function renderKnownBoardSelection() {
      const select = document.querySelector("#provisioningKnownBoard");
      const hint = document.querySelector("#provisioningKnownBoardHint");
      const device = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!select || !hint || !device) return;
      const detectedProfileId = device.detected_hardware_profile_id || device.hardware_profile_id;
      const detectedBoard = catalogBoardForProfile(detectedProfileId);
      const candidates = compatibleProcessorBoards(detectedBoard);
      select.innerHTML = [
        `<option value="">Nur Prozessor erkannt (${escapeHtml(detectedBoard?.title || detectedProfileId)})</option>`,
        ...candidates.map((board) => `<option value="${escapeHtml(boardId(board))}" ${boardId(board) === state.provisioningKnownBoardId ? "selected" : ""}>${escapeHtml(board.title)}</option>`),
      ].join("");
      const selectedBoard = catalogBoardForProfile(state.provisioningKnownBoardId);
      hint.textContent = selectedBoard
        ? `${selectedBoard.title} ist bekannt. Gepruefte Ausstattung wurde aus dem Hardware Catalog vorbelegt.`
        : "Waehle das konkrete Boardmodell, wenn es bekannt ist. Ohne Auswahl bleibt nur der erkannte Prozessor gespeichert.";
      select.onchange = selectKnownProvisioningBoard;
    }

    function compatibleProcessorBoards(detectedBoard) {
      if (!detectedBoard) return [];
      const variant = normalizeProcessorVariant(detectedBoard.mcu_variant);
      return state.processorBoards
        .filter((board) => board.item_type === "processor_board")
        .filter((board) => boardId(board) !== boardId(detectedBoard))
        .filter((board) => normalizeProcessorVariant(board.mcu_variant) === variant)
        .sort((left, right) => {
          const verified = Number(right.verification_status === "locally_verified") - Number(left.verification_status === "locally_verified");
          return verified || String(left.title).localeCompare(String(right.title), "de");
        });
    }

    function normalizeProcessorVariant(value) {
      return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function selectKnownProvisioningBoard(event) {
      const hardwareProfileId = event.target.value;
      const device = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!device) return;
      state.provisioningKnownBoardId = hardwareProfileId;
      device.hardware_profile_id = hardwareProfileId || device.detected_hardware_profile_id || device.hardware_profile_id;
      applyKnownBoardDefaults(catalogBoardForProfile(hardwareProfileId));
      renderNetworkDiscovery();
    }

    function applyKnownBoardDefaults(board) {
      const defaults = board?.default_instance_configuration || {};
      state.provisioningFeatureSelections = Object.fromEntries(Object.entries(defaults.board_features || {}).map(([featureId, value]) => [
        featureId,
        { ...value, enabled: value.enabled !== false },
      ]));
      state.provisioningDatasheetUrl = defaults.datasheet_url || "";
    }

    function featureSelect(label, field, options, selected) {
      const items = Array.isArray(options) ? options : [];
      if (!items.length) return "";
      const selectedIsKnown = !selected || items.some((item) => item.id === selected);
      return `<label>${escapeHtml(label)}<select data-board-feature-field="${field}">
        <option value="">Bitte wählen</option>
        ${selectedIsKnown ? "" : `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (Boardprofil)</option>`}
        ${items.map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === selected ? "selected" : ""}>${escapeHtml(option.title)}</option>`).join("")}
      </select></label>`;
    }

    function updateBoardFeatureSelection(featureId) {
      const row = document.querySelector(`[data-board-feature-row="${featureId}"]`);
      if (!row) return;
      const enabled = row.querySelector("[data-board-feature-enabled]").checked;
      const read = (field) => row.querySelector(`[data-board-feature-field="${field}"]`)?.value || "";
      const existing = state.provisioningFeatureSelections?.[featureId] || {};
      state.provisioningFeatureSelections = {
        ...(state.provisioningFeatureSelections || {}),
        [featureId]: {
          ...existing,
          enabled,
          hardware: read("hardware"),
          driver: read("driver"),
          connection: read("connection"),
          value: read("value"),
        },
      };
      row.querySelector(".board-feature-fields")?.classList.toggle("hidden", !enabled);
    }

    function selectedBoardFeatureConfiguration() {
      const selected = Object.fromEntries(Object.entries(state.provisioningFeatureSelections || {})
        .filter(([, value]) => value.enabled)
        .map(([key, value]) => {
          const { enabled, ...configuration } = value;
          return [key, {
            ...configuration,
            hardware: value.hardware || "",
            driver: value.driver || "",
            connection: value.connection || "",
            value: value.value || "",
          }];
        }));
      return {
        board_features: selected,
        datasheet_url: state.provisioningDatasheetUrl || "",
        board_profile_source: state.provisioningKnownBoardId ? "hardware_catalog" : "manual_confirmation",
      };
    }

    function discoveryMetadata(device) {
      if (device.bootloader_type) {
        return [
          meta("Bootloader", device.bootloader_name),
          meta("Typ", device.bootloader_type),
          meta("Hardwareprofil", device.hardware_profile_id || "noch festzulegen"),
          meta("Flash", "Basissoftware möglich"),
        ].join("");
      }
      return [
        meta("serial_number", device.serial_number || "unbekannt"),
        meta("hostname", device.hostname || "unbekannt"),
        meta("hardware_profile_id", device.hardware_profile_id || "unbekannt"),
        meta("connectivity_status", device.connectivity_status || "unbekannt"),
        meta("provisioning_state", device.provisioning_state || "unbekannt"),
        meta("runtime_version", device.runtime_version || "unbekannt"),
      ].join("");
    }

    function renderDiscoveryMethodOptions(actions) {
      const searchButton = document.querySelector("#deviceDiscoverySearchButton");
      if (!searchButton) return;
      const allowedMethods = new Set([
        actions.wifiDiscovery ? "wlan" : "",
        actions.usbIdentification ? "usb" : "",
      ].filter(Boolean));
      document.querySelectorAll('input[name="deviceDiscoveryMethod"]').forEach((input) => {
        input.disabled = !allowedMethods.has(input.value);
        input.checked = input.value === state.inventoryEsp32Method;
      });
      if (state.inventoryEsp32Method && !allowedMethods.has(state.inventoryEsp32Method)) {
        state.inventoryEsp32Method = "";
        state.discoveredDevices = [];
        document.querySelectorAll('input[name="deviceDiscoveryMethod"]').forEach((input) => {
          input.checked = false;
        });
      }
      searchButton.disabled = !state.inventoryEsp32Method || !allowedMethods.has(state.inventoryEsp32Method);
      searchButton.textContent = "WLAN-Board suchen";
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
      return state.inventoryEsp32Method === "usb"
        ? "USB sucht nach bekannten USB-Serial-/Board-Strings. Die Board-Auswahl ist nur fuer manuelles Provisioning oder als Fallback noetig."
        : "WLAN sucht ausschliesslich nach bereits provisionierten, erreichbaren gernetix-* Nodes im gleichen lokalen Netzwerk.";
    }

    function discoveryActionsForBoard() {
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
      const board = catalogBoardForProfile(device.hardware_profile_id);
      const featureConfiguration = selectedBoardFeatureConfiguration();
      const selectedCapabilities = state.boardFeatureCatalog
        .filter((feature) => state.provisioningFeatureSelections?.[feature.feature_id]?.enabled)
        .flatMap((feature) => feature.capability_ids || []);
      return {
        ...device,
        board_short_name: shortName,
        node_name: nodeName,
        display_name: device.display_name || shortName || nodeName,
        technical_capability_ids: Array.from(new Set([
          ...(device.technical_capability_ids || device.capability_ids || board?.capability_ids || []),
          ...selectedCapabilities,
        ])),
        instance_configuration: {
          ...(device.instance_configuration || {}),
          ...featureConfiguration,
        },
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
      if (device.esp32_inventory_state === "node_online") {
        if (device.already_in_inventory || device.ownership_status === "current_account") return "Das Board befindet sich bereits in deinem Inventar.";
        if (device.ownership_status === "other_account") return "Das Board ist bereits einem anderen Konto zugeordnet und kann hier nicht uebernommen werden.";
        return "Das Board ist noch keinem Konto zugeordnet und kann in dein Inventar uebernommen werden.";
      }
      if (device.esp32_inventory_state === "basissoftware_setup_ap") return "Per USB provisionieren, weil der Setup-AP die Backend-Verbindung trennt.";
      if (device.esp32_inventory_state === "bootloader_only") return "Basissoftware per Browser-Web-Serial/USB flashen und danach registrieren.";
      return "Zustand pruefen, bevor das Board provisioniert wird.";
    }

    function renderDeviceInventoryForm() {
      const boards = state.processorBoards.length ? state.processorBoards : fallbackProcessorBoards();
      const uniqueBoards = boards.filter((board, index, items) => items.findIndex((item) => boardId(item) === boardId(board)) === index);
      document.querySelector("#inventoryHardwareProfile").innerHTML = uniqueBoards.map((board) => `
        <option value="${escapeHtml(board.hardware_item_id || board.hardware_profile_id)}">${escapeHtml(board.title || board.hardware_item_id || board.hardware_profile_id)}</option>
      `).join("");
      renderInventoryUsbPortOptions();
      document.querySelector("#inventoryUsbPortLabel").classList.toggle("hidden", state.inventoryEsp32Method !== "usb");
      if (!document.querySelector("#inventoryDisplayName").value.trim()) {
        document.querySelector("#inventoryDisplayName").value = "Mein Board";
      }
      syncInventoryNodeNamePreview();
      syncInventoryCapabilities();
      renderNetworkDiscovery();
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

    function catalogBoardForProfile(profileId) {
      const boards = state.processorBoards.length ? state.processorBoards : fallbackProcessorBoards();
      return boards.find((board) => boardId(board) === profileId) || null;
    }

    function selectedInventoryHardwareFamily() {
      const profileId = document.querySelector("#inventoryHardwareProfile")?.value || "";
      return hardwareTypeForBoard(catalogBoardForProfile(profileId)) || hardwareTypeForProfile(profileId) || "other";
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
      if (!document.querySelector("#inventoryHardwareProfile").value) {
        setInventoryStatus("error", "Bitte zuerst ein IoT-Device aus dem Hardware-Katalog waehlen.");
        return;
      }
      setInventoryStatus("running", "Gerät wird registriert und mit dem Account gepairt...");
      const shortName = model.normalizeShortName(document.querySelector("#inventoryDisplayName").value);
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
      selectedInventoryHardwareFamily,
      setDiscoveryStatus,
      setInventoryStatus,
      syncInventoryCapabilities,
      syncInventoryNodeNamePreview,
    };
  }

  return { create };
})();
