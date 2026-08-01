const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readPlatformAppSource } = require("../test-support/platform-app-source");

const app = readPlatformAppSource();
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const routes = fs.readFileSync(path.resolve(__dirname, "../src/dev/server/project-routes.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");

test("shows protected basissoftware configuration below every matching IoT firmware", () => {
  assert.match(app, /Konfiguration\/Basissoftware/);
  assert.match(app, /function softwareUnitForIdeComponent/);
  assert.match(app, /data-basissoftware-configuration-form/);
  assert.match(app, /name="wifi_enabled"/);
  assert.match(app, /name="mqtt_publish_topics"/);
  assert.match(app, /name="mqtt_subscriptions"/);
  assert.match(app, /enabled: mqtt\.enabled === true/);
  assert.match(app, /Optional: nur für Projekte mit Broker/);
  assert.match(app, /Power-Manager/);
  assert.match(app, /power_state_\$\{id\}_wake/);
  assert.match(css, /\.power-state-flow/);
  assert.match(css, /\.basissoftware-topic-grid/);
});

test("saves one validated configuration on the selected software unit", () => {
  assert.match(app, /function saveBasissoftwareConfiguration/);
  assert.match(app, /software_unit_id: softwareUnitId/);
  assert.match(app, /basissoftware-configuration/);
  assert.match(routes, /basissoftware-configuration/);
  assert.match(server, /async function handleProjectBasissoftwareConfiguration/);
  assert.match(server, /software_units: updatedUnits, active_software_unit_id: softwareUnitId/);
  assert.match(server, /basissoftware_configuration: basissoftwareConfiguration/);
});

test("offers one project-wide communication setup and derives every firmware role", () => {
  assert.match(app, /Konfiguration\/Kommunikationssetup/);
  assert.match(app, /data-communication-setup-form/);
  assert.match(app, /Gemeinsames Haus-WLAN/);
  assert.match(app, /Eigenes Geräte-WLAN/);
  assert.match(app, /BLE-Direktverbindung/);
  assert.match(app, /name="ap_ipv4_address"/);
  assert.match(app, /name="ap_dhcp_start"/);
  assert.match(app, /192\.168\.50\.0\/24/);
  assert.match(app, /function saveCommunicationSetup/);
  assert.match(routes, /communication-setup/);
  assert.match(server, /async function handleProjectCommunicationSetup/);
  assert.match(server, /applyProjectCommunicationSetup/);
  assert.match(css, /\.communication-mode-grid/);
});
