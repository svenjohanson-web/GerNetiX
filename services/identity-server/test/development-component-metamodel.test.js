const test = require("node:test");
const assert = require("node:assert/strict");
const metamodel = require("../public/app/development-component-metamodel");

test("allows only defined architecture relationships and derives sensor and actuator control units", () => {
  assert.equal(metamodel.validatesRelation("sensor", "iot_device"), true);
  assert.equal(metamodel.validatesRelation("iot_device", "actuator"), true);
  assert.equal(metamodel.validatesRelation("sensor", "smartphone_app"), false);
  assert.equal(metamodel.validatesRelation("iot_device", "telemetry_api"), true);
  assert.equal(metamodel.validatesRelation("telemetry_api", "project_storage"), true);
  assert.equal(metamodel.validatesRelation("notification_service", "smartphone_app"), true);
  assert.equal(metamodel.componentTypes.telemetry_api.user_configurable, false);
  assert.equal(metamodel.componentTypes.project_storage.user_configurable, false);
  assert.equal(metamodel.componentTypes.notification_service.user_configurable, false);
  assert.equal(metamodel.componentTypes.network, undefined);
  assert.equal(metamodel.componentTypes.message_broker, undefined);
  assert.equal(metamodel.componentTypes.data_store, undefined);
  assert.equal(metamodel.relationshipRules.some((item) => item.source_type === "network" || item.target_type === "network"), false);
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
