"use strict";

const test = require("node:test");
const { requireForSandbox } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const model = requireForSandbox("usb-flash-target-model.js");

test("one IoT firmware requires exactly one detected USB port", () => {
  assert.equal(model.selectionMode(1, 0), "no-port");
  assert.equal(model.selectionMode(1, 1), "single-port");
  assert.equal(model.selectionMode(1, 2), "single-device-port-conflict");
});

test("multiple IoT firmwares always require an explicit firmware-port mapping", () => {
  assert.equal(model.selectionMode(2, 0), "no-port");
  assert.equal(model.selectionMode(2, 1), "firmware-port-mapping");
  assert.equal(model.selectionMode(2, 3), "firmware-port-mapping");
});

test("a partial firmware-port mapping selects only assigned firmware", () => {
  assert.deepEqual(model.selectedAssignments(
    ["camera", "display"],
    ["/dev/cu.camera", "/dev/cu.display"],
    { camera: "/dev/cu.camera" },
  ), [{ firmwareId: "camera", port: "/dev/cu.camera" }]);
});

test("firmware-port mappings reject unknown and duplicate ports", () => {
  assert.deepEqual(model.selectedAssignments(
    ["camera", "display"],
    ["/dev/cu.camera"],
    { camera: "/dev/cu.missing" },
  ), []);
  assert.deepEqual(model.selectedAssignments(
    ["camera", "display"],
    ["/dev/cu.board"],
    { camera: "/dev/cu.board", display: "/dev/cu.board" },
  ), []);
});
