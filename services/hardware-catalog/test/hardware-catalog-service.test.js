const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultHardwareCatalog } = require("../src");
const { SqliteBackedHardwareCatalogRepository } = require("../src/repositories");
const { defaultCatalogSeed } = require("../src/seed");

test("lists catalog capabilities and processor boards from catalog", () => {
  const service = createDefaultHardwareCatalog({ persistenceBackend: "memory" });

  assert.equal(service.listCapabilities().some((item) => item.capability_id === "capability.processor_esp32"), true);
  assert.equal(service.listCapabilities().some((item) => item.capability_id === "capability.processor_esp8266"), true);
  assert.equal(service.listCapabilities().some((item) => item.capability_id === "capability.touchscreen_input"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.generic_esp_wroom32"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.espressif_esp32_s3_devkitc_1"), true);
  const touchBoard = service.getHardwareItem("hardware.processor_board.generic_esp32_s3_touch_display");
  assert.ok(touchBoard.capability_ids.includes("capability.display_output"));
  assert.ok(touchBoard.capability_ids.includes("capability.touchscreen_input"));
  const es3c28p = service.getHardwareItem("hardware.processor_board.esp32_s3_es3c28p");
  assert.equal(es3c28p.mcu_variant, "ESP32-S3");
  assert.equal(es3c28p.verification_status, "locally_verified");
  assert.equal(es3c28p.default_instance_configuration.board_features.display.driver, "ili9341");
  assert.equal(es3c28p.default_instance_configuration.board_features.display.pins.backlight, 45);
  assert.equal(es3c28p.default_instance_configuration.board_features.touch.driver, "ft6336g");
  assert.equal(es3c28p.default_instance_configuration.board_features.touch.pins.sda, 16);
  assert.equal(es3c28p.default_instance_configuration.board_features.speaker.pins.data_out, 8);
  assert.equal(es3c28p.default_instance_configuration.board_features.ram.hardware, "interner_sram");
  assert.equal(es3c28p.default_instance_configuration.board_features.ram.value, "512_kb");
  assert.equal(es3c28p.default_instance_configuration.board_features.flash.hardware, "qspi_flash");
  assert.equal(es3c28p.default_instance_configuration.board_features.flash.value, "16_mb");
  assert.equal(es3c28p.default_instance_configuration.battery_measurement.pin, 9);
  assert.deepEqual(es3c28p.pin_profile.diagnostic_output_allowlist, []);
  assert.equal(service.listProcessorBoards().some((item) => item.hardware_item_id === "hardware.processor_board.wemos_d1_mini_esp12f"), true);
  assert.equal(service.listProcessorBoards().some((item) => item.processor_family === "esp32" && item.module_name === "ESP32-S3-WROOM-1"), true);
  const wroom32 = service.getHardwareItem("hardware.processor_board.generic_esp_wroom32");
  const c6 = service.getHardwareItem("hardware.processor_board.espressif_esp32_c6_devkitc_1");
  const nano = service.getHardwareItem("hardware.processor_board.arduino_nano_r3_atmega328p");
  assert.ok(wroom32.pin_profile.analog_inputs.includes("GPIO32 / ADC1_CH4"));
  assert.equal(wroom32.peripheral_profile.resources.some((item) => item.id === "hardware_timer" && item.managed_by === "runtime_timer"), true);
  assert.equal(wroom32.peripheral_profile.abstractions.some((item) => item.id === "runtime_timer"), true);
  assert.equal(wroom32.peripheral_profile.drivers.some((item) => item.id === "synchronous_motor_driver" && item.depends_on.includes("mcpwm")), true);
  assert.equal(wroom32.peripheral_profile.abstractions.some((item) => item.id === "measurement_acquisition" && item.depends_on.includes("runtime_timer")), true);
  assert.equal(wroom32.peripheral_profile.drivers.some((item) => item.id === "data_logger" && item.configures === "sensor"), true);
  assert.match(c6.peripheral_profile.documentation_url, /esp32c6\/api-reference\/peripherals/);
  assert.ok(nano.pin_profile.pwm_pins.includes("D3"));
  const sensors = service.listSensors();
  assert.equal(sensors.some((item) => item.sensor_type_id === "pt1000" && item.signal_type === "analog"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "bme280" && item.measurement_kinds.includes("humidity")), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "incremental_encoder_ab" && item.signal_type === "incremental_ab"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "reed_contact" && item.measurement_kinds.includes("contact")), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "adxl335" && item.measurement_kinds.includes("acceleration") && item.signal_type === "analog"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "adxl345" && item.measurement_kinds.includes("acceleration") && item.signal_type === "i2c"), true);
  const boardFeatures = service.listBoardFeatureOptions();
  const display = boardFeatures.find((item) => item.feature_id === "display");
  const memory = boardFeatures.find((item) => item.feature_id === "ram");
  assert.equal(boardFeatures.length, 8);
  assert.equal(display.driver_options.some((item) => item.title === "ST7789"), true);
  assert.equal(display.connection_options.some((item) => item.title === "SPI"), true);
  assert.equal(boardFeatures.find((item) => item.feature_id === "touch").driver_options.some((item) => item.title === "FT6336G"), true);
  assert.equal(memory.value_options.some((item) => item.title === "8 MB"), true);
  assert.equal(memory.value_options.some((item) => item.title === "512 KB"), true);
  assert.match(display.datasheet_hint, /Datenblatt/);
});

test("sqlite catalog migration enriches an existing ES3C28P board with known memory", () => {
  const loaded = defaultCatalogSeed();
  const board = loaded.hardwareItems.find((item) => item.hardware_item_id === "hardware.processor_board.esp32_s3_es3c28p");
  delete board.default_instance_configuration.board_features.ram;
  board.default_instance_configuration.board_features.flash.value = "custom_confirmed_value";
  let persisted;
  const repository = new SqliteBackedHardwareCatalogRepository({
    load: () => loaded,
    ensureSchema: () => {},
    save: (state) => { persisted = state; },
  });

  const migrated = repository.findHardwareItem(board.hardware_item_id);
  assert.equal(migrated.default_instance_configuration.board_features.ram.value, "512_kb");
  assert.equal(migrated.default_instance_configuration.board_features.flash.value, "custom_confirmed_value");
  assert.equal(persisted.hardwareItems.find((item) => item.hardware_item_id === board.hardware_item_id)
    .default_instance_configuration.board_features.ram.hardware, "interner_sram");
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
    peripheral_profile: { resources: [{ id: "gpio", configurable: true }] },
  });

  assert.equal(item.hardware_item_id, "hardware.sensor.button");
  assert.deepEqual(item.pin_profile.digital_pins, ["SIG"]);
  assert.equal(item.peripheral_profile.resources[0].id, "gpio");
});
