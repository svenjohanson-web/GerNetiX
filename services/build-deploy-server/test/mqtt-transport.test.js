const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { connectPacket, decodeRemainingLength, encodeRemainingLength, normalizeMqttTopic, packetBuffer } = require("../src/modules/mqtt-transport");
const { createConfig } = require("../src/config");

test("encodes MQTT remaining lengths and packets used for OTA commands", () => {
  for (const value of [0, 127, 128, 16384, 1048576]) {
    const encoded = encodeRemainingLength(value);
    assert.deepEqual(decodeRemainingLength(Buffer.concat([Buffer.from([0]), encoded]), 1).value, value);
  }
  const packet = packetBuffer(0x32, Buffer.from("ota"));
  assert.equal(packet[0], 0x32);
  assert.equal(packet.subarray(2).toString(), "ota");
  assert.match(connectPacket("build-server", "", "").toString(), /MQTT/);
});

test("normalizes device MQTT topics before interface telemetry is persisted", () => {
  assert.equal(normalizeMqttTopic("gernetix/devices/gnx-123/status/deployment"), "gernetix/devices/{device}/status/deployment");
  assert.equal(normalizeMqttTopic("gernetix/system/status"), "gernetix/system/status");
});

test("stores MQTT telemetry in the shared runtime sqlite by default", () => {
  const config = createConfig({});
  assert.equal(config.interfaceTelemetrySqlitePath, path.resolve(__dirname, "../../../.runtime/gernetix-services.sqlite"));
});

test("sets the MQTT retain bit for offline OTA delivery", () => {
  assert.equal(packetBuffer(0x33, Buffer.from("ota"))[0], 0x33);
});
