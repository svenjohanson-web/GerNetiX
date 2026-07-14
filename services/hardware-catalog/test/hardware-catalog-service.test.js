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
  const wroom32 = service.getHardwareItem("hardware.processor_board.generic_esp_wroom32");
  const nano = service.getHardwareItem("hardware.processor_board.arduino_nano_r3_atmega328p");
  assert.ok(wroom32.pin_profile.analog_inputs.includes("GPIO32 / ADC1_CH4"));
  assert.ok(nano.pin_profile.pwm_pins.includes("D3"));
  const sensors = service.listSensors();
  assert.equal(sensors.some((item) => item.sensor_type_id === "pt1000" && item.signal_type === "analog"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "bme280" && item.measurement_kinds.includes("humidity")), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "incremental_encoder_ab" && item.signal_type === "incremental_ab"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "reed_contact" && item.measurement_kinds.includes("contact")), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "adxl335" && item.measurement_kinds.includes("acceleration") && item.signal_type === "analog"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "adxl345" && item.measurement_kinds.includes("acceleration") && item.signal_type === "i2c"), true);
});

test("admin can add catalog hardware item with known capabilities", () => {
  const service = createDefaultHardwareCatalog({ persistenceBackend: "memory" });
  const item = service.upsertHardwareItem({
    hardware_item_id: "hardware.sensor.button",
    sku: "GNX-BUTTON",
    item_type: "sensor",
    title: "Button Modul",
    capability_ids: ["capability.digital_input"],
    pin_profile: { digital_pins: ["SIG"] },
  });

  assert.equal(item.hardware_item_id, "hardware.sensor.button");
  assert.deepEqual(item.pin_profile.digital_pins, ["SIG"]);
});
