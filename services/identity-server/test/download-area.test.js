const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("platform offers an authenticated USB Serial Helper download area", () => {
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  assert.match(html, /href="\/app\/downloads\/"/);
  assert.match(html, /USB Serial Helper/);
  assert.match(app, /\/api\/platform\/downloads/);
  assert.match(serverSource, /if \(!readSession\(req\)\)/);
  assert.match(serverSource, /downloads\/usb-serial-helper/);
  assert.match(serverSource, /mac-arm64\\\.zip/);
  assert.match(serverSource, /win-x64\\\.exe/);
});

test("USB provisioning uses Web Serial and points unsupported browsers to the helper", () => {
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  const onboarding = fs.readFileSync(path.join(appRoot, "device-onboarding-controller.js"), "utf8");
  const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

  assert.match(html, /id="selectProvisioningSerialPortButton"/);
  assert.match(html, /id="scanProvisioningSerialPortsButton"[^>]*>Automatisch suchen/);
  assert.match(html, /id="checkProvisioningSerialPortButton"[^>]*>Seriellen Port prüfen/);
  assert.match(html, /id="provisioningUsbHelperHint"/);
  assert.match(html, /GerNetiX USB Helper Tool/);
  assert.doesNotMatch(html, /id="esp32UsbPort"/);
  assert.match(app, /selectProvisioningSerialPortButton/);
  assert.match(onboarding, /navigator\.serial\.requestPort\(\)/);
  assert.match(onboarding, /navigator\.serial\.getPorts\(\)/);
  assert.match(onboarding, /await identifyEsp32Bootloader\(\)/);
  assert.match(onboarding, /!state\.provisioningSerialScanCompleted \|\| hasSelectedSerialPort/);
  assert.match(onboarding, /!hasSelectedSerialPort \|\| hasDetectedBootloader/);
  assert.match(onboarding, /loader\.main\(isEspressifUsbJtag \? "usb_reset" : "default_reset"\)/);
  assert.match(onboarding, /Arduino Bootloader \(STK500v1\)/);
  assert.match(onboarding, /compatible_bootloader_detected/);
  assert.match(html, /id="provisioningBoardFeatures"/);
  assert.match(html, /id="provisioningDatasheetUrl"/);
  assert.match(onboarding, /board_features: selected/);
  assert.match(onboarding, /instance_configuration:/);
  assert.match(server, /\/api\/platform\/hardware\/board-feature-options/);
  assert.doesNotMatch(onboarding, /USB-Board suchen/);
});
