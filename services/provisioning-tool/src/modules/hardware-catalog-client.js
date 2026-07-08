const DEFAULT_PROCESSOR_BOARDS = [
  {
    hardware_item_id: "hardware.processor_board.generic_esp_wroom32",
    title: "Generisches ESP32-Board mit ESP-WROOM-32 Modul",
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

class HardwareCatalogClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "";
    this.fallbackBoards = options.fallbackBoards || DEFAULT_PROCESSOR_BOARDS;
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
    hardware_profile_id: item.hardware_profile_id || item.hardware_item_id || "",
    basissoftware_profile_id: item.basissoftware_profile_id || "",
    factory_firmware_artifact: item.factory_firmware_artifact || item.firmware_artifact || null,
  };
}

function mergeBoards(primary = [], fallback = []) {
  const items = new Map();
  for (const item of fallback) items.set(item.hardware_item_id || item.hardware_profile_id, normalizeBoard(clone(item)));
  for (const item of primary) items.set(item.hardware_item_id || item.hardware_profile_id, normalizeBoard(clone(item)));
  return Array.from(items.values());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { HardwareCatalogClient, DEFAULT_PROCESSOR_BOARDS };
