const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const wifi = fs.readFileSync(path.join(root, "src/functions/initWifi.cpp"), "utf8");
const web = fs.readFileSync(path.join(root, "src/functions/startDeviceWebServer.cpp"), "utf8");
const hooks = fs.readFileSync(path.join(root, "include/basissoftware/project_hooks.h"), "utf8");

test("persistent project AP has explicit radio settings and does not masquerade as a captive portal", () => {
  assert.match(wifi, /setWifiMode\(WIFI_MODE_AP\)/);
  assert.match(wifi, /apConfig\.ap\.beacon_interval = 100/);
  assert.match(wifi, /esp_wifi_set_bandwidth\(WIFI_IF_AP, WIFI_BW20\)/);
  assert.match(wifi, /WIFI_PROTOCOL_11B \| WIFI_PROTOCOL_11G \| WIFI_PROTOCOL_11N/);
  assert.match(web, /isPersistentProjectAccessPoint/);
  assert.match(web, /204 No Content/);
  assert.match(web, /registerUri\("\/project\/status"/);
});

test("basissoftware exposes a narrow project status hook without owning camera state", () => {
  assert.match(hooks, /writeProjectStatusJson/);
  assert.match(hooks, /projectRootPageHtml/);
  assert.match(web, /writeProjectStatusJson\(body, sizeof\(body\)\)/);
  assert.match(web, /projectRootPageHtml\(\)/);
  assert.doesNotMatch(web, /Kein Kameramodul gefunden|OV3660|cameraPresent/);
  assert.doesNotMatch(hooks, /cameraPresent|OV3660/);
});
