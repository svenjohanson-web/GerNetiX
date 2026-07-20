const crypto = require("node:crypto");
const fs = require("node:fs");

function createDevHardwareUtils({
  execFileAsync,
  hardwareCatalogJson,
  platform = process.platform,
  readDeviceDirectory = () => fs.readdirSync("/dev"),
}) {
  function requiredField(value, field) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      const error = new Error(`Pflichtfeld fehlt: ${field}`);
      error.status = 400;
      throw error;
    }
    return normalized;
  }

  function createGerNetixSerialNumber(hardwareProfileId) {
    const family = hardwareProfileFamily(hardwareProfileId).toUpperCase().replace(/[^A-Z0-9]/g, "") || "BOARD";
    const suffix = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `GNX-${family}-${suffix}`;
  }

  function normalizeGerNetixNodeName(value) {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);
    return slug.startsWith("gernetix-")
      ? slug
      : `gernetix-${slug || "node"}`;
  }

  function hardwareProfileFamily(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized.includes("esp8266") || normalized.includes("esp-12")) return "esp8266";
    if (normalized.includes("esp32") || normalized.includes("wroom")) return "esp32";
    if (normalized.includes("avr") || normalized.includes("atmega")) return "avr";
    return "board";
  }

  async function loadProcessorBoards() {
    const response = await hardwareCatalogJson("/api/hardware-catalog/processor-boards");
    return (response.items || []).filter((item) => {
      const id = item.hardware_item_id || item.hardware_profile_id;
      return id && !deprecatedProcessorBoardIds().has(id);
    });
  }

  async function loadSensors() {
    const response = await hardwareCatalogJson("/api/hardware-catalog/sensors");
    return response.items || [];
  }

  function deprecatedProcessorBoardIds() {
    return new Set([
      "hardware.processor_board.esp32_devkit",
      "hardware.processor_board.esp_wroom32",
      "hardware.processor_board.esp_wroom32_display",
      "hardware.processor_board.arduino_nano_atmega328p",
    ]);
  }

  async function findProcessorBoard(hardwareProfileId) {
    const boards = await loadProcessorBoards();
    return boards.find((board) => (
      board.hardware_item_id === hardwareProfileId
      || board.hardware_profile_id === hardwareProfileId
      || board.provisioning_profile_id === hardwareProfileId
    )) || null;
  }

  function isUsbFlashDevice(device) {
    const family = hardwareProfileFamily(device.hardware_profile_id);
    return device.device_id === "device_verified_1"
      || device.device_id === "device_arduino_nano_1"
      || family === "avr"
      || family === "esp32"
      || (device.hardware_profile_id || "").includes("arduino_nano");
  }

  function defaultUploadPort(device) {
    if (!isUsbFlashDevice(device)) return "";
    if (device.device_id === "device_arduino_nano_1") {
      return process.env.GERNETIX_NANO_UPLOAD_PORT || process.env.GERNETIX_USB_UPLOAD_PORT || process.env.UPLOAD_PORT || "";
    }
    return process.env.GERNETIX_USB_UPLOAD_PORT || process.env.UPLOAD_PORT || "";
  }

  async function listUsbSerialPorts() {
    if (platform !== "win32") return listPosixUsbSerialPorts();
    const script = [
      "$items = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object {",
      "  $port = if ($_.Name -match '(COM\\d+)') { $Matches[1] } else { '' }",
      "  [pscustomobject]@{",
      "    port = $port;",
      "    name = $_.Name;",
      "    device_id = $_.DeviceID;",
      "    manufacturer = $_.Manufacturer;",
      "    pnp_class = $_.PNPClass;",
      "    status = $_.Status",
      "  }",
      "}",
      "$items | ConvertTo-Json -Compress",
    ].join("\n");

    try {
      const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });
      const trimmed = stdout.trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items
        .map((item) => ({
          port: String(item.port || "").trim(),
          name: String(item.name || "").trim(),
          device_id: String(item.device_id || "").trim(),
          manufacturer: String(item.manufacturer || "").trim(),
          pnp_class: String(item.pnp_class || "").trim(),
          status: String(item.status || "").trim(),
        }))
        .filter((item) => item.port);
    } catch {
      return listUsbSerialPortsFromMode();
    }
  }

  function listPosixUsbSerialPorts() {
    try {
      const names = readDeviceDirectory();
      const matcher = platform === "darwin"
        ? /^cu\.(?:usbserial|usbmodem|SLAB_USBtoUART|wchusbserial)/i
        : /^(?:ttyUSB|ttyACM)\d+$/i;
      return names
        .filter((name) => matcher.test(name))
        .sort((left, right) => left.localeCompare(right))
        .map((name) => ({
          port: `/dev/${name}`,
          name: posixUsbPortName(name),
          device_id: name,
          manufacturer: posixUsbPortManufacturer(name),
          pnp_class: "Ports",
          status: "OK",
        }));
    } catch {
      return [];
    }
  }

  function posixUsbPortName(name) {
    if (/SLAB_USBtoUART|usbserial/i.test(name)) return `${name} (USB Serial)`;
    if (/wchusbserial/i.test(name)) return `${name} (WCH USB Serial)`;
    if (/usbmodem|ttyACM/i.test(name)) return `${name} (USB CDC)`;
    return `${name} (USB Serial)`;
  }

  function posixUsbPortManufacturer(name) {
    if (/SLAB_USBtoUART/i.test(name)) return "Silicon Labs";
    if (/wchusbserial/i.test(name)) return "WCH";
    return "";
  }

  async function listUsbSerialPortsFromMode() {
    try {
      const { stdout } = await execFileAsync("cmd.exe", ["/c", "mode"], {
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });
      return Array.from(new Set(Array.from(stdout.matchAll(/\bCOM\d+\b/gi)).map((match) => match[0].toUpperCase())))
        .map((port) => ({
          port,
          name: `${port} serieller Port`,
          device_id: "",
          manufacturer: "",
          pnp_class: "Ports",
          status: "OK",
        }));
    } catch {
      return [];
    }
  }

  function deviceBuildConfig(device) {
    if (device.device_id === "device_arduino_nano_1" || (device.hardware_profile_id || "").includes("arduino_nano")) {
      return {
        environment: "uno",
        platform: "atmelavr",
        board: "uno",
        framework: "arduino",
        monitorSpeed: "9600",
      };
    }
    return {
      environment: "esp32dev",
      platform: "espressif32",
      board: "esp32dev",
      framework: "arduino",
    };
  }

  function buildTargetLabel(device) {
    if (isFlashboxInventoryDevice(device)) return "GerNetiX FlashBox / USB-Helper-Flash";
    const config = deviceBuildConfig(device);
    return [config.platform, config.board, config.framework || "ohne Framework"].join("/");
  }

  function isFlashboxInventoryDevice(device) {
    return device?.hardware_class === "flashbox"
      || device?.instance_configuration?.role === "flashbox"
      || String(device?.hardware_profile_id || "").includes(".flashbox.");
  }

  function renderPlatformioIni(config) {
    const lines = [
      `[env:${config.environment}]`,
      `platform = ${config.platform}`,
      `board = ${config.board}`,
      `monitor_speed = ${config.monitorSpeed || "115200"}`,
    ];
    if (config.framework) lines.splice(3, 0, `framework = ${config.framework}`);
    if (config.uploadSpeed) lines.push(`upload_speed = ${config.uploadSpeed}`);
    lines.push("");
    return lines.join("\n");
  }

  return {
    buildTargetLabel,
    createGerNetixSerialNumber,
    defaultUploadPort,
    deviceBuildConfig,
    findProcessorBoard,
    hardwareProfileFamily,
    isUsbFlashDevice,
    listUsbSerialPorts,
    loadProcessorBoards,
    loadSensors,
    normalizeGerNetixNodeName,
    renderPlatformioIni,
    requiredField,
  };
}

module.exports = {
  createDevHardwareUtils,
};
