const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.resolve(__dirname, "../public/app");
const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(publicRoot, "app.js"), "utf8");

test("build and flash actions expose their concrete prerequisite without becoming inert", () => {
  assert.match(html, /id="ideActionReason"/);
  assert.equal((html.match(/aria-describedby="ideActionReason"/g) || []).length, 3);
  assert.match(html, /id="ideBuildConsole"/);
  assert.match(html, /id="ideTerminalOutput"/);
  assert.match(html, /id="clearIdeTerminalButton"/);
  assert.match(html, /Flash via Web Serial/);
  assert.match(app, /function ideActionUnavailableReason/);
  assert.match(app, /Kein kompatibler ESP32 im Inventar/);
  assert.match(app, /Ordne dem ESP32-Projektordner zuerst ein Inventar-Device zu/);
  assert.match(app, /meldet den OTA-Status/);
  assert.match(app, /buildButton\.disabled = false/);
  assert.match(app, /usbButton\.disabled = false/);
  assert.match(app, /otaButton\.disabled = false/);
  assert.match(app, /unterstuetzt keinen USB-Flash/);
  assert.match(app, /navigator\.serial\.requestPort/);
  assert.match(app, /loadIdeEsptoolModule/);
  assert.match(app, /browser-usb-flash-result/);
  assert.match(app, /Automatisch \(kein USB-Port erkannt\)/);
  assert.doesNotMatch(app, /<details class="ide-tree-folder"[^>]* open>/);
  assert.match(app, /function projectRealizationsTreeEntry/);
  assert.match(app, /Architektur\/Realisierungen/);
  assert.match(app, /data-project-realizations/);
  assert.match(app, /Komponenten und Realisierungen/);
  assert.match(app, /component_device_allocations/);
  assert.match(app, /function appendIdeTerminal/);
});

test("plain project build does not require an inventory device", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");
  const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

  assert.match(app, /device_id: device\?\.device_id \|\| ""/);
  assert.match(server, /if \(!device && mode !== "build"\)/);
  assert.match(server, /build_config: resolveBuildConfig\(project, device \|\| \{\}\)/);
});
