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
  assert.match(source, /setup AP remains active for provisioning status/);
  assert.match(source, /shutting down setup AP after status grace period/);
  const gotIpHandler = source.slice(source.indexOf("IP_EVENT_STA_GOT_IP"), source.indexOf("void configureSetupAp"));
  assert.doesNotMatch(gotIpHandler, /esp_wifi_set_mode\(WIFI_MODE_STA\)/);
});

test("provisioned boards stay in station mode when the first connection times out", () => {
  assert.match(source, /if \(connectStatus == ESP_ERR_NOT_FOUND\) \{\s*startWifiSetupPortal\(\)/);
  assert.match(source, /Saved WiFi exists; remaining in station mode and reconnecting/);
  assert.doesNotMatch(source, /if \(connectStatus != ESP_OK\) \{\s*startWifiSetupPortal\(\)/);
});

test("comfort runtime disables WiFi power save for stable HTTP and MQTT reachability", () => {
  assert.match(source, /esp_wifi_set_ps\(WIFI_PS_NONE\)/);
});

test("a project AP client joins the derived camera WLAN without overwriting saved home credentials", () => {
  const clientMode = source.slice(source.indexOf("Project communication selects camera access-point client mode"));
  assert.match(clientMode, /GERNETIX_PROJECT_AP_SSID/);
  assert.match(clientMode, /connectWifiStation\(projectCredentials/);
  assert.doesNotMatch(clientMode.slice(0, clientMode.indexOf("#endif")), /saveWifiStationCredentials/);
});

test("the access-point DHCP lease is configured on the access-point network interface", () => {
  assert.match(source, /esp_netif_dhcps_option\(\s*accessPointNetif,\s*ESP_NETIF_OP_SET,\s*ESP_NETIF_REQUESTED_IP_ADDRESS/);
});
