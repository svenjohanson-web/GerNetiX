const assert = require("node:assert/strict");
const test = require("node:test");
const {
  filterSoftwareUnitsForArchitecture,
  softwareArchitectureComponents,
} = require("./project-software-ownership");

test("treats sensors and actuators as passive hardware owned by their IoT device", () => {
  const hardwareConfiguration = {
    components: [
      { component_id: "device", label: "IoT-Device", abstract_type: "iot_device", component_path: "Komponenten/IoT-Device 1" },
      { component_id: "esp32_sensor", label: "ESP32 Temperatursensor", abstract_type: "sensor", target_device_id: "device" },
      { component_id: "motor", label: "Motor", abstract_type: "actuator", target_device_id: "device" },
    ],
  };
  const detected = [
    { component_id: "device", label: "IoT-Device", abstract_type: "iot_device" },
    { component_id: "esp32_sensor", label: "ESP32 Temperatursensor", abstract_type: "iot_device" },
  ];
  assert.deepEqual(softwareArchitectureComponents(detected, hardwareConfiguration), [detected[0]]);

  const units = [
    { software_unit_id: "firmware", title: "IoT-Device", software_kind: "embedded_firmware", build_system: "platformio", source_root: "Komponenten/IoT-Device 1" },
    { software_unit_id: "software_esp32_sensor", title: "ESP32 Temperatursensor", software_kind: "embedded_firmware", build_system: "platformio", source_root: "Komponenten/ESP32 Temperatursensor" },
    { software_unit_id: "software_motor", title: "Motor", software_kind: "embedded_firmware", build_system: "platformio", source_root: "Komponenten/Motor" },
  ];
  assert.deepEqual(filterSoftwareUnitsForArchitecture(units, hardwareConfiguration), [units[0]]);
});
