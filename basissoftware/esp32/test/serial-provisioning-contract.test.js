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
  assert.match(source, /usb_serial_jtag_read_bytes/);
  assert.match(source, /usb_serial_jtag_write_bytes/);
  assert.match(source, /responsePayload\[responsePayloadLength - 1\] == '\\n'/);
  assert.match(source, /serialProvisioningWrite\(responsePayload, responsePayloadLength\)/);
  assert.doesNotMatch(source, /password.*feedback|feedback.*password/i);
  assert.match(wifi, /WiFi credentials saved locally/);
  assert.match(wifi, /requestWifiStationConnectFromSavedCredentials\(\)[\s\S]*stationState = StationState::Connecting/);
  assert.match(wifi, /requestWifiStationConnectFromSavedCredentials\(\)[\s\S]*lastConnectStatus = ESP_OK/);
  assert.doesNotMatch(wifi, /credentials saved for ssid|Connecting WiFi station to ssid/);
});
