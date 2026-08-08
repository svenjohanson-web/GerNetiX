"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeConfig } = require("../src/config");
const { applyDeviceMap, loadDeviceMap } = require("../src/device-map");

test("loads deterministic device-to-project mappings from the versioned fixture manifest", () => {
  const map = loadDeviceMap();
  assert.equal(map.schemaVersion, 1);
  assert.equal(map.fixtureSet, "gernetix-system-test-v1");
  assert.deepEqual(map.mappings, [
    { deviceId: "systemtest-device-alpha-01", projectId: "systemtest-project-alpha-01" },
    { deviceId: "systemtest-device-alpha-02", projectId: "systemtest-project-alpha-02" },
    { deviceId: "systemtest-device-beta-01", projectId: "systemtest-project-beta-01" },
    { deviceId: "systemtest-device-gamma-01", projectId: "systemtest-project-gamma-01" },
  ]);
  assert.ok(Object.isFrozen(map));
  assert.ok(Object.isFrozen(map.mappings));
});

test("fails when a profile asks for more devices than the fixture map contains", () => {
  const map = loadDeviceMap();
  assert.throws(() => applyDeviceMap(normalizeConfig({ deviceCount: 5 }), map), /exceeds mapped fixture devices 4/);
  assert.equal(applyDeviceMap(normalizeConfig({ deviceCount: 3 }), map).deviceMappings.length, 3);
});
