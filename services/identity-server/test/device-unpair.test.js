const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = readPlatformAppSource();
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const onboarding = fs.readFileSync(path.join(__dirname, "..", "public", "app", "device-onboarding-controller.js"), "utf8");

test("dashboard offers direct access to device management", () => {
  const dashboard = html.slice(html.indexOf('<section id="dashboardView"'), html.indexOf('<section id="informationView"'));
  assert.match(dashboard, /data-open-route="\/app\/device-management\/"/);
  assert.match(dashboard, /Vorhandene Hardware[\s\S]*Boards verwalten/);
});

test("device management routes unknown boards to the shared AI hardware assistant", () => {
  const deviceManagementView = html.slice(html.indexOf('<section id="deviceManagementView"'), html.indexOf('<section id="deviceProvisioningView"'));
  assert.match(deviceManagementView, /<h2>Geräte verwalten<\/h2>/);
  assert.match(deviceManagementView, /noch unbekanntes Board zuerst vom KI-Hardware-Assistenten erkennen/);
  assert.match(deviceManagementView, /href="\/app\/hardware-lab\/"[\s\S]*Unbekanntes Board mit dem KI-Hardware-Assistenten erkennen und anlegen/);
  assert.match(app, /href="\/app\/device-management\/provisioning\/">Bekanntes Board verbinden<\/a>/);
  assert.match(app, /href="\/app\/hardware-lab\/">Unbekanntes Board mit KI erkennen<\/a>/);
});

test("inventory exposes account unpair without claiming to delete the physical device", () => {
  assert.match(app, /data-unpair-device=/);
  assert.match(app, />Zuordnung aufheben<\/button>/);
  assert.match(app, /Das registrierte physische Device und seine Provisionierung bleiben erhalten/);
  assert.match(app, /deleteJson\(`\/api\/platform\/devices\/\$\{encodeURIComponent\(accountDeviceId\)\}`\)/);
  assert.match(app, /data-save-device-profile=/);
  assert.match(app, /Update- und Speicherprofil/);
  assert.match(app, /putJson\(`\/api\/platform\/devices\/\$\{encodeURIComponent\(accountDeviceId\)\}`/);
  assert.match(app, /data-save-device-voice-policy=/);
  assert.match(app, /KI-Geschichten für dieses Gerät freigeben/);
  assert.match(app, /Aufnahmen sind auf 15 Sekunden begrenzt/);
  assert.match(app, /putJson\(`\/api\/platform\/devices\/\$\{encodeURIComponent\(accountDeviceId\)\}\/voice-ai-policy`/);
  assert.doesNotMatch(app, /data-remove-device=/);
});

test("inventory only shows registered account boards", () => {
  assert.match(html, /<section class="inventory-overview panel">[\s\S]*id="deviceList"/);
  const inventoryView = html.slice(html.indexOf('<section id="devicesView"'), html.indexOf('<section id="shopView"'));
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
