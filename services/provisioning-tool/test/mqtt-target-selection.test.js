const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.resolve(__dirname, "../public");
const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(publicRoot, "app.js"), "utf8");

test("provisioning UI offers VPS and local MQTT targets", () => {
  assert.match(html, /value="https:\/\/gernetix\.com\/api\/device-management"/);
  assert.doesNotMatch(html, /gernetix\.nl\/api\/device-management/);
  assert.match(html, /value="https:\/\/build\.gernetix\.com"/);
  assert.match(html, /value="mqtts:\/\/mqtt\.gernetix\.com:8883"/);
  assert.match(html, /id="mqttMode"/);
  assert.match(html, /value="vps"/);
  assert.match(html, /value="local"/);
  assert.match(html, /id="mqttVpsUrl"/);
  assert.match(html, /id="mqttLocalHost"/);
  assert.match(app, /mqtt_broker: selectedMqttBrokerUrl\(\)/);
  assert.match(app, /capabilities: \["wifi", "ota", "mqtt", "flash_firmware"\]/);
});
