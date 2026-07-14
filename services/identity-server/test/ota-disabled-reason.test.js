const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.resolve(__dirname, "../public/app");
const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(publicRoot, "app.js"), "utf8");

test("build and flash actions expose their concrete prerequisite without becoming inert", () => {
  assert.match(html, /id="ideActionReason"/);
  assert.equal((html.match(/aria-describedby="ideActionReason"/g) || []).length, 4);
  assert.match(html, /id="ideBuildConsole"/);
  assert.match(html, /id="ideTerminalOutput"/);
  assert.match(html, /id="clearIdeTerminalButton"/);
  assert.match(html, /Flash via Web Serial/);
  assert.match(app, /function ideActionUnavailableReason/);
  assert.match(app, /Kein kompatibles Board im Inventar/);
  assert.match(app, /Ordne der IoT-Device-Komponente zuerst ein Inventar-Device zu/);
  assert.match(app, /meldet den OTA-Status/);
  assert.match(app, /buildButton\.disabled = false/);
  assert.match(app, /usbButton\.disabled = false/);
  assert.match(app, /otaButton\.disabled = !allocated/);
  assert.match(html, /id="checkOtaConnectivityButton"/);
  assert.match(app, /unterstuetzt keinen USB-Flash/);
  assert.match(app, /navigator\.serial\.requestPort/);
  assert.match(app, /loadIdeEsptoolModule/);
  assert.match(app, /browser-usb-flash-result/);
  assert.match(app, /Automatisch \(kein USB-Port erkannt\)/);
  assert.doesNotMatch(app, /<details class="ide-tree-folder"[^>]* open>/);
  assert.doesNotMatch(app, /function projectRealizationsTreeEntry/);
  assert.doesNotMatch(app, /Architektur\/Realisierungen/);
  assert.doesNotMatch(app, /data-project-realizations|<h3>Inventar-Device zuordnen<\/h3>/);
  assert.match(app, /function isArchitectureBaselinePath/);
  assert.match(app, /Freigegebene Architektur-Baseline/);
  assert.match(app, /!ideSourceIsEditable\(project, state\.sourcePath\)/);
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
