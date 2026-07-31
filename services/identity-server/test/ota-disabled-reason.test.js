const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.resolve(__dirname, "../public/app");
const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(publicRoot, "app.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("build and flash actions expose their concrete prerequisite without becoming inert", () => {
  assert.match(html, /id="ideActionReason"/);
  assert.equal((html.match(/aria-describedby="ideActionReason"/g) || []).length, 3);
  assert.match(html, /id="ideBuildConsole"/);
  assert.match(html, /id="ideTerminalOutput"/);
  assert.match(html, /id="clearIdeTerminalButton"/);
  assert.match(html, /id="usbFlashButton"[^>]*>USB</);
  assert.doesNotMatch(html, /id="usbFlashButton"[^>]*aria-describedby="ideActionReason"/);
  assert.match(html, /id="otaFlashButton"[^>]*>OTA</);
  assert.match(html, /id="flashBoxFlashButton"[^>]*>FlashBox</);
  assert.match(app, /function ideActionUnavailableReason/);
  assert.match(app, /Für OTA ist kein kompatibles Board im Inventar/);
  assert.match(app, /Build und direkter USB-Flash funktionieren auch ohne diese Zuordnung/);
  assert.match(app, /meldet den OTA-Status/);
  assert.match(app, /buildButton\.disabled = false/);
  assert.match(app, /usbButton\.disabled = false/);
  assert.match(app, /otaButton\.disabled = !allocated/);
  assert.match(html, /id="checkOtaConnectivityButton"/);
  assert.match(app, /Direkter USB-Flash verwendet die Projekt-Boardkonfiguration/);
  assert.match(app, /navigator\.serial\.requestPort/);
  assert.match(app, /flashBuildViaSerialService/);
  assert.match(app, /state\.serialService\.flash/);
  assert.match(app, /loadIdeEsptoolModule/);
  assert.match(app, /browser-usb-flash-result/);
  assert.match(app, /Automatisch \(kein USB-Port erkannt\)/);
  assert.match(app, /if \(!resolvedPort && state\.usbPorts\.length > 1\)/);
  assert.match(app, /select\.classList\.toggle\("hidden", state\.usbPorts\.length < 2\)/);
  assert.match(app, /Mehrere USB-Geräte sind verbunden\. Wähle oben den USB-Port und starte USB erneut\./);
  assert.doesNotMatch(app, /<details class="ide-tree-folder"[^>]* open>/);
  assert.doesNotMatch(app, /function projectRealizationsTreeEntry/);
  assert.doesNotMatch(app, /Architektur\/Realisierungen/);
  assert.doesNotMatch(app, /data-project-realizations|<h3>Inventar-Device zuordnen<\/h3>/);
  assert.match(app, /function isArchitectureBaselinePath/);
  assert.match(app, /Freigegebene Architektur-Baseline/);
  assert.match(app, /!ideSourceIsEditable\(project, state\.sourcePath\)/);
  assert.match(app, /component_device_allocations/);
  assert.match(app, /function appendIdeTerminal/);
  assert.match(html, /id="flashboxDeviceSelect"/);
  assert.match(app, /activeFlashboxDeviceId/);
  assert.match(app, /Waehle zuerst eine verfuegbare FlashBox/);
  assert.match(server, /flashbox_not_in_inventory/);
  assert.match(server, /flashbox_cannot_be_target/);
});

test("plain project build and direct USB flash do not require an inventory device", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");

  assert.match(app, /device_id: device\?\.device_id \|\| ""/);
  assert.match(server, /if \(!device && !\["build", "build_and_usb_flash"\]\.includes\(mode\)\)/);
  assert.match(server, /build_config: resolveBuildConfig\(project, device \|\| \{\}\)/);
  assert.match(app, /async function startUsbFlash\(\)[\s\S]*if \(!project\) return setFlashStatus\("error", "Bitte zuerst ein Projekt öffnen\."\)/);
  assert.match(server, /body\.upload_port \|\| device\?\.upload_port/);
  assert.doesNotMatch(server, /mode === "build_and_usb_flash" && !device\.usb_flash_supported/);
});
