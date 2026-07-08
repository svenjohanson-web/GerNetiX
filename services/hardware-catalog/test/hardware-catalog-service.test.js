const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultHardwareCatalog } = require("../src");

test("lists catalog capabilities and processor boards from catalog", () => {
  const service = createDefaultHardwareCatalog({ persistenceBackend: "memory" });

  assert.equal(service.listCapabilities().some((item) => item.capability_id === "capability.processor_esp32"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.esp_wroom32"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.esp_wroom32_display"), true);
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
