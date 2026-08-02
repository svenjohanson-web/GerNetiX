const test = require("node:test");
const assert = require("node:assert/strict");
const metamodel = require("../public/app/development-component-metamodel");

test("allows only defined architecture relationships and derives sensor and actuator control units", () => {
  assert.equal(metamodel.validatesRelation("sensor", "iot_device"), true);
  assert.equal(metamodel.validatesRelation("iot_device", "actuator"), true);
  assert.equal(metamodel.validatesRelation("sensor", "smartphone_app"), false);
  assert.equal(metamodel.validatesRelation("sensor", "mobile_app"), false);
  assert.equal(metamodel.validatesRelation("mobile_app", "iot_device"), true);
  assert.equal(metamodel.validatesRelation("mobile_app", "server_api"), true);
  assert.equal(metamodel.validatesRelation("iot_device", "telemetry_api"), true);
  assert.equal(metamodel.validatesRelation("telemetry_api", "project_storage"), true);
  assert.equal(metamodel.validatesRelation("notification_service", "smartphone_app"), true);
  assert.equal(metamodel.validatesRelation("notification_service", "mobile_app"), true);
  assert.equal(metamodel.validatesRelation("actor", "desktop_app"), true);
  assert.equal(metamodel.validatesRelation("actor", "actuator"), true);
  assert.equal(metamodel.validatesRelation("desktop_app", "server_api"), true);
  assert.equal(metamodel.componentTypes.desktop_app.label, "Desktop-App");
  assert.equal(metamodel.componentTypes.mobile_app.label, "Mobile App (iOS & Android)");
  assert.deepEqual(metamodel.componentTypes.mobile_app.platforms, ["ios", "android"]);
  assert.equal(metamodel.componentTypes.browser_app.pwa_capable, true);
  assert.equal(metamodel.componentTypes.smartphone_app.legacy, true);
  assert.equal(metamodel.validatesRelation("browser_app", "project_storage"), true);
  assert.equal(metamodel.validatesRelation("browser_app", "notification_service"), true);
  assert.equal(metamodel.validatesRelation("browser_app", "iot_device"), true);
  assert.equal(metamodel.relationshipRules.some((item) => item.id === "loads_from_device_webserver"), true);
  assert.equal(metamodel.relationshipRules.some((item) => item.id === "loads_from_server_webserver"), true);
  assert.equal(metamodel.componentTypes.telemetry_api.user_configurable, false);
  assert.equal(metamodel.componentTypes.project_storage.user_configurable, false);
  assert.equal(metamodel.componentTypes.notification_service.user_configurable, false);
  assert.equal(metamodel.componentTypes.network_interface.label, "Netzwerkschnittstelle");
  assert.equal(metamodel.componentTypes.network_interface.user_configurable, false);
  assert.equal(metamodel.componentTypes.network, undefined);
  assert.equal(metamodel.componentTypes.message_broker, undefined);
  assert.equal(metamodel.componentTypes.data_store, undefined);
  assert.equal(metamodel.relationshipRules.some((item) => item.source_type === "network" || item.target_type === "network"), false);
  assert.equal(metamodel.validatesRelation("processor", "processor"), false);
  assert.equal(metamodel.validatesRelation("processor", "network_interface"), true);
  assert.equal(metamodel.validatesRelation("network_interface", "network_interface"), true);
  assert.equal(metamodel.validatesRelation("network_interface", "processor"), true);
  assert.equal(metamodel.controlUnitForRelation("sensor", "iot_device"), "target");
  assert.equal(metamodel.controlUnitForRelation("iot_device", "actuator"), "source");
  assert.deepEqual(metamodel.relationshipRules.find((item) => item.id === "measures_for").target_cardinality, "1");
});

test("offers only legal targets when a component is added", () => {
  const targets = [
    { component_id: "device", abstract_type: "iot_device", label: "IoT-Device 1" },
    { component_id: "app", abstract_type: "smartphone_app", label: "PWA" },
  ];
  const sensorOptions = metamodel.optionsForNewComponent("sensor", targets);
  assert.deepEqual(sensorOptions.map((option) => option.target.component_id), ["device"]);
  assert.deepEqual(sensorOptions.map((option) => option.rule.id), ["measures_for"]);
});

test("offers both device and server webservers for a browser app", () => {
  const targets = [
    { component_id: "device", abstract_type: "iot_device", label: "Device-Webserver" },
    { component_id: "server", abstract_type: "server_api", label: "VPS" },
  ];
  const hosting = metamodel.optionsForNewComponent("browser_app", targets)
    .filter((option) => option.rule.id.startsWith("loads_from_"));
  assert.deepEqual(hosting.map((option) => [option.rule.id, option.target.component_id]), [
    ["loads_from_device_webserver", "device"],
    ["loads_from_server_webserver", "server"],
  ]);
});

test("offers each same-type IoT relationship only once", () => {
  const options = metamodel.optionsForNewComponent("iot_device", [
    { component_id: "device_1", abstract_type: "iot_device", label: "IoT-Device 1" },
  ]);
  assert.deepEqual(options.map((option) => `${option.rule.id}|${option.target.component_id}`), ["synchronizes|device_1"]);
});

test("models a native cross-platform app separately and keeps old PWA diagrams compatible", () => {
  assert.equal(metamodel.componentTypeForPlantUml("GerNetiX Mobile App (iOS & Android)", "component", "mobile_app_1"), "mobile_app");
  assert.equal(metamodel.componentTypeForPlantUml("Smartphone-PWA", "component", "smartphone_app_1"), "smartphone_app");
  const options = metamodel.optionsForNewComponent("mobile_app", [
    { component_id: "device", abstract_type: "iot_device", label: "IoT-Device 1" },
  ]);
  assert.deepEqual(options.map((option) => option.rule.id), ["shows_iot_project_status"]);
});

test("restores integrated audio and touch hardware types from PlantUML", () => {
  assert.equal(metamodel.componentTypeForPlantUml("Beobachtete Umgebung", "actor", "environment"), "actor");
  assert.equal(metamodel.componentTypeForPlantUml("Mikrofon links", "rectangle", "microphone_left"), "sensor");
  assert.equal(metamodel.componentTypeForPlantUml("Touch", "rectangle", "touch"), "sensor");
  assert.equal(metamodel.componentTypeForPlantUml("ES7210 Audio-ADC-IC", "rectangle", "microphone_adc_ic"), "hardware_ic");
  assert.equal(metamodel.componentTypeForPlantUml("Lautsprecher", "rectangle", "speaker"), "actuator");
  assert.equal(metamodel.componentTypeForPlantUml("WLAN-/WiFi-Schnittstelle", "rectangle", "camera_wifi"), "network_interface");
  assert.equal(metamodel.validatesRelation("actor", "sensor"), true);
  assert.equal(metamodel.validatesRelation("sensor", "hardware_ic"), true);
  assert.equal(metamodel.validatesRelation("hardware_ic", "actuator"), true);
  assert.equal(metamodel.validatesRelation("actuator", "actor"), true);
});
