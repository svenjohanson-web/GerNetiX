const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "functions", "serial_provisioning.cpp"), "utf8");
const wifi = fs.readFileSync(path.join(__dirname, "..", "src", "functions", "initWifi.cpp"), "utf8");

test("serial provisioning scans and stores WiFi credentials only on the device", () => {
  assert.match(source, /gernetix\.serial_provisioning/);
  assert.match(source, /wifi_scan/);
  assert.match(source, /scanWifiNetworksJson/);
  assert.match(source, /wifi_connect/);
  assert.match(source, /saveWifiStationCredentials/);
  assert.match(source, /wifi_status/);
  assert.match(source, /stored_only_on_device/);
  assert.doesNotMatch(source, /password.*feedback|feedback.*password/i);
  assert.match(wifi, /WiFi credentials saved locally/);
  assert.doesNotMatch(wifi, /credentials saved for ssid|Connecting WiFi station to ssid/);
});
