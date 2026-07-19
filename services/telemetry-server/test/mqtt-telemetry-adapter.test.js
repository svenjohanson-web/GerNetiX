const assert = require("node:assert/strict");
const test = require("node:test");
const { deviceIdFromTopic, deviceIdFromRuntimeTopic, startMqttTelemetryAdapter, startMqttRuntimeAdapter } = require("../src/mqtt-telemetry-adapter");

test("derives the device identity solely from the ACL protected telemetry topic", async () => {
  const accepted = [];
  class FakeTransport {
    constructor(options) { this.options = options; }
    async start() { await this.options.onMessage("gernetix/devices/device-verified/telemetry", JSON.stringify({ device_id: "device-forged", project_id: "project-1", measurements: [] })); }
  }
  startMqttTelemetryAdapter({ mqttBrokerUrl: "mqtt://broker:1883", service: { async ingest(input) { accepted.push(input); } }, MqttTransportClass: FakeTransport, log: { warn() {}, error() {} } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(accepted[0].device_id, "device-verified");
  assert.equal(deviceIdFromTopic("gernetix/devices/device-verified/telemetry"), "device-verified");
  assert.equal(deviceIdFromTopic("gernetix/devices/device-verified/status/online"), "");
});

test("relays runtime lines with the device identity solely from the ACL protected runtime topic", async () => {
  const accepted = [];
  class FakeTransport {
    constructor(options) { this.options = options; }
    async start() { await this.options.onMessage("gernetix/devices/device-verified/runtime", JSON.stringify({ device_id: "device-forged", project_id: "project-1", channel: "serial", line: "taste_gedrueckt" })); }
  }
  startMqttRuntimeAdapter({ mqttBrokerUrl: "mqtt://broker:1883", service: { async relayRuntime(input) { accepted.push(input); } }, MqttTransportClass: FakeTransport, log: { warn() {}, error() {} } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(accepted[0].device_id, "device-verified");
  assert.equal(accepted[0].line, "taste_gedrueckt");
  assert.equal(deviceIdFromRuntimeTopic("gernetix/devices/device-verified/runtime"), "device-verified");
  assert.equal(deviceIdFromRuntimeTopic("gernetix/devices/device-verified/telemetry"), "");
});
