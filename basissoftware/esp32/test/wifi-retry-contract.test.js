const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "../src/functions/initWifi.cpp"), "utf8");

test("WiFi station reconnects indefinitely with bounded backoff", () => {
  assert.match(source, /WIFI_RECONNECT_DELAYS_MS\[\] = \{1000, 2000, 5000, 10000, 30000, 60000\}/);
  assert.match(source, /delayIndex = wifiConnectRetryCount < delayCount \? wifiConnectRetryCount : delayCount - 1/);
  assert.match(source, /xTaskCreate\(\s*wifiReconnectTask/);
  assert.match(source, /xEventGroupGetBits\(wifiEvents\) & WIFI_CONNECTED_BIT/);
  assert.match(source, /scheduleWifiReconnect\(\)/);
  assert.doesNotMatch(source, /WIFI_CONNECT_RETRY_LIMIT/);
  assert.doesNotMatch(source, /esp_wifi_disconnect\(\)/);
});

test("WiFi reconnect backoff resets after receiving an IP address", () => {
  assert.match(source, /IP_EVENT_STA_GOT_IP/);
  assert.match(source, /wifiConnectRetryCount = 0/);
  assert.match(source, /setupPortalActive = false/);
  assert.match(source, /WiFi station recovered; setup AP disabled/);
});

test("provisioned boards stay in station mode when the first connection times out", () => {
  assert.match(source, /if \(connectStatus == ESP_ERR_NOT_FOUND\) \{\s*startWifiSetupPortal\(\)/);
  assert.match(source, /Saved WiFi exists; remaining in station mode and reconnecting/);
  assert.doesNotMatch(source, /if \(connectStatus != ESP_OK\) \{\s*startWifiSetupPortal\(\)/);
});

test("comfort runtime disables WiFi power save for stable HTTP and MQTT reachability", () => {
  assert.match(source, /esp_wifi_set_ps\(WIFI_PS_NONE\)/);
});
