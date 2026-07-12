const assert = require("node:assert/strict");
const test = require("node:test");
const { connectPacket, decodeRemainingLength, encodeRemainingLength, packetBuffer } = require("../src/modules/mqtt-transport");

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

test("sets the MQTT retain bit for offline OTA delivery", () => {
  assert.equal(packetBuffer(0x33, Buffer.from("ota"))[0], 0x33);
});
