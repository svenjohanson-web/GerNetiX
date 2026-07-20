const DEFAULT_PROCESSOR_BOARDS = [
  {
    hardware_item_id: "hardware.processor_board.generic_esp_wroom32",
    title: "Generisches ESP32-Board mit ESP-WROOM-32 Modul",
    hardware_class: "processor_board",
    hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
    basissoftware_profile_id: "basissoftware.profile.esp32_factory",
    factory_firmware_artifact: {
      artifact_id: "firmware_artifact.esp32_basissoftware_factory.latest",
      source: "sqlite",
      uri: "sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest",
      version: "latest",
      sha256: "",
    },
  },
];

const DEFAULT_FLASHBOXES = [
  {
    hardware_item_id: "hardware.flashbox.esp32_s3_28_otg",
    title: "GerNetiX Flashbox S3 2,8 Zoll USB-OTG",
    hardware_class: "flashbox",
    hardware_profile_id: "hardware.flashbox.esp32_s3_28_otg",
    purchase_policy: "gernetix_purchase_only",
    inventory_policy: "claim_required",
    self_creation_allowed: false,
    capabilities: [
      "flashbox.self_update",
      "flashbox.usb_otg_host",
      "flashbox.target_flash",
      "flashbox.signed_manifest_download",
    ],
    supported_target_families: ["esp32", "esp32-s3"],
    factory_firmware_artifact: {
      artifact_id: "firmware_artifact.flashbox_factory.latest",
      source: "public_signed_manifest",
      uri: "https://vps.gernetix.example/firmware/flashbox/latest/manifest.json",
      version: "latest",
      sha256: "",
    },
  },
];

class HardwareCatalogClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "";
    this.fallbackBoards = options.fallbackBoards || DEFAULT_PROCESSOR_BOARDS;
    this.fallbackFlashboxes = options.fallbackFlashboxes || DEFAULT_FLASHBOXES;
  }

  async listProcessorBoards() {
    if (!this.baseUrl) return this.fallbackBoards.map(clone);
    try {
      const payload = await getJson(`${this.baseUrl.replace(/\/$/, "")}/processor-boards`);
      return mergeBoards((payload.items || []).map(normalizeBoard), this.fallbackBoards);
    } catch {
      return this.fallbackBoards.map(clone);
    }
  }

  async getProcessorBoard(boardId) {
    const boards = await this.listProcessorBoards();
    return boards.find((board) => board.hardware_item_id === boardId || board.hardware_profile_id === boardId) || null;
  }

  async listFlashboxes() {
    if (!this.baseUrl) return this.fallbackFlashboxes.map(clone);
    try {
      const payload = await getJson(`${this.baseUrl.replace(/\/$/, "")}/flashboxes`);
      return mergeFlashboxes((payload.items || []).map(normalizeFlashbox), this.fallbackFlashboxes);
    } catch {
      return this.fallbackFlashboxes.map(clone);
    }
  }

  async getFlashbox(flashboxId) {
    const flashboxes = await this.listFlashboxes();
    return flashboxes.find((item) => item.hardware_item_id === flashboxId || item.hardware_profile_id === flashboxId) || null;
  }
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Hardware catalog request failed: ${url}`);
  return payload;
}

function normalizeBoard(item = {}) {
  return {
    ...item,
    hardware_class: item.hardware_class || "processor_board",
    hardware_profile_id: item.hardware_profile_id || item.hardware_item_id || "",
    basissoftware_profile_id: item.basissoftware_profile_id || "",
    factory_firmware_artifact: item.factory_firmware_artifact || item.firmware_artifact || null,
  };
}

function normalizeFlashbox(item = {}) {
  return {
    ...item,
    hardware_class: "flashbox",
    hardware_profile_id: item.hardware_profile_id || item.hardware_item_id || "",
    purchase_policy: item.purchase_policy || "gernetix_purchase_only",
    inventory_policy: item.inventory_policy || "claim_required",
    self_creation_allowed: item.self_creation_allowed === true ? true : false,
    capabilities: Array.isArray(item.capabilities) ? item.capabilities : DEFAULT_FLASHBOXES[0].capabilities,
    supported_target_families: Array.isArray(item.supported_target_families) ? item.supported_target_families : [],
    factory_firmware_artifact: item.factory_firmware_artifact || item.firmware_artifact || null,
  };
}

function mergeBoards(primary = [], fallback = []) {
  const items = new Map();
  for (const item of fallback) items.set(item.hardware_item_id || item.hardware_profile_id, normalizeBoard(clone(item)));
  for (const item of primary) items.set(item.hardware_item_id || item.hardware_profile_id, normalizeBoard(clone(item)));
  return Array.from(items.values());
}

function mergeFlashboxes(primary = [], fallback = []) {
  const items = new Map();
  for (const item of fallback) items.set(item.hardware_item_id || item.hardware_profile_id, normalizeFlashbox(clone(item)));
  for (const item of primary) items.set(item.hardware_item_id || item.hardware_profile_id, normalizeFlashbox(clone(item)));
  return Array.from(items.values());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { HardwareCatalogClient, DEFAULT_PROCESSOR_BOARDS, DEFAULT_FLASHBOXES };
