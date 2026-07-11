const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { MQTT_CREDENTIAL_CONTEXT, deriveMqttPassword, validDeviceId } = require("./mqtt-device-credential");

test("derives the broker password with the firmware HMAC context", () => {
  const expected = crypto.createHmac("sha256", "device-secret").update("gernetix:mqtt-broker-auth:v1").digest("hex");
  assert.equal(MQTT_CREDENTIAL_CONTEXT, "gernetix:mqtt-broker-auth:v1");
  assert.equal(deriveMqttPassword("device-secret"), expected);
  const firmwareSource = fs.readFileSync(path.resolve(__dirname, "../basissoftware/esp32/src/functions/mqtt_ota.cpp"), "utf8");
  assert.match(firmwareSource, new RegExp(`MQTT_CREDENTIAL_CONTEXT\\[] = "${MQTT_CREDENTIAL_CONTEXT}"`));
});

test("accepts only topic-safe device ids", () => {
  assert.equal(validDeviceId("device_GNX-0001"), true);
  assert.equal(validDeviceId("../other-device"), false);
  assert.equal(validDeviceId("device/+"), false);
});
