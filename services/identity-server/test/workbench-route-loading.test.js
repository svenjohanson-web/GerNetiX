"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.resolve(__dirname, "../public/app");
const read = (file) => fs.readFileSync(path.join(appRoot, file), "utf8");
const html = read("index.html");
const shell = read("app-shell-controller.js");
const bindings = read("app-event-bindings.js");
const wifi = read("device-wifi-setup-dialog.js");

const workbenchFiles = [
  "app-ide-controller.js",
  "app-device-build-controller.js",
  "device-debug-controller.js",
  "device-onboarding-controller.js",
  "guided-project-view.js",
  "usb-flash-target-model.js",
  "flash-progress.js",
  "unified-flash-dialog.js",
  "unified-flash-executor.js",
  "usb-port-disconnect-detector.js",
  "device-wifi-setup-dialog.js",
];

test("keeps IDE, build, debug and provisioning packages out of the global shell", () => {
  workbenchFiles.forEach((file) => assert.doesNotMatch(html, new RegExp(file.replaceAll(".", "\\."))));
  assert.match(shell, /async function loadBuildWorkbenchAssets\(\)/);
  assert.match(shell, /async function loadIdeWorkbenchAssets\(\)/);
  assert.match(shell, /async function loadDeviceOnboardingAssets\(\)/);
  assert.match(shell, /async function loadDeviceWifiSetupAssets\(\)/);
});

test("loads workbench dependencies before their route controllers", () => {
  const buildLoader = shell.match(/async function loadBuildWorkbenchAssets[\s\S]*?\n\}/)?.[0] || "";
  assert.match(buildLoader, /usb-flash-target-model\.js[\s\S]*await loadPlatformScript\(`\/app\/app-device-build-controller\.js/);
  const ideLoader = shell.match(/async function loadIdeWorkbenchAssets[\s\S]*?\n\}/)?.[0] || "";
  assert.match(ideLoader, /loadBuildWorkbenchAssets\(\)/);
  assert.match(ideLoader, /loadGuidedProjectAssets\(\)/);
  assert.match(ideLoader, /app-ide-controller\.js[\s\S]*initializeIdeWorkspaceResize\(\)[\s\S]*device-debug-controller\.js/);
});

test("maps only routes that use the workbench packages", () => {
  assert.match(shell, /\["ide", "debug"\]\.includes\(route\)[\s\S]*loadIdeWorkbenchAssets\(\)/);
  assert.match(shell, /route === "learning-project"[\s\S]*loadBuildWorkbenchAssets\(\), loadGuidedProjectAssets\(\)/);
  assert.match(shell, /\["device-inventory", "device-recovery"\]\.includes\(route\)[\s\S]*loadBuildWorkbenchAssets\(\)/);
  assert.match(shell, /route === "device-provisioning"[\s\S]*loadBuildWorkbenchAssets\(\), loadDeviceOnboardingAssets\(\)/);
  assert.match(shell, /routeAssetsMissing\(route\)/);
  assert.match(shell, /route-assets-loading/);
});

test("loads and binds device WiFi setup only after the menu action", () => {
  assert.match(bindings, /deviceWifiSetupMenuButton[\s\S]*await loadDeviceWifiSetupAssets\(\)[\s\S]*GerNetiXDeviceWifiSetup\.open/);
  assert.match(wifi, /let eventsBound = false/);
  assert.match(wifi, /function bind\(\) \{[\s\S]*if \(eventsBound\) return/);
  assert.doesNotMatch(wifi, /GerNetiXDeviceWifiSetup\.bind\(\);/);
});
