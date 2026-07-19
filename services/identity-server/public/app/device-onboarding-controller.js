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
      openHelpTopic,
    } = deps;

    async function discoverNetworkDevices() {
      state.inventoryEsp32Method = "wlan";
      state.discoveredDevices = [];
      state.selectedProvisioningDiscoveryIds = [];
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

    async function scanProvisioningSerialPorts() {
      if (!("serial" in navigator)) {
        setDiscoveryStatus("error", "Web Serial ist in diesem Browser nicht verfuegbar. Verwende das GerNetiX USB Helper Tool.");
        return;
      }
      state.provisioningSerialScanRunning = true;
      state.provisioningSerialScanCompleted = false;
      state.provisioningSerialPort = null;
      state.discoveredDevices = [];
      state.selectedProvisioningDiscoveryIds = [];
      renderNetworkDiscovery();
      setDiscoveryStatus("running", "Serielle Ports werden automatisch gesucht...");
      try {
        const ports = await navigator.serial.getPorts();
        state.provisioningSerialScanCompleted = true;
        state.provisioningSerialPort = ports.length === 1
          ? ports[0]
          : await navigator.serial.requestPort();
        renderNetworkDiscovery();
        await identifyEsp32Bootloader();
      } catch (error) {
        state.provisioningSerialScanCompleted = true;
        renderNetworkDiscovery();
        if (error.name === "NotFoundError") {
          setDiscoveryStatus("hidden", "");
          return;
        }
        setDiscoveryStatus("error", error.message || "Die automatische Suche konnte nicht ausgefuehrt werden.");
      } finally {
        state.provisioningSerialScanRunning = false;
        renderNetworkDiscovery();
      }
    }

    async function selectProvisioningSerialPort() {
      if (!("serial" in navigator)) return;
      try {
        state.provisioningSerialPort = await navigator.serial.requestPort();
        state.provisioningSerialScanCompleted = true;
        state.discoveredDevices = [];
        state.selectedProvisioningDiscoveryIds = [];
        renderNetworkDiscovery();
        setDiscoveryStatus("ok", "Serieller Port gewaehlt. Pruefe jetzt den seriellen Port.");
      } catch (error) {
        if (error.name !== "NotFoundError") setDiscoveryStatus("error", error.message || "Der serielle Port konnte nicht ausgewaehlt werden.");
      }
    }

    async function identifyEsp32Bootloader() {
      const port = state.provisioningSerialPort;
      if (!port) {
        setDiscoveryStatus("error", "Bitte zuerst einen seriellen Port waehlen.");
        return;
      }
      setDiscoveryStatus("running", "Serieller Port und Bootloader werden geprueft...");
      try {
        const info = port.getInfo ? port.getInfo() : {};
        const vendorId = usbIdentifier(info.usbVendorId);
        const productId = usbIdentifier(info.usbProductId);
        const identifier = vendorId && productId ? `${vendorId}:${productId}` : "browser-selected";
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
        resetProvisioningUsbFlash();
        state.selectedProvisioningDiscoveryIds = [];
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
          flash_size: bootloader.flash_size,
          ram_size: bootloader.ram_size,
          psram_size: bootloader.psram_size,
          provisioning_state: "compatible_bootloader_detected",
          connectivity_status: "usb_bootloader_ready",
          ownership_status: "unregistered",
          esp32_inventory_state: "bootloader_only",
          treatment: `${bootloader.name} erkannt. Das Flashen einer kompatiblen Basissoftware ist möglich.`,
          already_in_inventory: false,
        }];
        // Web Serial kann genau einen vom Browser freigegebenen Port pruefen.
        // Ist dessen ESP-Bootloader erkannt, ist dieses eine Board der
        // eindeutige Provisioning-Kandidat und wird ohne weiteren Klick gewählt.
        state.selectedProvisioningDiscoveryIds = [state.discoveredDevices[0].discovery_id];
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
        const flashSize = await loader.detectFlashSize();
        const memory = await espMemoryInfo(loader, chipName);
        return {
          detected: true,
          type: "espressif_rom",
          name: `${chipName || "ESP32"} Bootloader`,
          label: `${chipName || "ESP32"}-kompatibles Board`,
          hardwareProfileId: espHardwareProfile(chipName),
          detail: chipName || "Espressif ROM Bootloader",
          flash_size: flashSize || "unbekannt",
          ram_size: memory.ramSize,
          psram_size: memory.psramSize,
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

    async function espMemoryInfo(loader, chipName) {
      const chip = String(chipName || "").toUpperCase();
      const ramSize = chip.includes("ESP32-S3") ? "512 KB intern" : "unbekannt";
      try {
        const features = await loader.chip?.getChipFeatures?.(loader) || [];
        const psram = features.find((feature) => /PSRAM/i.test(feature));
        return { ramSize, psramSize: psram || "nicht sicher ermittelbar" };
      } catch {
        return { ramSize, psramSize: "nicht sicher ermittelbar" };
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
      state.selectedProvisioningDiscoveryIds = [];
      state.avrBootloaderResult = null;
      state.provisioningBoardConfigurationMode = "";
      state.provisioningKnownBoardId = "";
      state.provisioningFeatureSelections = {};
      state.provisioningDatasheetUrl = "";
      state.provisioningUpdateProfile = "";
      state.provisioningSerialPort = null;
      state.provisioningSerialScanCompleted = false;
      state.provisioningSerialScanRunning = false;
      resetProvisioningUsbFlash();
      renderNetworkDiscovery();
      setDiscoveryStatus("hidden", "");
    }

    async function searchDevicesForInventory() {
      const method = document.querySelector('input[name="deviceDiscoveryMethod"]:checked')?.value || state.inventoryEsp32Method;
      if (!method) {
        setDiscoveryStatus("error", "Bitte zuerst WLAN oder USB als Provisioning-Weg waehlen.");
        return;
      }
      state.inventoryEsp32Method = method;
      if (method === "usb") return scanProvisioningSerialPorts();
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
      const supportsWebSerial = "serial" in navigator;
      const hasSelectedSerialPort = Boolean(state.provisioningSerialPort);
      const hasDetectedBootloader = isUsbSelected && state.discoveredDevices.some((device) => device.bootloader_type);
      const hasBoardConfiguration = new Set(["catalog", "manual"]).has(state.provisioningBoardConfigurationMode);
      document.querySelector("#provisioningAutomaticScanActions").classList.toggle("hidden", !isUsbSelected || !supportsWebSerial || hasSelectedSerialPort || hasDetectedBootloader);
      document.querySelector("#provisioningWebSerialActions").classList.toggle("hidden", !isUsbSelected || !supportsWebSerial || !state.provisioningSerialScanCompleted || hasSelectedSerialPort);
      document.querySelector("#provisioningSerialCheckActions").classList.toggle("hidden", !isUsbSelected || !supportsWebSerial || !hasSelectedSerialPort || hasDetectedBootloader);
      const scanButton = document.querySelector("#scanProvisioningSerialPortsButton");
      scanButton.disabled = Boolean(state.provisioningSerialScanRunning);
      scanButton.textContent = state.provisioningSerialScanRunning ? "Suche laeuft..." : "Automatisch suchen";
      document.querySelector("#provisioningUsbHelperHint").classList.toggle("hidden", !isUsbSelected || supportsWebSerial);
      document.querySelector("#claimSelectedDiscoveredDevicesButton").classList.toggle("hidden",
        !hasSelectedMethod
        || (!actions.wifiDiscovery && !actions.usbIdentification)
        || (hasDetectedBootloader && (!hasBoardConfiguration || !state.provisioningWifiSetupSucceeded)));
      document.querySelector("#provisioningFoundBoardDetails").classList.toggle("hidden", !hasDetectedBootloader);
      document.querySelector("#provisioningBoardFeatures").classList.toggle("hidden", !hasDetectedBootloader);
      document.querySelector("#provisioningUsbFlashStep").classList.toggle("hidden", !hasDetectedBootloader || !hasBoardConfiguration);
      document.querySelector("#provisioningWifiSetupStep").classList.toggle("hidden", !hasDetectedBootloader || !state.provisioningUsbFlashSucceeded);
      const boardDefinitionHelp = document.querySelector("#provisioningBoardDefinitionHelp");
      if (boardDefinitionHelp) boardDefinitionHelp.onclick = () => openHelpTopic("board-definition");
      if (hasDetectedBootloader) renderBoardFeatureChecklist();
      if (hasDetectedBootloader && state.provisioningUsbFlashSucceeded) renderProvisioningWifiSetup();
      updateProvisioningUsbFlashButton();
      void checkProvisioningFirmwareAvailability();
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
          ? ""
          : `<p class="empty">Suche nach einem bereits provisionierten Board im gleichen lokalen WLAN. Die Board-Auswahl ist optional.</p>`;
        updateClaimSelectedButton();
        return;
      }
      list.innerHTML = state.discoveredDevices.map((device) => `
        <article class="discovery-row ${device.ownership_status === "other_account" ? "is-locked" : ""} ${canSelectDiscoveredDevice(device) ? "is-claimable" : ""}">
          <label class="discovery-select ${canSelectDiscoveredDevice(device) ? "is-available" : "is-unavailable"}">
            <input
              type="checkbox"
              data-select-discovered-device="${escapeHtml(device.discovery_id)}"
              ${selectedProvisioningDiscoveryIds().has(device.discovery_id) ? "checked" : ""}
              ${canSelectDiscoveredDevice(device) ? "" : "disabled"}
            />
            <span><strong>Dieses Board auswählen</strong><small>Für die Account-Verbindung</small></span>
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
      list.innerHTML = `
        <div class="discovery-table-scroll">
          <table class="discovery-table">
            <thead><tr><th>Auswahl</th><th>Board</th><th>Bootloader</th><th>Flash</th><th>RAM</th></tr></thead>
            <tbody>${state.discoveredDevices.map((device) => discoveryTableRow(device, board)).join("")}</tbody>
          </table>
        </div>`;
      document.querySelectorAll("[data-select-discovered-device]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const selected = selectedProvisioningDiscoveryIds();
          if (checkbox.checked) selected.add(checkbox.dataset.selectDiscoveredDevice);
          else selected.delete(checkbox.dataset.selectDiscoveredDevice);
          state.selectedProvisioningDiscoveryIds = [...selected];
          updateClaimSelectedButton();
          updateProvisioningUsbFlashButton();
        });
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
      target.innerHTML = renderBoardFeatureTable(state.boardFeatureCatalog, selections);
      const featureHeader = target.querySelector(".board-feature-table thead tr");
      if (featureHeader) {
        featureHeader.children[5].textContent = "Pin-Zuordnung";
        featureHeader.insertAdjacentHTML("beforeend", "<th>Größe / Wert</th>");
      }
      document.querySelector("#provisioningDatasheetUrl").value = state.provisioningDatasheetUrl || "";
      target.querySelectorAll("[data-board-feature-enabled]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => updateBoardFeatureSelection(checkbox.dataset.boardFeatureEnabled));
      });
      target.querySelectorAll("[data-board-feature-field]").forEach((field) => {
        const update = () => updateBoardFeatureSelection(field.closest("[data-board-feature-row]").dataset.boardFeatureRow);
        field.addEventListener("change", update);
        field.addEventListener("input", update);
      });
      target.querySelectorAll("[data-edit-board-feature-pins]").forEach((button) => {
        button.addEventListener("click", () => openBoardFeaturePinEditor(button.dataset.editBoardFeaturePins));
      });
      document.querySelector("#provisioningDatasheetUrl").oninput = (event) => {
        state.provisioningDatasheetUrl = event.target.value.trim();
      };
      renderUpdateProfileChooser();
      return;
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
      target.querySelectorAll("[data-board-feature-field]").forEach((field) => {
        const update = () => updateBoardFeatureSelection(field.closest("[data-board-feature-row]").dataset.boardFeatureRow);
        field.addEventListener("change", update);
        field.addEventListener("input", update);
      });
      document.querySelector("#provisioningDatasheetUrl").oninput = (event) => {
        state.provisioningDatasheetUrl = event.target.value.trim();
      };
      renderUpdateProfileChooser();
    }

    function renderBoardFeatureTable(features, selections) {
      return `<div class="board-feature-table-scroll"><table class="board-feature-table">
        <thead><tr><th aria-label="Aktiv"></th><th>Komponente</th><th>Art</th><th>Treiber</th><th>Anschluss</th><th>Größe / Wert</th></tr></thead>
        <tbody>${features.map((feature) => {
          const selected = selections[feature.feature_id] || {};
          const disabled = selected.enabled ? "" : "disabled";
          return `<tr class="board-feature-row ${selected.enabled ? "" : "is-disabled"}" data-board-feature-row="${escapeHtml(feature.feature_id)}">
            <td class="board-feature-toggle"><input type="checkbox" aria-label="${escapeHtml(feature.title)} aktivieren" data-board-feature-enabled="${escapeHtml(feature.feature_id)}" ${selected.enabled ? "checked" : ""} /></td>
            <td><strong>${escapeHtml(feature.title)}</strong></td>
            <td>${boardFeatureTableSelect("hardware", feature.hardware_options, selected.hardware, `${feature.title}: Art`, disabled)}</td>
            <td>${boardFeatureTableSelect("driver", feature.driver_options, selected.driver, `${feature.title}: Treiber`, disabled)}</td>
            <td>${boardFeatureTableSelect("connection", feature.connection_options, selected.connection, `${feature.title}: Anschluss`, disabled)}</td>
            <td>${boardFeaturePinEditorButton(feature, selected.pins, disabled)}</td>
            <td>${boardFeatureTableSelect("value", feature.value_options, selected.value, `${feature.title}: Größe oder Wert`, disabled)}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>`;
    }

    function boardFeatureTableSelect(field, options, selected, ariaLabel, disabled) {
      const items = Array.isArray(options) ? options : [];
      if (!items.length) return "";
      const selectedIsKnown = !selected || items.some((item) => item.id === selected);
      return `<select aria-label="${escapeHtml(ariaLabel)}" data-board-feature-field="${field}" ${disabled}>
        <option value="">Bitte waehlen</option>
        ${selectedIsKnown ? "" : `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (Boardprofil)</option>`}
        ${items.map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === selected ? "selected" : ""}>${escapeHtml(option.title)}</option>`).join("")}
      </select>`;
    }

    function boardFeaturePinEditorButton(feature, pins, disabled) {
      const assigned = formatBoardFeaturePins(pins);
      return `<button type="button" class="board-feature-pin-editor-button" data-edit-board-feature-pins="${escapeHtml(feature.feature_id)}" aria-label="${escapeHtml(feature.title)}: Pins bearbeiten" title="Pins bearbeiten" ${disabled}><span aria-hidden="true">&#9998;</span><span>Bearbeiten</span>${assigned ? `<small>${escapeHtml(assigned)}</small>` : ""}</button>`;
    }

    function openBoardFeaturePinEditor(featureId) {
      const feature = state.boardFeatureCatalog.find((item) => item.feature_id === featureId);
      if (!feature) return;
      const selected = state.provisioningFeatureSelections?.[featureId] || {};
      const board = selectedProvisioningBoard();
      const availablePins = availableProvisioningPins(board);
      const dialog = document.createElement("dialog");
      dialog.className = "provisioning-pin-editor-dialog";
      dialog.setAttribute("aria-labelledby", "provisioningPinEditorTitle");
      const boardTitle = board?.title || processorVariantForDetectedProfile(state.discoveredDevices.find((item) => item.bootloader_type)?.hardware_profile_id) || "Erkanntes Board";
      dialog.innerHTML = `<form method="dialog" class="provisioning-pin-editor-form"><header><div><p class="eyebrow">Hardware · Pin-Zuordnung</p><h3 id="provisioningPinEditorTitle">${escapeHtml(feature.title)}</h3><p>${escapeHtml(boardTitle)}</p></div><button type="submit" value="cancel" aria-label="Dialog schließen" title="Schließen">×</button></header><div class="provisioning-pin-editor-content"><section><p class="helper-text">Ordne jedem Signal einen GPIO des ausgewählten Boardprofils zu.</p><div class="provisioning-pin-fields">${boardFeaturePinSignals(featureId, selected.pins).map((signal) => pinSelectField(signal, selected.pins?.[signal], availablePins)).join("")}</div></section><aside><h4>Mögliche GPIOs</h4><p>Aus der bekannten ${escapeHtml(board?.mcu_variant || "ESP")}-Konfiguration.</p><div class="provisioning-pin-chip-list">${availablePins.map((pin) => `<span>${escapeHtml(pin)}</span>`).join("") || "<span>Keine GPIOs im Boardprofil hinterlegt</span>"}</div>${occupiedProvisioningPins(featureId, board).length ? `<h4>Bereits belegt</h4><ul>${occupiedProvisioningPins(featureId, board).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}</aside></div><footer><button type="submit" value="cancel">Abbrechen</button><button type="button" class="primary" data-save-board-feature-pins>Übernehmen</button></footer></form>`;
      document.body.append(dialog);
      dialog.addEventListener("close", () => dialog.remove());
      dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
      dialog.querySelector("[data-save-board-feature-pins]").addEventListener("click", () => {
        const pins = {};
        dialog.querySelectorAll("[data-board-feature-pin-signal]").forEach((input) => {
          if (input.value !== "") pins[input.dataset.boardFeaturePinSignal] = Number(input.value);
        });
        state.provisioningFeatureSelections = { ...(state.provisioningFeatureSelections || {}), [featureId]: { ...selected, pins } };
        dialog.close();
        renderNetworkDiscovery();
      });
      dialog.showModal();
    }

    function boardFeaturePinSignals(featureId, pins) {
      const defaults = { display: ["sclk", "mosi", "miso", "cs", "dc", "reset", "backlight"], touch: ["sda", "scl", "interrupt", "reset"], speaker: ["enable", "mclk", "bclk", "data_out", "lrclk"], microphone: ["bclk", "ws", "din"] };
      return [...new Set([...Object.keys(pins || {}), ...(defaults[featureId] || [])])];
    }

    function pinSelectField(signal, currentValue, availablePins) {
      const numericValue = Number.isInteger(currentValue) ? currentValue : "";
      const values = [...new Set([...availablePins, ...(numericValue !== "" ? [`GPIO${numericValue}`] : [])])];
      return `<label>${escapeHtml(signal.toUpperCase())}<select data-board-feature-pin-signal="${escapeHtml(signal)}"><option value="">Nicht belegt</option><option value="-1" ${numericValue === -1 ? "selected" : ""}>Nicht verbunden</option>${values.map((pin) => { const value = Number(String(pin).replace(/\D/g, "")); return `<option value="${value}" ${value === numericValue ? "selected" : ""}>${escapeHtml(pin)}</option>`; }).join("")}</select></label>`;
    }

    function selectedProvisioningBoard() {
      const device = state.discoveredDevices.find((item) => item.bootloader_type) || {};
      return catalogBoardForProfile(state.provisioningKnownBoardId || device.hardware_profile_id || device.detected_hardware_profile_id);
    }

    function availableProvisioningPins(board) {
      const variant = String(board?.mcu_variant || processorVariantForDetectedProfile(state.discoveredDevices.find((item) => item.bootloader_type)?.hardware_profile_id) || "").toUpperCase();
      const configured = (board?.pin_profile?.digital_pins || []).map((pin) => String(pin).match(/GPIO\s*(\d+)/i)?.[1]).filter(Boolean).map((pin) => `GPIO${pin}`);
      if (configured.length && !((variant.includes("S3") || variant.includes("C6")) && configured.some((pin) => /GPIO(?:25|26|27|32|33|34|36|39)/.test(pin)))) return configured;
      if (variant.includes("S3")) return [...Array(22).keys(), ...Array.from({ length: 14 }, (_, index) => index + 35)].map((pin) => `GPIO${pin}`);
      if (variant.includes("C6")) return Array.from({ length: 24 }, (_, index) => `GPIO${index}`);
      return configured;
    }

    function occupiedProvisioningPins(currentFeatureId, board) {
      const boardPins = Object.entries(board?.pin_profile?.assigned_pins || {}).flatMap(([group, pins]) => Object.entries(pins || {}).filter(([, pin]) => Number.isInteger(pin) && pin >= 0).map(([signal, pin]) => `${group}.${signal.toUpperCase()} = GPIO${pin}`));
      const featurePins = Object.entries(state.provisioningFeatureSelections || {}).flatMap(([featureId, selection]) => featureId === currentFeatureId ? [] : Object.entries(selection?.pins || {}).filter(([, pin]) => Number.isInteger(pin) && pin >= 0).map(([signal, pin]) => `${featureId}.${signal.toUpperCase()} = GPIO${pin}`));
      return [...new Set([...boardPins, ...featurePins])];
    }

    function formatBoardFeaturePins(pins) {
      if (!pins || typeof pins !== "object" || Array.isArray(pins)) return String(pins || "");
      return Object.entries(pins)
        .map(([signal, pin]) => `${signal.toUpperCase()}=${Number.isInteger(pin) && pin >= 0 ? `GPIO${pin}` : pin}`)
        .join(", ");
    }

    function parseBoardFeaturePins(value) {
      const text = String(value || "").trim();
      if (!text) return "";
      const entries = text.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
      const pins = {};
      for (const entry of entries) {
        const match = entry.match(/^([a-z0-9_ -]+)\s*[=:]\s*(?:gpio)?\s*(-?\d+)$/i);
        if (!match) return text;
        pins[match[1].trim().toLowerCase().replace(/\s+/g, "_")] = Number(match[2]);
      }
      return Object.keys(pins).length ? pins : text;
    }

    function renderKnownBoardSelection() {
      const select = document.querySelector("#provisioningKnownBoard");
      const device = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!select || !device) return;
      const detectedProfileId = device.detected_hardware_profile_id || device.hardware_profile_id;
      const detectedBoard = catalogBoardForProfile(detectedProfileId);
      const candidates = compatibleProcessorBoards(detectedBoard);
      select.innerHTML = [
        `<option value="" ${state.provisioningBoardConfigurationMode ? "" : "selected"} disabled hidden>Board auswählen...</option>`,
        `<option value="__manual__" ${state.provisioningBoardConfigurationMode === "manual" ? "selected" : ""}>Manuell konfigurieren</option>`,
        ...candidates.map((board) => `<option value="${escapeHtml(boardId(board))}" ${boardId(board) === state.provisioningKnownBoardId ? "selected" : ""}>${escapeHtml(board.title)}</option>`),
      ].join("");
      select.onchange = selectKnownProvisioningBoard;
    }

    function compatibleProcessorBoards(detectedBoard) {
      // The ROM bootloader tells us the chip family, not the concrete board
      // model.  A generic detected profile (for example ESP32-S3) therefore
      // deliberately has no catalog entry.  Still offer every catalog board
      // with the same MCU family so the user can make the actual choice.
      const detectedProfileId = detectedBoard ? boardId(detectedBoard) : (
        state.discoveredDevices.find((item) => item.bootloader_type)?.detected_hardware_profile_id || ""
      );
      const variant = normalizeProcessorVariant(
        detectedBoard?.mcu_variant || processorVariantForDetectedProfile(detectedProfileId),
      );
      if (!variant) return [];
      const boards = state.processorBoards.length ? state.processorBoards : fallbackProcessorBoards();
      return boards
        .filter((board) => !board.item_type || board.item_type === "processor_board")
        .filter((board) => normalizeProcessorVariant(board.mcu_variant) === variant)
        .sort((left, right) => {
          const verified = Number(right.verification_status === "locally_verified") - Number(left.verification_status === "locally_verified");
          return verified || String(left.title).localeCompare(String(right.title), "de");
        });
    }

    function processorVariantForDetectedProfile(profileId) {
      const value = String(profileId || "").toLowerCase();
      if (value.includes("esp32_s3") || value.includes("esp32-s3")) return "ESP32-S3";
      if (value.includes("esp32_c6") || value.includes("esp32-c6")) return "ESP32-C6";
      if (value.includes("esp8266")) return "ESP8266EX";
      if (value.includes("esp32")) return "ESP32";
      return "";
    }

    function normalizeProcessorVariant(value) {
      return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function selectKnownProvisioningBoard(event) {
      const hardwareProfileId = event.target.value;
      if (hardwareProfileId === "__manual__") {
        activateManualBoardConfiguration();
        return;
      }
      const device = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!device) return;
      state.provisioningKnownBoardId = hardwareProfileId;
      state.provisioningBoardConfigurationMode = hardwareProfileId ? "catalog" : "";
      state.provisioningUpdateProfile = "";
      resetProvisioningUsbFlash();
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
      resetProvisioningUsbFlash();
      device.hardware_profile_id = device.detected_hardware_profile_id || device.hardware_profile_id;
      renderNetworkDiscovery();
    }

    function applyKnownBoardDefaults(board) {
      const defaults = board?.default_instance_configuration || {};
      const integratedMemoryDrivers = {
        ram: "esp_idf_heap",
        psram: "esp_idf_heap_psram",
        flash: "esp_idf_partition_table",
      };
      state.provisioningFeatureSelections = Object.fromEntries(Object.entries(defaults.board_features || {}).map(([featureId, value]) => [
        featureId,
        { ...value, driver: value.driver || integratedMemoryDrivers[featureId] || "", enabled: value.enabled !== false },
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
      const pinField = row.querySelector('[data-board-feature-field="pins"]');
      state.provisioningFeatureSelections = {
        ...(state.provisioningFeatureSelections || {}),
        [featureId]: {
          ...existing,
          enabled,
          hardware: read("hardware"),
          driver: read("driver"),
          connection: read("connection"),
          pins: pinField ? parseBoardFeaturePins(pinField.value) : (existing.pins || ""),
          value: read("value"),
        },
      };
      row.classList.toggle("is-disabled", !enabled);
      row.querySelectorAll("[data-board-feature-field]").forEach((select) => { select.disabled = !enabled; });
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
      const profiles = updateProfileDefinitions();
      target.innerHTML = `
        <div class="provisioning-update-profile-head">
          <h4 id="provisioningUpdateProfileTitle">Varianten der Komfort- und Sicherheitsoptionen</h4>
          <a class="provisioning-help-link" href="/app/help/#update-profiles" aria-label="Hilfe zu Komfort- und Sicherheitsoptionen" title="Wann wähle ich welche Variante?">?</a>
        </div>
        <div class="update-profile-options">
          ${profiles.map((profile) => `<label class="update-profile-option">
            <input type="radio" name="provisioningUpdateProfile" value="${profile.id}" ${state.provisioningUpdateProfile === profile.id ? "checked" : ""} />
            <span>
              <em class="update-profile-badge">${profile.badge}</em>
              <strong>${profile.title}</strong>
            </span>
          </label>`).join("")}
        </div>
      `;
      target.querySelectorAll('input[name="provisioningUpdateProfile"]').forEach((input) => {
        input.addEventListener("change", () => {
          state.provisioningUpdateProfile = input.value;
          resetProvisioningUsbFlash();
          renderUpdateProfileChooser();
          renderNetworkDiscovery();
        });
      });
      target.querySelector(".provisioning-help-link")?.addEventListener("click", (event) => {
        event.preventDefault();
        openHelpTopic("update-profiles");
      });
      document.querySelector(".provisioning-wifi-help-link")?.addEventListener("click", (event) => {
        event.preventDefault();
        openHelpTopic("usb-wifi-setup");
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
            pins: value.pins || "",
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

    function discoveryTableRow(device, board) {
      const selectable = canSelectDiscoveredDevice(device);
      const selected = selectedProvisioningDiscoveryIds().has(device.discovery_id);
      const boardName = device.bootloader_type
        ? String(device.display_name || "ESP-kompatibles Board").replace(/-kompatibles Board$/, "")
        : device.display_name || device.serial_number || device.source_url;
      const bootloader = device.bootloader_type
        ? device.bootloader_detail || device.bootloader_name
        : model.stateText(model.classifyDiscoveredDevice(device, board));
      const flash = device.flash_size || (device.bootloader_type ? "unbekannt" : "–");
      const ram = device.ram_size
        ? `${device.ram_size}${device.psram_size && device.psram_size !== "nicht sicher ermittelbar" ? ` + ${device.psram_size}` : ""}`
        : "–";
      return `
        <tr class="${device.ownership_status === "other_account" ? "is-locked" : ""}">
          <td><label class="discovery-table-select"><input type="checkbox" aria-label="${escapeHtml(boardName)} auswählen" data-select-discovered-device="${escapeHtml(device.discovery_id)}" ${selected ? "checked" : ""} ${selectable ? "" : "disabled"} /> Auswählen</label></td>
          <td><strong>${escapeHtml(boardName)}</strong></td>
          <td>${escapeHtml(bootloader)}</td>
          <td>${escapeHtml(flash)}</td>
          <td>${escapeHtml(ram)}</td>
        </tr>`;
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
        ? ""
        : "WLAN sucht ausschliesslich nach bereits provisionierten, erreichbaren gernetix-* Nodes im gleichen lokalen Netzwerk.";
    }

    function discoveryActionsForBoard() {
      return {
        wifiDiscovery: true,
        usbIdentification: true,
        usbFlash: true,
        ota: false,
        basissoftware: false,
        captiveSetup: false,
      };
    }

    function resetProvisioningUsbFlash() {
      state.provisioningUsbFlashSucceeded = false;
      state.provisioningUsbFlashRunning = false;
      state.provisioningPairingToken = "";
      state.provisioningBinding = "";
      state.provisioningWifiNetworks = [];
      state.provisioningWifiSetupRunning = false;
      state.provisioningWifiSetupSucceeded = false;
      state.provisioningSerialReady = false;
      state.provisioningSerialReadyWaiting = false;
      state.provisioningFirmwareAvailability = { state: "idle", requestKey: "", message: "", artifact: null };
      const status = document.querySelector("#provisioningUsbFlashStatus");
      if (status) {
        status.className = "flash-status hidden";
        status.textContent = "";
      }
    }

    function renderProvisioningWifiSetup() {
      const scanButton = document.querySelector("#scanProvisioningWifiButton");
      const selection = document.querySelector("#provisioningWifiNetworkSelection");
      const select = document.querySelector("#provisioningWifiSsid");
      const manualLabel = document.querySelector("#provisioningWifiManualSsidLabel");
      const connectButton = document.querySelector("#connectProvisioningWifiButton");
      if (!scanButton || !selection || !select || !manualLabel || !connectButton) return;
      scanButton.disabled = state.provisioningWifiSetupRunning || !state.provisioningSerialReady;
      scanButton.textContent = state.provisioningWifiSetupRunning
        ? "WLANs werden gesucht..."
        : state.provisioningSerialReady
          ? "WLANs suchen"
          : "Board startet...";
      selection.classList.toggle("hidden", state.provisioningWifiNetworks.length === 0 || state.provisioningWifiSetupSucceeded);
      select.innerHTML = [
        '<option value="" selected disabled>WLAN auswählen...</option>',
        ...state.provisioningWifiNetworks.map((network) => `<option value="${escapeHtml(network.ssid)}">${escapeHtml(network.ssid)}${network.secure ? "" : " (offen)"} · ${escapeHtml(network.rssi)} dBm</option>`),
        '<option value="__manual__">Anderes oder verborgenes WLAN</option>',
      ].join("");
      select.onchange = () => manualLabel.classList.toggle("hidden", select.value !== "__manual__");
      connectButton.disabled = state.provisioningWifiSetupRunning || !state.provisioningPairingToken;
      if (state.provisioningSerialReadyWaiting && !state.provisioningWifiSetupSucceeded) {
        setProvisioningWifiStatus("running", "Das Board startet. Die WLAN-Suche wird freigegeben, sobald es über USB „Status: running“ meldet.");
      } else if (!state.provisioningPairingToken && !state.provisioningWifiSetupSucceeded && !state.provisioningWifiSetupRunning) {
        setProvisioningWifiStatus("running", "WLANs können bereits lokal gesucht werden. Die sichere Account-Zuordnung wird parallel vorbereitet.");
      }
    }

    function setProvisioningWifiStatus(kind, message) {
      const status = document.querySelector("#provisioningWifiSetupStatus");
      if (!status) return;
      status.className = `flash-status ${kind}`;
      status.textContent = message;
    }

    async function prepareProvisioningWifiSetup() {
      const device = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!device) throw new Error("Kein USB-Board für die WLAN-Einrichtung gefunden.");
      state.provisioningBinding = device.discovery_id;
      const session = await postJson("/api/platform/provisioning/session", {
        provisioning_binding: state.provisioningBinding,
      });
      state.provisioningPairingToken = session.provisioning_token;
      setProvisioningWifiStatus("ok", "Bereit. Die WLAN-Daten bleiben ausschließlich auf deinem Board.");
      renderNetworkDiscovery();
    }

    async function scanProvisioningWifiNetworks() {
      state.provisioningWifiSetupRunning = true;
      renderProvisioningWifiSetup();
      setProvisioningWifiStatus("running", "Board sucht verfügbare WLANs...");
      try {
        const response = await serialProvisioningRequest("wifi_scan");
        const strongestNetworkBySsid = new Map();
        for (const network of (response.payload?.networks || []).filter((item) => item.ssid)) {
          const known = strongestNetworkBySsid.get(network.ssid);
          if (!known || Number(network.rssi) > Number(known.rssi)) strongestNetworkBySsid.set(network.ssid, network);
        }
        state.provisioningWifiNetworks = [...strongestNetworkBySsid.values()]
          .sort((left, right) => Number(right.rssi) - Number(left.rssi));
        setProvisioningWifiStatus("ok", state.provisioningWifiNetworks.length
          ? "WLANs gefunden. Wähle dein Netzwerk und gib das Passwort ein."
          : "Kein sichtbares WLAN gefunden. Du kannst ein verborgenes WLAN manuell eingeben.");
        if (!state.provisioningWifiNetworks.length) state.provisioningWifiNetworks = [{ ssid: "", rssi: 0, secure: true }];
      } catch (error) {
        setProvisioningWifiStatus("error", error.message || "WLANs konnten nicht gesucht werden.");
      } finally {
        state.provisioningWifiSetupRunning = false;
        renderProvisioningWifiSetup();
      }
    }

    async function connectProvisioningWifi() {
      const select = document.querySelector("#provisioningWifiSsid");
      const manual = document.querySelector("#provisioningWifiManualSsid");
      const password = document.querySelector("#provisioningWifiPassword");
      const ssid = select?.value === "__manual__" ? manual?.value.trim() : select?.value;
      if (!ssid || !password || !state.provisioningPairingToken) {
        setProvisioningWifiStatus("error", "Bitte WLAN und Passwort eingeben.");
        return;
      }
      state.provisioningWifiSetupRunning = true;
      renderProvisioningWifiSetup();
      setProvisioningWifiStatus("running", "WLAN-Daten werden direkt per USB an das Board übertragen...");
      try {
        try {
          await serialProvisioningRequest("wifi_connect", { ssid, password: password.value });
        } catch (error) {
          // The command is idempotent only until the board starts its connect
          // task.  Do not retransmit it after a missing USB acknowledgement:
          // the credentials may already be stored and a second request would
          // be rejected as "connect already running".  The authoritative
          // result is the next wifi_status response.
          if (!/nicht rechtzeitig geantwortet/i.test(String(error?.message || ""))) throw error;
          setProvisioningWifiStatus("running", "Die USB-Bestätigung blieb aus. Das Board prüft jetzt die WLAN-Verbindung...");
        }
        password.value = "";
        await waitForProvisioningWifiConnection();
        state.provisioningWifiSetupSucceeded = true;
        await completeProvisioningOverWifi();
      } catch (error) {
        password.value = "";
        setProvisioningWifiStatus("error", error.message || "Das Board konnte nicht mit dem WLAN verbunden werden.");
      } finally {
        state.provisioningWifiSetupRunning = false;
        renderProvisioningWifiSetup();
      }
    }

    async function waitForProvisioningWifiConnection() {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await delay(1000);
        const response = await serialProvisioningRequest("wifi_status");
        const stateName = response.payload?.state || "";
        if (stateName === "connected") return;
        if (stateName === "failed") {
          const disconnectReason = Number(response.payload?.last_disconnect_reason || 0);
          const connectStatus = Number(response.payload?.last_connect_status || 0);
          const detail = [
            disconnectReason ? `WLAN-Trennungsgrund ${disconnectReason}` : "",
            connectStatus ? `ESP-Status ${connectStatus}` : "",
          ].filter(Boolean).join(", ");
          throw new Error(`Das Board konnte keine WLAN-Verbindung aufbauen.${detail ? ` ${detail}.` : " Prüfe Passwort und Reichweite."}`);
        }
      }
      throw new Error("Das Board verbindet noch. Bitte prüfe das WLAN und versuche es erneut.");
    }

    async function completeProvisioningOverWifi() {
      const discovered = state.discoveredDevices.find((item) => item.bootloader_type);
      if (!discovered) throw new Error("Das Board konnte nicht mehr dem USB-Provisioning zugeordnet werden.");
      setProvisioningWifiStatus("running", "WLAN-Verbindung bestätigt. Device wird registriert und deinem Account zugeordnet...");
      const device = await postJson("/api/platform/provisioning/complete", {
        ...withOnboardingIdentity({ ...discovered, connectivity_status: "online", esp32_inventory_state: "node_online" }),
        provisioning_token: state.provisioningPairingToken,
        provisioning_binding: state.provisioningBinding,
      });
      if (device.account) state.account = device.account;
      state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
      state.discoveredDevices = [];
      state.provisioningPairingToken = "";
      state.activeDeviceId = device.device_id;
      renderIdeShell();
      renderDevices();
      renderDashboard();
      renderNetworkDiscovery();
      setProvisioningWifiStatus("ok", device.recovery_token_assigned
        ? "Erledigt: Board ist verbunden und als dein erstes ESP32-Recovery-Token registriert."
        : "Erledigt: Board ist per WLAN verbunden, registriert und deinem Account zugeordnet.");
    }

    async function serialProvisioningRequest(action, payload = {}) {
      const requestId = crypto.randomUUID();
      let reader = null;
      let writer = null;
      let openedHere = false;
      let port = null;
      try {
        const connection = await ensureProvisioningSerialConnection();
        port = connection.port;
        openedHere = connection.openedHere;
        reader = port.readable.getReader();
        writer = port.writable.getWriter();
        const command = new TextEncoder().encode(`${JSON.stringify({ type: "gernetix.serial_provisioning", action, request_id: requestId, ...payload })}\n`);
        await writer.write(command);
        const decoder = new TextDecoder();
        let buffer = "";
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          const result = await Promise.race([
            reader.read(),
            delay(Math.max(1, deadline - Date.now())).then(() => ({ timeout: true })),
          ]);
          if (result?.timeout) break;
          if (result.done) break;
          buffer += decoder.decode(result.value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            try {
              const message = JSON.parse(line);
              if (message.type !== "gernetix.serial_provisioning" || message.request_id !== requestId) continue;
              if (message.event === "error") throw new Error("Das Board hat die Anfrage abgelehnt.");
              return message;
            } catch (error) {
              if (error instanceof SyntaxError) continue;
              throw error;
            }
          }
        }
        throw new Error("Das Board hat nicht rechtzeitig geantwortet. Warte nach dem Flash kurz und versuche es erneut.");
      } finally {
        try { await reader?.cancel(); } catch {}
        try { reader?.releaseLock(); } catch {}
        try { writer?.releaseLock(); } catch {}
        if (openedHere) {
          try { await port.close(); } catch {}
        }
      }
    }

    async function ensureProvisioningSerialConnection() {
      let port = state.provisioningSerialPort;
      if (!port) throw new Error("Der serielle Port ist nicht mehr verbunden.");
      if (port.readable && port.writable) return { port, openedHere: false };
      const previousInfo = port.getInfo ? port.getInfo() : {};
      try {
        await port.close();
      } catch {
        // Ein bereits geschlossener Port oder ein gerade abgemeldetes Board
        // braucht vor dem erneuten Öffnen keine weitere Behandlung.
      }
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await delay(500);
        try {
          // Ein Hardware-Reset kann den nativen USB-Port neu anmelden. Der
          // Browser kennt ihn bereits, liefert aber ein neues Port-Objekt.
          const ports = await navigator.serial.getPorts();
          const replacement = ports.find((candidate) => {
            const info = candidate.getInfo ? candidate.getInfo() : {};
            return info.usbVendorId === previousInfo.usbVendorId
              && info.usbProductId === previousInfo.usbProductId;
          });
          if (replacement) {
            port = replacement;
            state.provisioningSerialPort = replacement;
          }
          await port.open({ baudRate: 115200 });
          return { port, openedHere: true };
        } catch (cause) {
          // Chromium kann nach einem Hardware-Reset kurz noch den alten,
          // bereits geschlossenen Port-Zustand melden. Falls die Streams
          // inzwischen wieder da sind, ist kein zweites Öffnen nötig.
          if (port.readable && port.writable) return { port, openedHere: false };
          if (attempt === 3) {
            throw new Error("Die USB-Verbindung zum Board konnte nach dem Reset nicht neu geöffnet werden. Wähle den COM-Port erneut aus und versuche es noch einmal.", { cause });
          }
          try { await port.close(); } catch {}
        }
      }
      return { port, openedHere: false };
    }

    async function waitForProvisioningSerialReady() {
      if (state.provisioningSerialReady || state.provisioningSerialReadyWaiting) return;
      state.provisioningSerialReadyWaiting = true;
      renderProvisioningWifiSetup();
      let reader = null;
      try {
        const connection = await ensureProvisioningSerialConnection();
        reader = connection.port.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const result = await reader.read();
          if (result.done) throw new Error("Die USB-Verbindung wurde geschlossen, bevor das Board gestartet ist.");
          buffer += decoder.decode(result.value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          if (lines.some((line) => /publishStatus: Status: running|Local USB WiFi provisioning is ready/.test(line))) {
            state.provisioningSerialReady = true;
            setProvisioningWifiStatus("ok", "Board gestartet. WLANs können jetzt gesucht werden.");
            return;
          }
        }
      } catch (error) {
        state.provisioningSerialReady = false;
        setProvisioningWifiStatus("error", error.message || "Das Board konnte nicht über USB als gestartet erkannt werden.");
      } finally {
        try { reader?.releaseLock(); } catch {}
        state.provisioningSerialReadyWaiting = false;
        renderProvisioningWifiSetup();
      }
    }

    function updateProvisioningUsbFlashButton() {
      const button = document.querySelector("#flashProvisioningBasissoftwareButton");
      if (!button) return;
      const disabledReason = document.querySelector("#provisioningUsbFlashDisabledReason");
      const reasons = provisioningUsbFlashDisabledReasons();
      const ready = reasons.length === 0;
      button.disabled = !ready || state.provisioningUsbFlashRunning || state.provisioningUsbFlashSucceeded;
      button.textContent = state.provisioningUsbFlashRunning
        ? "Basissoftware wird geflasht..."
        : state.provisioningUsbFlashSucceeded
          ? "Basissoftware erfolgreich geflasht"
          : "Basissoftware flashen";
      if (disabledReason) {
        disabledReason.textContent = state.provisioningUsbFlashRunning
          ? "Der Flashvorgang laeuft. Bitte das Board verbunden lassen."
          : state.provisioningUsbFlashSucceeded
            ? "Der Flash ist abgeschlossen. Das Board kann jetzt registriert und verbunden werden."
            : reasons.length
              ? `Noch erforderlich: ${reasons.join(" · ")}`
              : "Alle Voraussetzungen sind erfuellt. Du kannst die Basissoftware jetzt flashen.";
      }
    }

    function provisioningUsbFlashDisabledReasons() {
      const reasons = [];
      if (state.inventoryEsp32Method !== "usb") reasons.push("USB als Provisioning-Weg waehlen");
      if (!state.provisioningSerialPort) reasons.push("seriellen Port auswaehlen");
      if (!state.discoveredDevices.some((device) => device.bootloader_type === "espressif_rom")) reasons.push("kompatiblen ESP32-Bootloader erkennen");
      if (!state.discoveredDevices.some((device) => device.bootloader_type && selectedProvisioningDiscoveryIds().has(device.discovery_id))) reasons.push("dieses Board fuer die Account-Verbindung auswaehlen");
      if (!new Set(["catalog", "manual"]).has(state.provisioningBoardConfigurationMode)) reasons.push("Boardmodell waehlen oder Ausstattung manuell festlegen");
      if (!new Set(["full", "medium", "low"]).has(state.provisioningUpdateProfile)) reasons.push("Update- und Speicherprofil waehlen");
      const firmwareRequest = provisioningFirmwareRequestDetails();
      const availability = state.provisioningFirmwareAvailability || {};
      if (firmwareRequest && availability.requestKey !== firmwareRequest.key) reasons.push("verfuegbare Basissoftware pruefen");
      if (firmwareRequest && availability.requestKey === firmwareRequest.key && availability.state === "loading") reasons.push("verfuegbare Basissoftware wird geprueft");
      if (firmwareRequest && availability.requestKey === firmwareRequest.key && ["unavailable", "error"].includes(availability.state)) reasons.push(availability.message);
      return reasons;
    }

    function provisioningFirmwareRequestDetails() {
      const device = state.discoveredDevices.find((item) => item.bootloader_type && selectedProvisioningDiscoveryIds().has(item.discovery_id));
      const boardConfiguration = selectedBoardFeatureConfiguration();
      const hardwareProfileId = state.provisioningKnownBoardId || device?.hardware_profile_id || "";
      const flashSizeMb = Number(String(boardConfiguration.board_features?.flash?.value || "").match(/^(\d+)_mb$/)?.[1] || 0);
      const profile = state.provisioningUpdateProfile;
      if (!device || !hardwareProfileId || ![4, 8, 16].includes(flashSizeMb) || !new Set(["full", "medium", "low"]).has(profile)) return null;
      return {
        profile,
        hardwareProfileId,
        flashSizeMb,
        processorVariant: processorVariantForDetectedProfile(device.detected_hardware_profile_id || device.hardware_profile_id) || "ESP32",
        key: [profile, hardwareProfileId, flashSizeMb].join(":"),
      };
    }

    function renderProvisioningFirmwareAvailability() {
      const target = document.querySelector("#provisioningFirmwareAvailability");
      if (!target) return;
      const availability = state.provisioningFirmwareAvailability || {};
      const visible = ["loading", "available", "unavailable", "error"].includes(availability.state);
      target.className = `flash-status ${availability.state === "available" ? "ok" : ["unavailable", "error"].includes(availability.state) ? "error" : availability.state === "loading" ? "running" : "hidden"}`;
      target.classList.toggle("hidden", !visible);
      target.textContent = availability.message || "";
    }

    async function checkProvisioningFirmwareAvailability() {
      const request = provisioningFirmwareRequestDetails();
      if (!request) {
        if (state.provisioningFirmwareAvailability?.state !== "idle") {
          state.provisioningFirmwareAvailability = { state: "idle", requestKey: "", message: "", artifact: null };
          renderProvisioningFirmwareAvailability();
        }
        return;
      }
      const current = state.provisioningFirmwareAvailability || {};
      if (current.requestKey === request.key && ["loading", "available", "unavailable", "error"].includes(current.state)) {
        renderProvisioningFirmwareAvailability();
        return;
      }
      state.provisioningFirmwareAvailability = {
        state: "loading",
        requestKey: request.key,
        message: `Pruefe Basissoftware fuer ${request.processorVariant} mit ${request.flashSizeMb} MB Flash...`,
        artifact: null,
      };
      renderProvisioningFirmwareAvailability();
      updateProvisioningUsbFlashButton();
      try {
        const artifact = await getJson(`/api/platform/provisioning-firmware?profile=${encodeURIComponent(request.profile)}&hardware_profile_id=${encodeURIComponent(request.hardwareProfileId)}&flash_size_mb=${request.flashSizeMb}`);
        if (state.provisioningFirmwareAvailability?.requestKey !== request.key) return;
        state.provisioningFirmwareAvailability = {
          state: "available",
          requestKey: request.key,
          message: `Passende Basissoftware ist verfuegbar${artifact.version ? ` (${artifact.version})` : ""}.`,
          artifact,
        };
      } catch (error) {
        if (state.provisioningFirmwareAvailability?.requestKey !== request.key) return;
        const isMissingConfiguration = [404, 409, 503].includes(Number(error?.status))
          || String(error?.code || "").startsWith("provisioning_");
        state.provisioningFirmwareAvailability = {
          state: isMissingConfiguration ? "unavailable" : "error",
          requestKey: request.key,
          message: isMissingConfiguration
            ? `Derzeit gibt es keine Basissoftware fuer diese Konfiguration (${request.processorVariant}, ${request.flashSizeMb} MB Flash).`
            : `Die Verfuegbarkeit der Basissoftware konnte nicht geprueft werden: ${error?.message || "unbekannter Fehler"}`,
          artifact: null,
        };
      }
      renderProvisioningFirmwareAvailability();
      updateProvisioningUsbFlashButton();
    }

    function setProvisioningUsbFlashStatus(kind, message) {
      const status = document.querySelector("#provisioningUsbFlashStatus");
      if (!status) return;
      status.className = `flash-status ${kind}`;
      status.textContent = message;
    }

    async function flashProvisioningBasissoftware() {
      if (state.provisioningUsbFlashRunning) return;
      updateProvisioningUsbFlashButton();
      const button = document.querySelector("#flashProvisioningBasissoftwareButton");
      if (!button || button.disabled) return;
      state.provisioningUsbFlashRunning = true;
      state.provisioningUsbFlashSucceeded = false;
      updateProvisioningUsbFlashButton();
      setProvisioningUsbFlashStatus("running", "Factory-Basissoftware wird geladen...");
      let transport = null;
      try {
        const firmwareRequest = provisioningFirmwareRequestDetails();
        if (!firmwareRequest) throw new Error("Die Firmware-Konfiguration ist nicht vollstaendig.");
        const availability = state.provisioningFirmwareAvailability || {};
        const artifact = availability.requestKey === firmwareRequest.key && availability.state === "available"
          ? availability.artifact
          : await getJson(`/api/platform/provisioning-firmware?profile=${encodeURIComponent(firmwareRequest.profile)}&hardware_profile_id=${encodeURIComponent(firmwareRequest.hardwareProfileId)}&flash_size_mb=${firmwareRequest.flashSizeMb}`);
        const response = await fetch(artifact.content_url, { credentials: "same-origin" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || `Firmware konnte nicht geladen werden (${response.status}).`);
        }
        const firmware = new Uint8Array(await response.arrayBuffer());
        const { ESPLoader, Transport } = await loadIdeEsptoolModule();
        transport = new Transport(state.provisioningSerialPort, false);
        const loader = new ESPLoader({
          transport,
          baudrate: 115200,
          terminal: { clean() {}, writeLine() {}, write() {} },
          debugLogging: false,
        });
        setProvisioningUsbFlashStatus("running", "Board wird verbunden...");
        const portInfo = state.provisioningSerialPort.getInfo ? state.provisioningSerialPort.getInfo() : {};
        const usesNativeUsbSerialJtag = portInfo.usbVendorId === 0x303A && portInfo.usbProductId === 0x1001;
        const chipName = await loader.main(usesNativeUsbSerialJtag ? "usb_reset" : "default_reset");
        await loader.writeFlash({
          fileArray: [{ data: firmware, address: Number(artifact.flash_offset || 0) }],
          flashMode: artifact.flash_mode || "dio",
          flashFreq: artifact.flash_freq || "40m",
          flashSize: artifact.flash_size || "keep",
          eraseAll: false,
          compress: true,
          reportProgress: (_index, written, total) => {
            const percent = Math.min(100, Math.round((written / Math.max(total, 1)) * 100));
            setProvisioningUsbFlashStatus("running", `${chipName || "ESP32"}: Basissoftware${artifact.version ? ` ${artifact.version}` : ""} schreiben ${percent} %`);
          },
        });
        setProvisioningUsbFlashStatus("running", "Firmware geschrieben. Board wird neu gestartet...");
        // The USB-JTAG reset sequence used before `loader.main("usb_reset")`
        // enters download mode.  To leave it, release the boot pin, pulse
        // reset, then release reset again: the same electrical sequence as a
        // manual reset button press while GPIO0 is not held low.
        if (usesNativeUsbSerialJtag) {
          await transport.setDTR(false);
          await transport.setRTS(true);
          await delay(100);
          await transport.setRTS(false);
          await delay(300);
        } else {
          await loader.after("hard_reset");
        }
        await transport.disconnect();
        transport = null;
        // Der USB-Port wird erst bei der konkreten WLAN-Abfrage geöffnet. Das
        // verhindert, dass ein noch auslaufender Bootloader-Handle den Flash-
        // Ablauf blockiert.
        state.provisioningUsbFlashSucceeded = true;
        setProvisioningUsbFlashStatus("ok", `Basissoftware${artifact.version ? ` ${artifact.version}` : ""} wurde erfolgreich geflasht. WLAN-Einrichtung wird vorbereitet.`);
        void waitForProvisioningSerialReady();
        prepareProvisioningWifiSetup().catch((setupError) => {
          setProvisioningWifiStatus("error", `${setupError.message || "Sichere Account-Zuordnung konnte noch nicht vorbereitet werden."} WLANs können weiterhin lokal gesucht werden.`);
        });
        renderNetworkDiscovery();
      } catch (error) {
        try { await transport?.disconnect(); } catch {}
        setProvisioningUsbFlashStatus("error", `${error.message || "USB-Flash fehlgeschlagen."} Das Board kann erneut geflasht oder unter Recovery gerettet werden.`);
      } finally {
        state.provisioningUsbFlashRunning = false;
        updateProvisioningUsbFlashButton();
      }
    }

    async function claimDiscoveredDevice(discoveryId) {
      const discovered = state.discoveredDevices.find((item) => item.discovery_id === discoveryId);
      if (!discovered) return;
      setDiscoveryStatus("running", `${discovered.display_name || discovered.serial_number} wird registriert und mit deinem Account verbunden...`);
      try {
        const device = await postJson("/api/platform/devices/from-discovery", withOnboardingIdentity(discovered));
        if (device.account) state.account = device.account;
        state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
        state.discoveredDevices = state.discoveredDevices.filter((item) => item.discovery_id !== discoveryId);
        state.activeDeviceId = device.device_id;
        renderIdeShell();
        renderNetworkDiscovery();
        renderDevices();
        renderDashboard();
        setDiscoveryStatus("ok", device.recovery_token_assigned
          ? `${device.display_name} wurde als dein erstes ESP32-Recovery-Token provisioniert und verbunden.`
          : `${device.display_name} wurde provisioniert und mit deinem Account verbunden.`);
      } catch (error) {
        setDiscoveryStatus("error", error.message);
      }
    }

    async function claimSelectedDiscoveredDevices() {
      const selectedIds = [...selectedProvisioningDiscoveryIds()];
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
          if (device.account) state.account = device.account;
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
      const selectedIds = [...selectedProvisioningDiscoveryIds()];
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
        && (!device.bootloader_type || state.provisioningUsbFlashSucceeded)
        && (!device.bootloader_type || state.provisioningWifiSetupSucceeded)
        && claimableStates.has(device.esp32_inventory_state);
    }

    function canSelectDiscoveredDevice(device) {
      return Boolean(device)
        && !device.already_in_inventory
        && device.ownership_status !== "other_account";
    }

    function selectedProvisioningDiscoveryIds() {
      return new Set(state.selectedProvisioningDiscoveryIds || []);
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
      connectProvisioningWifi,
      discoverNetworkDevices,
      identifyAvrBootloaderExperimental,
      identifyEsp32Bootloader,
      scanProvisioningSerialPorts,
      scanProvisioningWifiNetworks,
      selectProvisioningSerialPort,
      flashProvisioningBasissoftware,
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
