const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { normalizeAppPath } = require("../src/dev/http-utils");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");
const onboarding = fs.readFileSync(path.join(__dirname, "..", "public", "app", "device-onboarding-controller.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

function onboardingControllerForTest() {
  const context = {};
  vm.runInNewContext(`${onboarding}\nglobalThis.controller = DeviceOnboardingController;`, context);
  return context.controller;
}

test("nested device-management routes survive a direct browser reload", () => {
  assert.equal(normalizeAppPath("/app/device-management/provisioning/"), "/index.html");
  assert.equal(normalizeAppPath("/app/device-management/inventory/"), "/index.html");
  assert.equal(normalizeAppPath("/app/device-management/recovery/"), "/index.html");
  assert.equal(normalizeAppPath("/app/help/"), "/index.html");
});

test("provisioning requires an exclusive WLAN or USB choice before showing a workflow", () => {
  const view = html.slice(html.indexOf('<section id="deviceProvisioningView"'), html.indexOf('<section id="deviceRecoveryView"'));
  const methodInputs = view.match(/type="radio" name="deviceDiscoveryMethod" value="(?:wlan|usb)"/g) || [];

  assert.equal(methodInputs.length, 2);
  assert.doesNotMatch(methodInputs.join(" "), /checked/);
  assert.match(view, /id="provisioningWorkflowPanel" class="inventory-tools provisioning-tools hidden"/);
  assert.match(app, /querySelectorAll\('input\[name="deviceDiscoveryMethod"\]'\)/);
  assert.match(onboarding, /state\.discoveredDevices = \[\];[\s\S]*state\.avrBootloaderResult = null;/);
  assert.doesNotMatch(onboarding, /state\.inventoryEsp32Method = methods\[0\]/);
  assert.match(view, /noch nie mit GerNetiX verbunden/);
  assert.match(view, /minimale Inbetriebnahme-Provisionierung/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(180px, 260px\)\)/);
  assert.match(css, /min-height:\s*38px/);
  assert.doesNotMatch(view, /Vollständig provisioniertes Board im gleichen WLAN suchen|Erstverbindung, WLAN-Suche erfolglos/);
});

test("USB provisioning treats macOS tty and cu paths as one device and prefers cu", () => {
  const { preferredSerialServicePorts } = onboardingControllerForTest();
  const ports = preferredSerialServicePorts([
    { path: "/dev/tty.usbmodem101", label: "tty board" },
    { path: "/dev/cu.usbmodem101", label: "cu board" },
  ]);

  assert.equal(ports.length, 1);
  assert.equal(ports[0].path, "/dev/cu.usbmodem101");
});

test("USB provisioning keeps genuinely different serial devices selectable", () => {
  const { preferredSerialServicePorts } = onboardingControllerForTest();
  const ports = preferredSerialServicePorts([
    { path: "/dev/cu.usbmodem101" },
    { path: "/dev/cu.usbserial-210" },
  ]);

  assert.equal(ports.length, 2);
});

test("guided provisioning uses the full width without a manual fallback", () => {
  const view = html.slice(html.indexOf('<section id="deviceProvisioningView"'), html.indexOf('<section id="deviceRecoveryView"'));

  assert.doesNotMatch(view, /deviceInventoryForm|Manueller Fallback|Registrieren und pairen/);
  assert.match(css, /\.provisioning-tools\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.doesNotMatch(app, /createInventoryDevice|#deviceInventoryForm|#inventoryHardwareProfile/);
});

test("WLAN workflow warns that the board must already be provisioned", () => {
  assert.match(html, /WLAN funktioniert nur mit bereits provisionierten Boards/);
  assert.match(html, /GerNetiX-Basissoftware bereits besitzen/);
  assert.match(onboarding, /setDiscoveryStatus\("hidden", ""\)/);
  assert.match(onboarding, /Bitte zuerst WLAN oder USB als Provisioning-Weg waehlen/);
});

test("guided provisioning asks for a board name only after discovery", () => {
  const view = html.slice(html.indexOf('<section id="deviceProvisioningView"'), html.indexOf('<section id="deviceRecoveryView"'));
  const discoveryListIndex = view.indexOf('id="networkDiscoveryList"');
  const boardDetailsIndex = view.indexOf('id="provisioningFoundBoardDetails"');

  assert.doesNotMatch(view, /id="inventoryProcessorFamily"|id="inventoryHardwareType"/);
  assert.ok(discoveryListIndex >= 0 && boardDetailsIndex > discoveryListIndex);
  assert.match(view, /id="provisioningFoundBoardDetails" class="provisioning-found-board hidden"/);
  assert.match(view, /Wähle Boardnamen…/);
  assert.match(view, /Hinweis: Dein Board ist im Netzwerk mit folgendem Namen sichtbar/);
  assert.match(view, /<strong id="inventoryNodeNamePreview">gernetix-mein-board<\/strong>/);
  assert.match(onboarding, /Dieses Board auswählen/);
  assert.match(onboarding, /Für die Account-Verbindung/);
  assert.match(css, /\.discovery-select\.is-available/);
  assert.match(css, /\.discovery-select:has\(input:checked\)/);
  assert.match(onboarding, /provisioningFoundBoardDetails"\)\.classList\.toggle\("hidden", !hasDetectedBootloader\)/);
  assert.match(onboarding, /dieses Board fuer die Account-Verbindung auswaehlen/);
  assert.match(onboarding, /selectedProvisioningDiscoveryIds\(\)/);
  assert.match(onboarding, /selectedProvisioningDiscoveryIds = \[state\.discoveredDevices\[0\]\.discovery_id\]/);
  assert.match(onboarding, /<table class="discovery-table">/);
  assert.match(onboarding, /Board<\/th><th>Bootloader<\/th><th>Flash<\/th><th>RAM/);
  assert.match(onboarding, /loader\.detectFlashSize\(\)/);
  assert.match(onboarding, /512 KB intern/);
  assert.match(css, /\.discovery-table-scroll/);
});

test("USB provisioning offers a compatible known board and applies its catalog defaults", () => {
  assert.match(html, /id="provisioningKnownBoard"/);
  assert.match(html, /Wähle Board Definition…/);
  assert.match(html, /id="provisioningBoardDefinitionHelp"/);
  assert.match(onboarding, /openHelpTopic\("board-definition"\)/);
  assert.doesNotMatch(html, /id="provisioningManualBoardButton"/);
  assert.match(onboarding, /<option value="__manual__"[\s\S]*Manuell konfigurieren/);
  assert.match(onboarding, /hardwareProfileId === "__manual__"/);
  assert.match(html, /id="provisioningBoardConfigurationDetails" class="provisioning-board-configuration-details hidden"/);
  assert.match(html, /id="provisioningUpdateProfileChooser"/);
  assert.match(onboarding, /Varianten der Komfort- und Sicherheitsoptionen/);
  assert.match(onboarding, /detected_hardware_profile_id: bootloader\.hardwareProfileId/);
  assert.match(onboarding, /normalizeProcessorVariant\(board\.mcu_variant\) === variant/);
  assert.match(onboarding, /processorVariantForDetectedProfile\(detectedProfileId\)/);
  assert.match(onboarding, /const detectedProfileId = detectedBoard \? boardId\(detectedBoard\) : \(/);
  assert.doesNotMatch(onboarding, /fallbackProcessorBoards/);
  assert.doesNotMatch(server, /defaultCatalogSeed/);
  assert.match(server, /error: "hardware_catalog_unreachable"[\s\S]*message: "Hardware-Katalog nicht erreichbar\."/);
  assert.match(onboarding, /loadProcessorBoardCatalog\(\{ force: true \}\)/);
  assert.match(onboarding, /loadBoardFeatureCatalog\(\{ force: true \}\)/);
  assert.match(onboarding, /featureCatalogStatus\.state !== "ready"/);
  assert.match(onboarding, /!state\.boardFeatureCatalog\.length/);
  assert.match(onboarding, /Hardware-Katalog nicht erreichbar/);
  assert.match(onboarding, /default_instance_configuration \|\| \{\}/);
  assert.match(onboarding, /integratedMemoryDrivers/);
  assert.match(onboarding, /esp_idf_partition_table/);
  assert.match(onboarding, /<table class="board-feature-table">/);
  assert.match(onboarding, /<th aria-label="Aktiv"><\/th><th>Komponente<\/th>/);
  assert.match(onboarding, /boardFeatureTableSelect/);
  assert.match(css, /\.board-feature-table-scroll/);
  assert.match(onboarding, /provisioningBoardConfigurationMode = hardwareProfileId \? "catalog" : ""/);
  assert.match(onboarding, /provisioningBoardConfigurationMode = "manual"/);
  assert.match(onboarding, /Maximale Ausfallsicherheit/);
  assert.match(onboarding, /Speicheroptimiert/);
  assert.match(onboarding, /Minimalkonfiguration/);
  assert.match(onboarding, /provisioning-help-link/);
  assert.match(onboarding, /basissoftware\.profile\.esp32\.full/);
  assert.match(onboarding, /partition\.profile\.esp32\.bootstrap_single_slot/);
  assert.match(onboarding, /partition\.profile\.esp32\.single_app_usb/);
  assert.match(onboarding, /!device\.bootloader_type \|\| new Set\(\["catalog", "manual"\]\)/);
  assert.match(onboarding, /!device\.bootloader_type \|\| new Set\(\["full", "medium", "low"\]\)/);
  assert.match(onboarding, /board_profile_source: state\.provisioningKnownBoardId \? "hardware_catalog"/);
  assert.doesNotMatch(onboarding, /provisioningKnownBoardId = "hardware\.processor_board\.esp32_s3_es3c28p"/);
});

test("USB provisioning flashes the basis software before registration and pairing", () => {
  assert.match(html, /id="flashProvisioningBasissoftwareButton"[^>]*>Basissoftware flashen/);
  assert.match(html, /aria-describedby="provisioningUsbFlashDisabledReason"/);
  assert.match(html, /id="provisioningUsbFlashDisabledReason"/);
  assert.match(html, /id="provisioningFirmwareAvailability"/);
  assert.match(html, /id="provisioningUsbFlashStatus"/);
  assert.match(app, /#flashProvisioningBasissoftwareButton[^\n]+flashProvisioningBasissoftware/);
  assert.match(onboarding, /\/api\/platform\/provisioning-firmware\?profile=.*hardware_profile_id=.*flash_size_mb=/);
  assert.match(onboarding, /checkProvisioningFirmwareAvailability/);
  assert.match(onboarding, /Derzeit gibt es keine Basissoftware fuer diese Konfiguration/);
  assert.match(onboarding, /scanButton\.disabled = state\.provisioningWifiSetupRunning \|\| !state\.provisioningSerialReady;/);
  assert.doesNotMatch(onboarding, /if \(!state\.provisioningPairingToken\) return;\s*state\.provisioningWifiSetupRunning = true;/);
  assert.match(onboarding, /loader\.writeFlash\(/);
  assert.match(onboarding, /await transport\.setDTR\(false\)/);
  assert.match(onboarding, /await transport\.setRTS\(true\)/);
  assert.match(onboarding, /await transport\.setRTS\(false\)/);
  assert.match(onboarding, /loader\.after\("hard_reset"\)/);
  assert.match(onboarding, /waitForProvisioningSerialReady/);
  assert.match(onboarding, /publishStatus: Status: running/);
  assert.match(onboarding, /strongestNetworkBySsid/);
  assert.match(onboarding, /ensureProvisioningSerialConnection/);
  assert.match(onboarding, /nach dem Reset nicht neu geöffnet werden/);
  assert.match(onboarding, /provisioningUsbFlashSucceeded = true/);
  assert.match(onboarding, /Noch erforderlich:.*reasons\.join/);
  assert.match(onboarding, /Boardmodell waehlen oder Ausstattung manuell festlegen/);
  assert.match(onboarding, /Update- und Speicherprofil waehlen/);
  assert.match(onboarding, /href="\/app\/help\/#update-profiles"/);
  assert.match(onboarding, /openHelpTopic\("update-profiles"\)/);
  assert.match(onboarding, /!hasDetectedBootloader \|\| !hasBoardConfiguration/);
  assert.match(onboarding, /!device\.bootloader_type \|\| state\.provisioningUsbFlashSucceeded/);
  assert.match(onboarding, /provisioningWifiSetupSucceeded/);
  assert.match(server, /\/api\/platform\/provisioning-firmware\/content/);
  assert.match(server, /resolveProvisioningFirmwareArtifact/);
  assert.match(server, /hardwareCatalogJson/);
  assert.match(server, /firmware_build_target_id/);
  assert.match(server, /getFirmwareBuildTarget/);
  assert.match(server, /getFactoryFirmwareRelease/);
});

test("USB provisioning configures WiFi locally before final account assignment", () => {
  assert.match(html, /id="provisioningWifiSetupStep"/);
  assert.match(html, /weder an GerNetiX übertragen noch im Browser gespeichert/);
  assert.match(html, /id="scanProvisioningWifiButton"/);
  assert.match(html, /id="connectProvisioningWifiButton"/);
  assert.match(html, /provisioning-wifi-help-link/);
  assert.match(onboarding, /serialProvisioningRequest\("wifi_scan"\)/);
  assert.match(onboarding, /serialProvisioningRequest\("wifi_connect"/);
  assert.match(onboarding, /Die USB-Bestätigung blieb aus\. Das Board prüft jetzt die WLAN-Verbindung/);
  assert.match(onboarding, /Do not retransmit it after a missing USB acknowledgement/);
  assert.match(onboarding, /await waitForProvisioningWifiConnection\(\)/);
  assert.match(onboarding, /\/api\/platform\/provisioning\/session/);
  assert.match(onboarding, /\/api\/platform\/provisioning\/complete/);
  assert.match(server, /\/api\/platform\/provisioning\/session/);
  assert.match(server, /\/api\/platform\/provisioning\/complete/);
  assert.match(onboarding, /openHelpTopic\("usb-wifi-setup"\)/);
});
