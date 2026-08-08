const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { normalizeConfig } = require("../src/config");
const { DeviceSimulator, safeErrorReason } = require("../src/simulator");
const { applyDeviceMap, loadDeviceMap } = require("../src/device-map");

function mappedConfig(input) {
  return applyDeviceMap(normalizeConfig(input), loadDeviceMap());
}

class FakeClient extends EventEmitter {
  constructor({ failures = 0 } = {}) { super(); this.failures = failures; this.published = []; this.closed = false; }
  async connect() { if (this.failures-- > 0) throw Object.assign(new Error("secret broker detail"), { code: "ECONNREFUSED" }); }
  async publish(topic, payload) { this.published.push([topic, JSON.parse(payload)]); }
  close() { this.closed = true; }
}

function immediateTimers() {
  let nextId = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout(fn) { const id = ++nextId; pending.set(id, fn); return id; },
    clearTimeout(id) { pending.delete(id); },
    async runOne() { const entry = pending.entries().next().value; if (!entry) return; pending.delete(entry[0]); await entry[1](); await new Promise((resolve) => setImmediate(resolve)); },
  };
}

test("publishes original, duplicate and delayed telemetry with stable ids", async () => {
  const timers = immediateTimers();
  const client = new FakeClient();
  const config = mappedConfig({ deviceCount: 1, duplicateRate: 1, delayedRate: 1, heartbeatEvery: 0 });
  const simulator = new DeviceSimulator({ config, clientFactory: () => client, random: () => 0, now: () => new Date("2026-08-08T10:00:00Z"), timers });
  await simulator.start();
  await timers.runOne(); // connect
  await timers.runOne(); // publish cycle; delayed publish is scheduled and duplicate is immediate
  await timers.runOne(); // delayed publish
  assert.equal(client.published.length, 2);
  assert.equal(client.published[0][0], "gernetix/devices/systemtest-device-alpha-01/telemetry");
  assert.equal(client.published[0][1].project_id, "systemtest-project-alpha-01");
  assert.equal(client.published[0][1].measurements[0].measurement_id, client.published[1][1].measurements[0].measurement_id);
  assert.deepEqual(simulator.summary(), { ...simulator.summary(), published: 2, duplicatePublished: 1, delayedPublished: 1 });
  simulator.stop();
  assert.equal(client.closed, true);
});

test("bounds reconnect attempts and reports only normalized failure reasons", async () => {
  const timers = immediateTimers();
  const client = new FakeClient({ failures: 10 });
  const config = mappedConfig({ deviceCount: 1, maxReconnectAttempts: 2, reconnectBaseMs: 1, reconnectMaxMs: 2 });
  const simulator = new DeviceSimulator({ config, clientFactory: () => client, random: () => 0.5, timers });
  const failures = [];
  simulator.on("deviceFailed", (event) => failures.push(event));
  await simulator.start();
  await timers.runOne();
  await timers.runOne();
  await timers.runOne();
  assert.equal(simulator.summary().connectAttempts, 3);
  assert.equal(simulator.summary().reconnectScheduled, 2);
  assert.equal(simulator.summary().reconnectExhausted, 1);
  assert.deepEqual(failures, [{ deviceId: "systemtest-device-alpha-01", reason: "ECONNREFUSED" }]);
  assert.equal(safeErrorReason(new Error("password=not-for-logs")), "connection_error");
});
