const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");
const repoRoot = path.join(__dirname, "..", "..", "..");
const dockerfile = fs.readFileSync(path.join(repoRoot, "docker", "node-service.Dockerfile"), "utf8");

test("platform offers an authenticated GerNetiX Serial Service download area", () => {
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  assert.match(html, /href="\/app\/downloads\/"/);
  assert.match(html, /GerNetiX Serial Service/);
  assert.match(app, /\/api\/platform\/downloads/);
  assert.match(serverSource, /if \(!readSession\(req\)\)/);
  assert.match(serverSource, /downloads\/usb-serial-helper/);
  assert.match(serverSource, /file_name: filename/);
  assert.match(serverSource, /GerNetiX-Serial-Service-mac-arm64\.pkg/);
  assert.match(serverSource, /GerNetiX-Serial-Service-\$\{usbSerialHelperManifest\.version\}-mac-arm64\.pkg/);
  assert.match(serverSource, /version: release\?\.version \|\| \(localFilename \? usbSerialHelperManifest\.version : ""\)/);
  assert.match(serverSource, /win-x64\.exe/);
});

test("VPS identity serves immutable platform releases from its existing SQLite state", () => {
  assert.match(serverSource, /SqlitePlatformDownloadRepository/);
  assert.match(serverSource, /PLATFORM_DOWNLOAD_SQLITE_PATH/);
  assert.match(serverSource, /platformDownloadRepository\.getContent/);
  assert.match(serverSource, /listCurrent\("serial-service"\)/);
  assert.match(serverSource, /await serveUsbSerialHelperDownload/);
  assert.match(serverSource, /source: localFilename \? "local" : release \? "published"/);
  assert.doesNotMatch(serverSource, /GERNETIX_SERIAL_SERVICE_MACOS_URL/);
  assert.match(dockerfile, /publish-platform-download\.js/);
});

test("USB provisioning prefers the background service without leaving GerNetiX", () => {
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  const onboarding = fs.readFileSync(path.join(appRoot, "device-onboarding-controller.js"), "utf8");
  const serialServiceClient = fs.readFileSync(path.join(appRoot, "serial-service-client.js"), "utf8");
  const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

  assert.match(html, /id="selectProvisioningSerialPortButton"/);
  assert.match(html, /id="scanProvisioningSerialPortsButton"[^>]*>Automatisch suchen/);
  assert.match(html, /id="checkProvisioningSerialPortButton"[^>]*>Seriellen Port prüfen/);
  assert.match(html, /id="provisioningUsbHelperHint"/);
  assert.match(html, /data-serial-service-install/);
  assert.match(html, /Jetzt installieren oder reparieren/);
  assert.match(html, /Öffne danach das geladene Installationspaket/);
  assert.match(html, /id="serialServiceChoiceDialog"/);
  assert.match(html, /Browser mit Web Serial/);
  assert.match(html, /GerNetiX WebHelper/);
  assert.match(html, /Chrome oder Edge verwenden/);
  assert.match(html, /WebHelper installieren/);
  assert.match(html, /serial-service-client\.js/);
  assert.doesNotMatch(html, /id="esp32UsbPort"/);
  assert.match(app, /selectProvisioningSerialPortButton/);
  assert.match(onboarding, /state\.serialService\.ports\(\)/);
  assert.match(onboarding, /preferredSerialServicePorts\(await state\.serialService\.ports\(\)\)/);
  assert.match(onboarding, /state\.serialService\.probe\(port\.path\)/);
  assert.match(onboarding, /state\.serialService\.flash/);
  assert.match(onboarding, /state\.serialService\.serialRequest/);
  assert.match(app, /await loadPlatformDownloads\(\)/);
  assert.match(app, /showSerialServiceChoiceDialog\(\)/);
  assert.match(app, /download\?\.url \|\| "\/app\/downloads\/"/);
  assert.match(onboarding, /showSerialServiceChoiceDialog\(\)/);
  assert.doesNotMatch(onboarding, /Installiere oder repariere die Systemintegration unter Downloads/);
  assert.match(serialServiceClient, /https:\/\/localhost:43123/);
  assert.match(serialServiceClient, /http:\/\/127\.0\.0\.1:43123/);
  assert.match(serialServiceClient, /for \(const candidate of baseUrls\)/);
  assert.match(serialServiceClient, /targetAddressSpace: "loopback"/);
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

test("manual board provisioning edits feature pin assignments in a board-aware dialog", () => {
  const onboarding = fs.readFileSync(path.join(appRoot, "device-onboarding-controller.js"), "utf8");

  assert.match(onboarding, /data-edit-board-feature-pins/);
  assert.match(onboarding, /provisioning-pin-editor-dialog/);
  assert.match(onboarding, /Mögliche GPIOs/);
  assert.match(onboarding, /availableProvisioningPins/);
  assert.match(onboarding, /ESP32-S3/);
  assert.match(onboarding, /ESP32-C6/);
  assert.match(onboarding, /formatBoardFeaturePins\(pins\)/);
  assert.match(onboarding, /data-board-feature-pin-signal/);
  assert.match(onboarding, /existing\.pins \|\| ""/);
  assert.match(onboarding, /pins: value\.pins \|\| ""/);
});
