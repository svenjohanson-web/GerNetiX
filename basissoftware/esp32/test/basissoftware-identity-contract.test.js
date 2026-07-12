const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const config = fs.readFileSync(path.join(root, "include/basissoftware/config.h"), "utf8");
const webServer = fs.readFileSync(path.join(root, "src/functions/startDeviceWebServer.cpp"), "utf8");

test("basissoftware exposes mandatory version and variant metadata", () => {
  assert.match(config, /GERNETIX_BASISSOFTWARE_VERSION\[\] = "[^"]+"/);
  assert.match(config, /GERNETIX_BASISSOFTWARE_VARIANT\[\] = "[^"]+"/);
  assert.match(webServer, /\\"basissoftwareVersion\\"/);
  assert.match(webServer, /\\"basissoftwareVariant\\"/);
  assert.match(webServer, /GERNETIX_BASISSOFTWARE_VERSION/);
  assert.match(webServer, /GERNETIX_BASISSOFTWARE_VARIANT/);
  assert.match(webServer, /id=\\"basis-meta\\"/);
  assert.match(webServer, /Basissoftware-Metadaten nicht erreichbar/);
});
