const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { scriptAbschnitt } = require("../test-support/platform-app-source");
const { authenticatedItem } = require("../test-support/navigation-model");

const appRoot = path.resolve(__dirname, "../public/app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const source = fs.readFileSync(path.join(appRoot, "device-wifi-setup-dialog.js"), "utf8");
const detector = fs.readFileSync(path.join(appRoot, "usb-port-disconnect-detector.js"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const shell = fs.readFileSync(path.join(appRoot, "app-shell-controller.js"), "utf8");
const bindings = fs.readFileSync(path.join(appRoot, "app-event-bindings.js"), "utf8");

test("device WLAN setup is a reusable dark dialog opened from the device menu", () => {
  assert.equal(authenticatedItem("deviceWifiSetupMenuButton").label, "Device-WLAN-Setup");
  assert.match(html, /id="deviceWifiSetupDialog" class="device-wifi-setup-dialog"/);
  assert.doesNotMatch(html, /device-wifi-setup-dialog\.js\?v=/);
  assert.match(shell, /loadDeviceWifiSetupAssets[\s\S]*device-wifi-setup-dialog\.js/);
  assert.match(bindings, /loadDeviceWifiSetupAssets\(\)[\s\S]*GerNetiXDeviceWifiSetup\.open/);
  assert.match(source, /window\.GerNetiXDeviceWifiSetup = GerNetiXDeviceWifiSetup/);
  assert.match(source, /return \{ bind, close, connect, identifyPortByDisconnect, open, refreshPorts, scan \}/);
  assert.match(css, /\.device-wifi-setup-dialog\s*\{[\s\S]*background:\s*#0b1728/);
});

test("multiple USB boards can be identified by disconnecting exactly one port", () => {
  assert.match(html, /id="identifyDeviceWifiPortButton"[^>]*>Durch Abziehen erkennen/);
  assert.match(html, /Ziehe genau ein Board kurz ab/);
  assert.doesNotMatch(scriptAbschnitt(html), /usb-port-disconnect-detector\.js\?v=/);
  assert.match(shell, /loadDeviceWifiSetupAssets[\s\S]*usb-port-disconnect-detector\.js/);
  assert.match(source, /GerNetiXUsbPortDisconnectDetector\.create/);
  assert.match(detector, /baselinePaths: new Set\(initialPorts\.map\(pathOf\)\.filter\(Boolean\)\)/);
  assert.match(detector, /const removed = \[\.\.\.currentRun\.baselinePaths\]\.filter/);
  assert.match(source, /Das war das abgezogene Board/);
  assert.match(source, /setPortOptions\(currentPorts, event\.path\)/);
  assert.match(source, /Port zugeordnet und ausgewählt/);
  assert.match(detector, /setTimeout\(poll, intervalMs\)/);
  assert.match(css, /\.device-wifi-port-identification/);
});

test("device WLAN setup scans and connects only through the local serial service", () => {
  assert.match(source, /state\.serialService\.ports\(\)/);
  assert.match(source, /serialRequest\(port, "wifi_scan"\)/);
  assert.match(source, /serialRequest\(port, "wifi_connect", \{ ssid: network\.ssid, password: passwordInput\.value \}\)/);
  assert.match(source, /serialRequest\(port, "wifi_status"\)/);
  assert.doesNotMatch(source, /postJson|putJson|fetch\(/);
  assert.match(source, /passwordInput\.value = ""/);
});

test("programmatic callers can pass device context, port and completion callback", () => {
  assert.match(source, /currentContext = \{ source: "manual", \.\.\.options \}/);
  assert.match(source, /currentContext\.portPath/);
  assert.match(source, /typeof currentContext\.onConnected === "function"/);
  assert.match(source, /gernetix:device-wifi-connected/);
});
