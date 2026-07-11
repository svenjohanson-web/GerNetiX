const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "../src/functions/initWifi.cpp"), "utf8");

test("WiFi station retries transient authentication failures with a finite limit", () => {
  assert.match(source, /WIFI_CONNECT_RETRY_LIMIT = 5/);
  assert.match(source, /wifiConnectRetryCount < WIFI_CONNECT_RETRY_LIMIT/);
  assert.match(source, /esp_wifi_connect\(\)/);
  assert.match(source, /wifiConnectRetryCount = 0/);
});
