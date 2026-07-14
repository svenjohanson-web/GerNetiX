const DeviceOnboardingModel = (() => {
  const GER_NETIX_PREFIX = "gernetix-";

  function boardFamily(board) {
    const explicit = String(board?.processor_family || "").toLowerCase();
    if (explicit) return explicit;
    const text = [
      board?.hardware_item_id,
      board?.title,
      board?.mcu_variant,
      ...(board?.capability_ids || []),
    ].join(" ").toLowerCase();
    if (text.includes("esp8266")) return "esp8266";
    if (text.includes("esp32")) return "esp32";
    if (text.includes("atmega") || text.includes("avr")) return "avr_8bit";
    if (text.includes("raspberry") || text.includes("bcm2710") || text.includes("bcm2711")) return "raspberry_pi";
    return "other";
  }

  function familyLabel(family) {
    return {
      avr_8bit: "AVR 8-bit",
      esp8266: "ESP8266",
      esp32: "ESP32",
      rp2040: "RP2040",
      arm_cortex_m: "ARM Cortex-M",
      raspberry_pi: "Raspberry Pi",
    }[family] || "Andere";
  }

  function boardLabel(board) {
    const family = familyLabel(boardFamily(board));
    const moduleName = board?.module_name ? ` / ${board.module_name}` : "";
    return `${family} - ${board?.title || board?.hardware_item_id || "IoT-Device"}${moduleName}`;
  }

  function capabilitySet(board) {
    return new Set((board?.capability_ids || []).map((item) => String(item).replace(/^capability\./, "")));
  }

  function supports(board, capability) {
    return capabilitySet(board).has(capability);
  }

  function allowedActions(board) {
    const capabilities = capabilitySet(board);
    return {
      wifiDiscovery: capabilities.has("wifi") || capabilities.has("device_http_status"),
      usbIdentification: capabilities.has("usb_identification") || capabilities.has("flash_firmware"),
      usbFlash: capabilities.has("flash_firmware"),
      ota: capabilities.has("ota"),
      basissoftware: capabilities.has("basissoftware_supported"),
      captiveSetup: capabilities.has("captive_setup_supported"),
    };
  }

  function needsBasissoftwareVersionCheck(board) {
    return allowedActions(board).basissoftware && Boolean(board?.min_basissoftware_version);
  }

  function normalizeShortName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);
  }

  function nodeName(shortName) {
    const normalized = normalizeShortName(shortName);
    return normalized ? `${GER_NETIX_PREFIX}${normalized}` : GER_NETIX_PREFIX.slice(0, -1);
  }

  function inventoryHint(board) {
    const actions = allowedActions(board);
    const parts = [];
    if (actions.wifiDiscovery) parts.push("WLAN-Suche nach gernetix-* Nodes");
    if (actions.usbIdentification) parts.push("USB/Web-Serial-Erkennung");
    if (actions.usbFlash) parts.push("Basissoftware per USB-Flash");
    if (actions.ota) parts.push("OTA-Version pruefen");
    if (!parts.length) parts.push("manuelle Inventarisierung");
    return `${board?.title || "Dieses Board"}: ${parts.join(", ")}. Die Seriennummer vergibt GerNetiX automatisch.`;
  }

  function classifyDiscoveredDevice(device, board) {
    const family = boardFamily(board);
    if (device?.connectivity_status === "setup_ap") return "basissoftware_setup_ap";
    if (device?.esp32_inventory_state) return device.esp32_inventory_state;
    if (device?.runtime_version || device?.firmware_version) return family === "esp8266" || family === "esp32" ? "node_online" : "runtime_online";
    return "unknown";
  }

  function stateText(state) {
    return {
      node_online: "Basissoftware: Node im WLAN",
      runtime_online: "Runtime im Netzwerk",
      basissoftware_setup_ap: "Basissoftware: nicht im Kunden-WLAN",
      bootloader_only: "Nur Bootloader erkannt",
      needs_basissoftware_flash: "Basissoftware fehlt",
      needs_basissoftware_update: "Basissoftware veraltet",
      unknown: "Zustand unbekannt",
    }[state] || state;
  }

  return {
    allowedActions,
    boardFamily,
    boardLabel,
    classifyDiscoveredDevice,
    familyLabel,
    inventoryHint,
    needsBasissoftwareVersionCheck,
    nodeName,
    normalizeShortName,
    stateText,
    supports,
  };
})();
