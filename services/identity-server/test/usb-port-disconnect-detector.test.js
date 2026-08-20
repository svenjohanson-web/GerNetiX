const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readForSandbox } = require("../test-support/platform-app-source");
const vm = require("node:vm");

const source = readForSandbox("usb-port-disconnect-detector.js");

test("shared USB detector recognizes one removed and reconnected board", async () => {
  const states = [];
  const snapshots = [
    [{ port: "A" }, { port: "B" }],
    [{ port: "A" }],
    [{ port: "A" }, { port: "B" }],
  ];
  const timers = [];
  const context = {
    window: {},
    setTimeout(callback) { timers.push(callback); return timers.length; },
    clearTimeout() {},
    Date,
  };
  vm.runInNewContext(source, context);
  const detector = context.window.GerNetiXUsbPortDisconnectDetector.create({
    listPorts: async () => snapshots.shift() || [],
    pathOf: (port) => port.port,
    labelOf: (port) => `Port ${port.port}`,
    onState: (state) => states.push(state),
    intervalMs: 1,
  });

  assert.equal(detector.start([{ port: "A" }, { port: "B" }], { firmware: "camera" }), true);
  await new Promise(setImmediate);
  await timers.shift()();
  await new Promise(setImmediate);
  await timers.shift()();
  await new Promise(setImmediate);

  assert.deepEqual(states.map((state) => state.type), ["waiting", "removed", "identified"]);
  assert.equal(states[1].path, "B");
  assert.equal(states[2].path, "B");
  assert.equal(states[2].context.firmware, "camera");
  assert.equal(detector.active(), false);
});
