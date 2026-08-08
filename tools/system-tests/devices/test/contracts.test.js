const assert = require("node:assert/strict");
const test = require("node:test");
const { assertDevicePublishTopic, buildTelemetryPayload, telemetryTopic } = require("../src/contracts");
const { normalizeConfig } = require("../src/config");

test("builds telemetry matching the Telemetry Server contract", () => {
  const payload = buildTelemetryPayload({ deviceId: "device-1", projectId: "project-1", sequence: 3, measuredAt: "2026-08-08T10:00:00Z", value: 21.5 });
  assert.equal(telemetryTopic("device-1"), "gernetix/devices/device-1/telemetry");
  assert.equal(payload.device_id, "device-1");
  assert.equal(payload.measurements[0].measurement_id, "sim-device-1-3");
  assert.equal(payload.measurements[0].measured_at, "2026-08-08T10:00:00.000Z");
});

test("enforces device identity boundaries for publish topics", () => {
  assert.equal(assertDevicePublishTopic("device-1", "gernetix/devices/device-1/status/heartbeat"), "gernetix/devices/device-1/status/heartbeat");
  assert.throws(() => assertDevicePublishTopic("device-1", "gernetix/devices/device-2/telemetry"), /identity boundary/);
  assert.throws(() => telemetryTopic("device/escape"), /device_id/);
});

test("requires explicit TLS-protected opt-in for remote brokers", () => {
  assert.throws(() => normalizeConfig({ brokerUrl: "mqtts://mqtt.example.test:8883" }), /allow-remote/);
  assert.throws(() => normalizeConfig({ brokerUrl: "mqtt://mqtt.example.test:1883", allowRemote: true }), /require mqtts/);
  assert.equal(normalizeConfig({ brokerUrl: "mqtts://mqtt.example.test:8883", allowRemote: true }).deviceCount, 10);
  assert.throws(() => normalizeConfig({ brokerUrl: "mqtt://user:secret@127.0.0.1:1883" }), /without embedded credentials/);
  assert.equal(normalizeConfig({ brokerUrl: "mqtt://[::1]:1883" }).brokerUrl, "mqtt://[::1]:1883");
  assert.throws(() => normalizeConfig({ certFile: "/test/cert.pem" }), /provided together/);
});
