const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const onboarding = fs.readFileSync(path.join(__dirname, "..", "public", "app", "device-onboarding-controller.js"), "utf8");

test("dashboard offers direct access to device management", () => {
  const dashboard = html.slice(html.indexOf('<section id="dashboardView"'), html.indexOf('<section id="helpView"'));
  assert.match(dashboard, /data-open-route="\/app\/device-management\/"/);
  assert.match(dashboard, /Device Management[\s\S]*Boards verwalten/);
});

test("inventory exposes account unpair without claiming to delete the physical device", () => {
  assert.match(app, /data-unpair-device=/);
  assert.match(app, />Zuordnung aufheben<\/button>/);
  assert.match(app, /Das registrierte physische Device und seine Provisionierung bleiben erhalten/);
  assert.match(app, /deleteJson\(`\/api\/platform\/devices\/\$\{encodeURIComponent\(accountDeviceId\)\}`\)/);
  assert.match(app, /data-save-device-profile=/);
  assert.match(app, /Update- und Speicherprofil/);
  assert.match(app, /putJson\(`\/api\/platform\/devices\/\$\{encodeURIComponent\(accountDeviceId\)\}`/);
  assert.doesNotMatch(app, /data-remove-device=/);
});

test("inventory only shows registered account boards", () => {
  assert.match(html, /<section class="inventory-overview panel">[\s\S]*id="deviceList"/);
  const inventoryView = html.slice(html.indexOf('<section id="devicesView"'), html.indexOf('<section id="buildsView"'));
  assert.doesNotMatch(inventoryView, /deviceDiscoverySearchButton|deviceInventoryForm|inventoryHardwareProfile/);
  assert.match(app, /deviceConnectivityLabel/);
  assert.match(app, /deviceAuthenticityLabel/);
  assert.match(app, /Technische Details/);
});

test("provisioning owns discovery, registration and pairing", () => {
  const provisioningView = html.slice(html.indexOf('<section id="deviceProvisioningView"'), html.indexOf('<section id="deviceRecoveryView"'));
  assert.doesNotMatch(provisioningView, /Provisioning-Ablauf|Per WLAN oder USB provisionieren/);
  assert.match(provisioningView, /id="deviceDiscoverySearchButton"/);
  assert.doesNotMatch(provisioningView, /id="deviceInventoryForm"|Manueller Fallback|inventoryHardwareProfile/);
  assert.match(provisioningView, /Provisionieren und mit Account verbinden/);
  assert.match(onboarding, /registriert und mit deinem Account verbunden/);
  assert.doesNotMatch(onboarding, /manuell inventarisieren|wurde inventarisiert/);
});

test("recovery is described as rescue for a known device identity", () => {
  const recoveryView = html.slice(html.indexOf('<section id="deviceRecoveryView"'), html.indexOf('<section id="developmentPlatformView"'));
  assert.match(recoveryView, /Bekanntes Gerät/);
  assert.match(recoveryView, /vorhandener Device-ID oder Secret/);
  assert.match(recoveryView, /Diagnose und Rettung/);
});
