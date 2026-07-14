const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");
const onboarding = fs.readFileSync(path.join(__dirname, "..", "public", "app", "device-onboarding-controller.js"), "utf8");

test("provisioning requires an exclusive WLAN or USB choice before showing a workflow", () => {
  const view = html.slice(html.indexOf('<section id="deviceProvisioningView"'), html.indexOf('<section id="deviceRecoveryView"'));
  const methodInputs = view.match(/type="radio" name="deviceDiscoveryMethod" value="(?:wlan|usb)"/g) || [];

  assert.equal(methodInputs.length, 2);
  assert.doesNotMatch(methodInputs.join(" "), /checked/);
  assert.match(view, /id="provisioningWorkflowPanel" class="inventory-tools provisioning-tools hidden"/);
  assert.match(app, /querySelectorAll\('input\[name="deviceDiscoveryMethod"\]'\)/);
  assert.match(onboarding, /state\.discoveredDevices = \[\];[\s\S]*state\.avrBootloaderResult = null;/);
  assert.doesNotMatch(onboarding, /state\.inventoryEsp32Method = methods\[0\]/);
});

test("WLAN workflow warns that the board must already be provisioned", () => {
  assert.match(html, /WLAN funktioniert nur mit bereits provisionierten Boards/);
  assert.match(html, /GerNetiX-Basissoftware bereits besitzen/);
  assert.match(onboarding, /funktioniert nur mit bereits provisionierten Boards im gleichen lokalen Netzwerk/);
  assert.match(onboarding, /Bitte zuerst WLAN oder USB als Provisioning-Weg waehlen/);
});

test("guided provisioning asks for a board name only after discovery", () => {
  const view = html.slice(html.indexOf('<section id="deviceProvisioningView"'), html.indexOf('<section id="deviceRecoveryView"'));
  const discoveryListIndex = view.indexOf('id="networkDiscoveryList"');
  const boardDetailsIndex = view.indexOf('id="provisioningFoundBoardDetails"');

  assert.doesNotMatch(view, /id="inventoryProcessorFamily"|id="inventoryHardwareType"/);
  assert.ok(discoveryListIndex >= 0 && boardDetailsIndex > discoveryListIndex);
  assert.match(view, /id="provisioningFoundBoardDetails" class="provisioning-found-board hidden"/);
  assert.match(onboarding, /#provisioningFoundBoardDetails[\s\S]*state\.discoveredDevices\.some\(canClaimDiscoveredDevice\)/);
});

test("USB provisioning offers a compatible known board and applies its catalog defaults", () => {
  assert.match(html, /id="provisioningKnownBoard"/);
  assert.match(html, /Bekanntes Board/);
  assert.match(onboarding, /detected_hardware_profile_id: bootloader\.hardwareProfileId/);
  assert.match(onboarding, /normalizeProcessorVariant\(board\.mcu_variant\) === variant/);
  assert.match(onboarding, /default_instance_configuration \|\| \{\}/);
  assert.match(onboarding, /board_profile_source: state\.provisioningKnownBoardId \? "hardware_catalog"/);
  assert.doesNotMatch(onboarding, /provisioningKnownBoardId = "hardware\.processor_board\.esp32_s3_es3c28p"/);
});
