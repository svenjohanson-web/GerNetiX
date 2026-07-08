const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultHardwareCatalog } = require("../src");

test("lists catalog capabilities and processor boards from catalog", () => {
  const service = createDefaultHardwareCatalog({ persistenceBackend: "memory" });

  assert.equal(service.listCapabilities().some((item) => item.capability_id === "capability.processor_esp32"), true);
  assert.equal(service.listCapabilities().some((item) => item.capability_id === "capability.processor_esp8266"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.generic_esp_wroom32"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.espressif_esp32_s3_devkitc_1"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.wemos_d1_mini_esp12f"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.processor_family === "esp32" && item.module_name === "ESP32-S3-WROOM-1"), true);
});

test("admin can add catalog hardware item with known capabilities", () => {
  const service = createDefaultHardwareCatalog({ persistenceBackend: "memory" });
  const item = service.upsertHardwareItem({
    hardware_item_id: "hardware.sensor.button",
    sku: "GNX-BUTTON",
    item_type: "sensor",
    title: "Button Modul",
    capability_ids: ["capability.digital_input"],
  });

  assert.equal(item.hardware_item_id, "hardware.sensor.button");
});
