const assert = require("node:assert/strict");
const test = require("node:test");
const model = require("../public/app/development-hardware-model");

const boards = [
  { hardware_item_id: "esp32-devkit", processor_family: "esp32", mcu_variant: "ESP32", title: "ESP32 DevKit" },
  { hardware_item_id: "esp32-s3-devkit", processor_family: "esp32", mcu_variant: "ESP32-S3", title: "ESP32-S3 DevKit" },
  { hardware_item_id: "arduino-nano-esp32", processor_family: "esp32", mcu_variant: "ESP32-S3", title: "Arduino Nano ESP32" },
  { hardware_item_id: "arduino-nano-r3", processor_family: "avr_8bit", mcu_variant: "ATmega328P", title: "Arduino Nano R3" },
];

test("lists processors before boards and removes duplicate processor variants", () => {
  assert.deepEqual(model.processorOptions(boards).map((item) => item.key), [
    "avr_8bit::ATmega328P",
    "esp32::ESP32",
    "esp32::ESP32-S3",
  ]);
});

test("filters boards by the selected processor variant", () => {
  assert.deepEqual(
    model.boardsForProcessor(boards, "esp32::ESP32-S3").map(model.boardIdentifier),
    ["esp32-s3-devkit", "arduino-nano-esp32"],
  );
});

test("derives processor selection from an existing board", () => {
  assert.equal(model.selectionForComponent({ board_profile_id: "arduino-nano-r3" }, boards), "avr_8bit::ATmega328P");
});

test("clears an incompatible board after processor change", () => {
  const component = model.applyProcessorSelection(
    { board_profile_id: "esp32-devkit" },
    "esp32::ESP32-S3",
    boards,
  );
  assert.equal(component.processor_family, "esp32");
  assert.equal(component.processor_variant, "ESP32-S3");
  assert.equal(component.board_profile_id, "");
});

const sensors = [
  { sensor_type_id: "pt1000", title: "PT1000", measurement_kinds: ["temperature"], signal_type: "analog" },
  { sensor_type_id: "ds18b20", title: "DS18B20", measurement_kinds: ["temperature"], signal_type: "one_wire" },
  { sensor_type_id: "bme280", title: "BME280", measurement_kinds: ["temperature", "humidity", "pressure"], signal_type: "i2c" },
  { sensor_type_id: "reed_contact", title: "Reedkontakt", measurement_kinds: ["contact"], signal_type: "digital" },
  { sensor_type_id: "incremental_encoder_ab", title: "Encoder A/B", measurement_kinds: ["position", "rotation"], signal_type: "incremental_ab" },
  { sensor_type_id: "adxl335", title: "ADXL335", measurement_kinds: ["acceleration"], signal_type: "analog" },
  { sensor_type_id: "adxl345", title: "ADXL345", measurement_kinds: ["acceleration"], signal_type: "i2c" },
];

test("offers measurement kind before signal type and concrete sensor", () => {
  assert.equal(model.sensorCategoryOptions(sensors).some((item) => item.id === "temperature"), true);
  assert.deepEqual(model.signalTypeOptions(sensors, "temperature").map((item) => item.id), ["analog", "i2c", "one_wire"]);
  assert.deepEqual(model.sensorTypesFor(sensors, "temperature", "analog").map((item) => item.sensor_type_id), ["pt1000"]);
});

test("keeps incremental encoders separate from simple digital contacts", () => {
  assert.deepEqual(model.signalTypeOptions(sensors, "position").map((item) => item.id), ["incremental_ab"]);
  assert.deepEqual(model.signalTypeOptions(sensors, "contact").map((item) => item.id), ["digital"]);
});

test("offers analog and I2C acquisition for acceleration", () => {
  assert.deepEqual(model.signalTypeOptions(sensors, "acceleration").map((item) => item.id), ["analog", "i2c"]);
  assert.deepEqual(model.sensorTypesFor(sensors, "acceleration", "analog").map((item) => item.sensor_type_id), ["adxl335"]);
  assert.deepEqual(model.sensorTypesFor(sensors, "acceleration", "i2c").map((item) => item.sensor_type_id), ["adxl345"]);
});

test("migrates an existing concrete sensor to category and signal type", () => {
  const component = model.reconcileSensor({ concrete_type: "ds18b20" }, sensors);
  assert.equal(component.sensor_category, "temperature");
  assert.equal(component.signal_type, "one_wire");
  assert.equal(component.concrete_type, "ds18b20");
});

test("clears signal and concrete sensor when measurement kind changes", () => {
  const component = model.applySensorCategory({ sensor_category: "temperature", signal_type: "analog", concrete_type: "pt1000" }, "contact", sensors);
  assert.equal(component.signal_type, "");
  assert.equal(component.concrete_type, "");
});
