const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const config = fs.readFileSync(path.join(__dirname, "mosquitto.conf"), "utf8");
const acl = fs.readFileSync(path.join(__dirname, "device.acl"), "utf8");
const compose = fs.readFileSync(path.join(repoRoot, "compose.vps.yaml"), "utf8");
const entrypoint = fs.readFileSync(path.join(__dirname, "docker-entrypoint.sh"), "utf8");

test("external MQTT listener requires TLS and credentials", () => {
  assert.match(config, /listener 8883 0\.0\.0\.0/);
  assert.match(config, /allow_anonymous false/);
  assert.match(config, /password_file \/mosquitto\/data\/passwords/);
  assert.match(config, /certfile \/etc\/letsencrypt\/live\/gernetix-services\.com\/fullchain\.pem/);
  assert.match(config, /keyfile \/etc\/letsencrypt\/live\/gernetix-services\.com\/privkey\.pem/);
  assert.match(compose, /MQTT_TLS_PORT:-8883/);
  assert.match(compose, /mqtt-broker:[\s\S]*?networks:\s*- edge\s*- backend/);
});

test("broker starts internal listeners while the MQTT certificate is pending", () => {
  assert.match(entrypoint, /MQTT TLS certificate is not available/);
  assert.match(entrypoint, /awk '\/\^listener 8883/);
  assert.match(entrypoint, /chown mosquitto:mosquitto \/mosquitto\/data\/passwords/);
  assert.match(entrypoint, /cp "\$private_key" \/tmp\/mqtt-privkey\.pem/);
  assert.match(entrypoint, /chmod 0600 \/tmp\/mqtt-privkey\.pem/);
});

test("device ACL is restricted by MQTT username", () => {
  assert.match(acl, /pattern read gernetix\/devices\/%u\/ota/);
  assert.match(acl, /pattern write gernetix\/devices\/%u\/status\/#/);
  assert.doesNotMatch(acl, /pattern (read|write) #/);
});
