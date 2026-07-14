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
        state.provisioningBoardConfigurationMode = "";
        state.provisioningKnownBoardId = "";
        state.provisioningFeatureSelections = {};
        state.provisioningDatasheetUrl = "";
        state.provisioningUpdateProfile = "";
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
      state.provisioningBoardConfigurationMode = "";
      state.provisioningKnownBoardId = "";
      state.provisioningFeatureSelections = {};
      state.provisioningDatasheetUrl = "";
      state.provisioningUpdateProfile = "";
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
      const hasConfigurationDecision = new Set(["catalog", "manual"]).has(state.provisioningBoardConfigurationMode);
      document.querySelector("#provisioningBoardConfigurationDetails")?.classList.toggle("hidden", !hasConfigurationDecision);
      const configurationTitle = document.querySelector("#provisioningBoardConfigurationTitle");
      if (configurationTitle) configurationTitle.textContent = state.provisioningBoardConfigurationMode === "manual"
        ? "Boardausstattung selbst konfigurieren"
        : "Vorgefertigte Boardausstattung prüfen";
      if (!hasConfigurationDecision) {
        target.innerHTML = "";
        renderUpdateProfileChooser();
        return;
      }
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
      renderUpdateProfileChooser();
    }

    function renderKnownBoardSelection() {
      const select = document.querySelector("#provisioningKnownBoard");
      const hint = document.querySelector("#provisioningKnownBoardHint");
      const catalogChoice = document.querySelector("#provisioningKnownBoardSelection");
      const manualChoice = document.querySelector("#provisioningManualBoardChoice");
      const manualButton = document.querySelector("#provisioningManualBoardButton");
      const device = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!select || !hint || !manualButton || !device) return;
      const detectedProfileId = device.detected_hardware_profile_id || device.hardware_profile_id;
      const detectedBoard = catalogBoardForProfile(detectedProfileId);
      const candidates = compatibleProcessorBoards(detectedBoard);
      select.innerHTML = [
        `<option value="">Bitte vorgefertigtes Board auswählen</option>`,
        ...candidates.map((board) => `<option value="${escapeHtml(boardId(board))}" ${boardId(board) === state.provisioningKnownBoardId ? "selected" : ""}>${escapeHtml(board.title)}</option>`),
      ].join("");
      const selectedBoard = catalogBoardForProfile(state.provisioningKnownBoardId);
      hint.textContent = selectedBoard
        ? `${selectedBoard.title} ist bekannt. Geprüfte Ausstattung wurde aus dem Hardware Catalog vorbelegt.`
        : candidates.length
          ? `${candidates.length} passendes${candidates.length === 1 ? "" : "e"} Boardprofil${candidates.length === 1 ? "" : "e"} für den erkannten Prozessor gefunden.`
          : "Für den erkannten Prozessor ist noch kein konkretes Boardprofil hinterlegt. Nutze die manuelle Konfiguration.";
      catalogChoice?.classList.toggle("is-selected", state.provisioningBoardConfigurationMode === "catalog");
      manualChoice?.classList.toggle("is-selected", state.provisioningBoardConfigurationMode === "manual");
      manualButton.textContent = state.provisioningBoardConfigurationMode === "manual"
        ? "Manuelle Konfiguration ist geöffnet"
        : "Manuelle Konfiguration öffnen";
      select.onchange = selectKnownProvisioningBoard;
      manualButton.onclick = activateManualBoardConfiguration;
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
      state.provisioningBoardConfigurationMode = hardwareProfileId ? "catalog" : "";
      state.provisioningUpdateProfile = "";
      device.hardware_profile_id = hardwareProfileId || device.detected_hardware_profile_id || device.hardware_profile_id;
      applyKnownBoardDefaults(catalogBoardForProfile(hardwareProfileId));
      renderNetworkDiscovery();
    }

    function activateManualBoardConfiguration() {
      const device = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!device) return;
      state.provisioningBoardConfigurationMode = "manual";
      state.provisioningKnownBoardId = "";
      state.provisioningFeatureSelections = {};
      state.provisioningDatasheetUrl = "";
      state.provisioningUpdateProfile = "";
      device.hardware_profile_id = device.detected_hardware_profile_id || device.hardware_profile_id;
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
      renderUpdateProfileChooser();
    }

    function renderUpdateProfileChooser() {
      const target = document.querySelector("#provisioningUpdateProfileChooser");
      if (!target) return;
      const hasBoardDecision = new Set(["catalog", "manual"]).has(state.provisioningBoardConfigurationMode);
      if (!hasBoardDecision) {
        target.innerHTML = "";
        return;
      }
      const flashSize = selectedFlashSizeMb();
      const recommendation = recommendedUpdateProfile(flashSize);
      const profiles = updateProfileDefinitions();
      target.innerHTML = `
        <div class="provisioning-update-profile-head">
          <h4 id="provisioningUpdateProfileTitle">Update- und Speicherprofil wählen</h4>
          <p class="helper-text">Wähle nach gewünschter Ausfallsicherheit und verfügbarem Speicher. Technische Details übernimmt GerNetiX.</p>
        </div>
        <div class="update-profile-options">
          ${profiles.map((profile) => `<label class="update-profile-option">
            <input type="radio" name="provisioningUpdateProfile" value="${profile.id}" ${state.provisioningUpdateProfile === profile.id ? "checked" : ""} />
            <span>
              <em class="update-profile-badge">${profile.badge}</em>
              <strong>${profile.title}</strong>
              <small>${profile.description}</small>
              <small><b>Updatefehler:</b> ${profile.failure}</small>
            </span>
          </label>`).join("")}
        </div>
        <p class="update-profile-recommendation"><strong>Empfehlung${flashSize ? ` für ${flashSize} MB Flash` : ""}:</strong> ${recommendation.text}</p>
        ${updateProfileExamplesTable(flashSize)}
        <p class="update-profile-change-note"><strong>Später änderbar:</strong> Du kannst dieses Profil jederzeit wechseln. Wenn sich die Speicheraufteilung ändert oder OTA bisher nicht vorhanden ist, muss das Board dafür einmal per USB verbunden und neu geflasht werden. GerNetiX weist vorher darauf hin.</p>
        <p class="helper-text"><strong>SD-Karte:</strong> Bilder, Fonts, Audio und Webseiten können extern gespeichert werden. Firmwarecode und OTA-Partitionen müssen weiterhin in den internen Flash passen. Externe PSRAM vergrößert nur den Arbeitsspeicher, nicht den Firmware-Flash.</p>
      `;
      target.querySelectorAll('input[name="provisioningUpdateProfile"]').forEach((input) => {
        input.addEventListener("change", () => {
          state.provisioningUpdateProfile = input.value;
          renderUpdateProfileChooser();
          renderNetworkDiscovery();
        });
      });
    }

    function updateProfileDefinitions() {
      return [
        {
          id: "full",
          badge: "FULL",
          title: "Maximale Ausfallsicherheit",
          description: "Zwei Firmwarebereiche sorgen dafür, dass die letzte funktionierende Software erhalten bleibt.",
          failure: "Das Board startet weiterhin mit der letzten gültigen Software.",
        },
        {
          id: "medium",
          badge: "MEDIUM",
          title: "Speicheroptimiert",
          description: "Ein kleiner Wiederherstellungsbereich lässt mehr Platz für Display, Sound und Anwendung.",
          failure: "Das Update wird erneut ausgeführt, bis die neue Software vollständig geschrieben wurde.",
        },
        {
          id: "low",
          badge: "LOW",
          title: "Minimalkonfiguration",
          description: "Der größtmögliche Speicherbereich steht der Anwendung zur Verfügung; OTA wird nicht angeboten.",
          failure: "Updates und Wiederherstellung erfolgen ausschließlich über USB.",
        },
      ];
    }

    function selectedFlashSizeMb() {
      const value = state.provisioningFeatureSelections?.flash?.value || "";
      const match = String(value).match(/^(\d+)_mb$/);
      return match ? Number(match[1]) : 0;
    }

    function recommendedUpdateProfile(flashSize) {
      const display = state.provisioningFeatureSelections?.display?.enabled;
      const sound = state.provisioningFeatureSelections?.speaker?.enabled;
      if (!flashSize) return { id: "", text: "Bestätige zuerst die interne Flashgröße. Danach kann GerNetiX eine belastbare Empfehlung geben." };
      if (flashSize >= 16) return { id: "full", text: "FULL – auch mit Display und Sound sind bei üblichen Anwendungen keine Speicherprobleme zu erwarten." };
      if (flashSize >= 8) return { id: "full", text: display && sound
        ? "FULL ist für typische Display- und Soundprojekte geeignet; sehr große Medienbestände werden beim Build erneut geprüft."
        : "FULL bietet normalerweise ausreichend Platz und die höchste Ausfallsicherheit." };
      if (flashSize <= 4 && (display || sound)) return { id: "medium", text: "MEDIUM – bei 4 MB und Display oder Sound ist die Speicherreserve für zwei vollständige Firmwarestände kritisch." };
      return { id: "full", text: "FULL – für kleine Regelungen und Steuerungen ohne umfangreiche Medien ist das 4-MB-Profil normalerweise ausreichend." };
    }

    function updateProfileExamplesTable(flashSize) {
      const rows = [
        [4, "Kleine Regelungen, Sensoren, Relais und LEDs", "Kleines OLED, einfache Menüs, wenige Fonts", "Vollgrafik, viele Ansichten, größere Bilder oder Sound"],
        [8, "Regelungen mit OLED, einfache TFT- und Touch-Oberflächen", "Umfangreiche Touch-Oberflächen, mehrere Ansichten und lokale Daten", "Sehr große Medienanwendungen oder konsequent offline betriebene Spezialprojekte"],
        [16, "Übliche Touchdisplays, Sound, mehrere Ansichten und sichere Updates", "Sehr große Font-, Bild-, Audio- oder Datenbestände", "Außergewöhnlich große Offline-Anwendungen; normalerweise nicht erforderlich"],
      ];
      return `<div class="update-profile-table-wrap"><table class="update-profile-examples">
        <thead><tr><th>Interner Flash</th><th>FULL</th><th>MEDIUM</th><th>LOW</th></tr></thead>
        <tbody>${rows.map((row) => `<tr class="${row[0] === flashSize ? "is-current" : ""}"><td><strong>${row[0]} MB</strong></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`).join("")}</tbody>
      </table></div>`;
    }

    function selectedUpdateProfileConfiguration() {
      const profile = state.provisioningUpdateProfile;
      return ({
        full: {
          profile_id: "basissoftware.profile.esp32.full",
          class: "full",
          partition_profile_id: "partition.profile.esp32.ota_ab",
          update_strategy: "ota_ab_rollback",
          supported_update_modes: ["usb", "ota"],
        },
        medium: {
          profile_id: "basissoftware.profile.esp32.medium",
          class: "medium",
          partition_profile_id: "partition.profile.esp32.bootstrap_single_slot",
          update_strategy: "bootstrap_retry",
          supported_update_modes: ["usb", "ota"],
        },
        low: {
          profile_id: "basissoftware.profile.esp32.low",
          class: "low",
          partition_profile_id: "partition.profile.esp32.single_app_usb",
          update_strategy: "usb_only",
          supported_update_modes: ["usb"],
        },
      })[profile] || null;
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
        basissoftware_profile: selectedUpdateProfileConfiguration(),
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
              ? "Der Browser konnte den STK500v1-Handshake lesen. Die gefuehrte Registrierung fuer AVR-Boards ist noch nicht verfuegbar."
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
        ? "USB identifiziert das verbundene Board und fuehrt anschliessend durch Provisionierung, Registrierung und Pairing."
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
      const profile = selectedUpdateProfileConfiguration();
      const profileCapabilities = profile?.supported_update_modes.includes("ota") ? ["capability.ota"] : [];
      const capabilities = Array.from(new Set([
        ...(device.technical_capability_ids || device.capability_ids || board?.capability_ids || []),
        ...selectedCapabilities,
        ...profileCapabilities,
      ])).filter((capability) => profile?.class !== "low" || !/(^|\.)ota$/.test(capability));
      return {
        ...device,
        board_short_name: shortName,
        node_name: nodeName,
        display_name: device.display_name || shortName || nodeName,
        technical_capability_ids: capabilities,
        ota_status: profile?.class === "low" ? "unsupported" : "unknown",
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
        && (!device.bootloader_type || new Set(["catalog", "manual"]).has(state.provisioningBoardConfigurationMode))
        && (!device.bootloader_type || new Set(["full", "medium", "low"]).has(state.provisioningUpdateProfile))
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

    function boardId(board) {
      return board?.hardware_item_id || board?.hardware_profile_id || "";
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
      discoverNetworkDevices,
      identifyAvrBootloaderExperimental,
      identifyEsp32Bootloader,
      renderNetworkDiscovery,
      searchDevicesForInventory,
      selectDeviceDiscoveryMethod,
      setDiscoveryStatus,
      setInventoryStatus,
      syncInventoryNodeNamePreview,
    };
  }

  return { create };
})();
