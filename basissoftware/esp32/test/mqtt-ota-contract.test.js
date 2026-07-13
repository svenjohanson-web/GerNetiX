const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const basisRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(basisRoot, "src/functions/mqtt_ota.cpp"), "utf8");

test("MQTT OTA subscriber uses TLS, device credentials and QoS 1", () => {
  assert.match(source, /"mqtts:\/\/"/);
  assert.match(source, /crt_bundle_attach = esp_crt_bundle_attach/);
  assert.match(source, /credentials\.username = config\.deviceId/);
  assert.match(source, /computeDeviceHmacSha256Hex/);
  assert.match(source, /authentication\.password = mqttPassword/);
  assert.match(source, /esp_mqtt_client_subscribe\(client, subscriptionTopic, 1\)/);
  assert.match(source, /status\/deployment/);
  assert.match(source, /esp_mqtt_client_publish\(client, topic, payload, payloadLength, 1, 0\)/);
});

test("MQTT permits plaintext only for a private IPv4 broker", () => {
  assert.match(source, /isPrivateIpv4MqttUrl/);
  assert.match(source, /a == 10/);
  assert.match(source, /a == 172 && b >= 16 && b <= 31/);
  assert.match(source, /a == 192 && b == 168/);
  assert.match(source, /if \(secureBroker\) mqttConfig\.broker\.verification\.crt_bundle_attach/);
});

test("MQTT notifications use a device topic and the authenticated OTA path", () => {
  assert.match(source, /gernetix\/devices\/%s\/ota/);
  assert.match(source, /scheduleOtaUpdate/);
  assert.match(source, /total_data_len > static_cast<int>\(MAX_OTA_MESSAGE\)/);
});

test("MQTT task has enough stack for TLS and authenticated OTA processing", () => {
  assert.match(source, /MQTT_TASK_STACK_SIZE = 12 \* 1024/);
  assert.match(source, /mqttConfig\.task\.stack_size = MQTT_TASK_STACK_SIZE/);
});
