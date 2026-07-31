const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const boardPlugin = fs.readFileSync(path.resolve(__dirname, "../public/app/board-configuration-plugin.js"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const guidedProjectView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");

test("IDE exposes component properties and an embedded device webserver view", () => {
  assert.match(html, /id="ideComponentFeaturesView"/);
  assert.match(html, /id="ideBoardPropertiesView"/);
  assert.match(html, /id="ideSensorPropertiesView"/);
  assert.match(html, /id="ideDeviceConnectionsView"/);
  assert.match(html, /id="ideDeviceWebView"/);
  assert.match(app, /Webserver des Entwicklungsprojekts/);
  assert.match(app, /<iframe title="Device-Webserver"/);
  assert.doesNotMatch(app, /renderProjectRealizations\(/);
  assert.match(app, /async function loadIdeProject[\s\S]*renderIdeCodeAssistant\(project\);[\s\S]*if \(projectNeedsHardwareTools\(project\)\) await refreshUsbPorts\(false\);/);
});

test("software groups functions drivers webserver configuration and preview", () => {
  assert.match(app, /`\$\{component\}\/Konfiguration\/Software\/Funktionen`/);
  assert.match(app, /`\$\{component\}\/Konfiguration\/Software\/Treiberverwaltung`/);
  assert.match(app, /`\$\{component\}\/Konfiguration\/Software\/Webserver\/Konfiguration`/);
  assert.match(app, /`\$\{component\}\/Konfiguration\/Software\/Webserver\/Vorschau`/);
  assert.match(app, /function renderWebserverConfiguration\(project\)/);
  assert.match(app, /webserver-configuration-form/);
  assert.doesNotMatch(app, /role: "Live-Ansicht"/);
  assert.doesNotMatch(app, /file\.role \|\| file\.content_type \? `<small>/);
});

test("event workers and dispatchers are not routed into hardware configuration", () => {
  assert.match(app, /virtualAction: "worker-dispatcher-configuration"/);
  assert.match(app, /data-worker-dispatcher-configuration/);
  assert.match(app, /function renderEventConfiguration\(kind\)/);
  assert.match(app, /Auslöser konfigurieren/);
  assert.match(app, /Zustellung konfigurieren/);
  assert.match(app, /Hilfe zur Regelsprache/);
  assert.match(app, /event\.type == "taste_gedrueckt"/);
  assert.match(app, /Nur ein im Projektmodell ausdrücklich deklarierter Zustandswert/);
  assert.match(app, /Schleifen, eigene Funktionen, Netzwerk-, Datei-/);
  assert.match(app, /event-configuration/);
  assert.match(server, /handleProjectEventConfiguration/);
  assert.match(server, /normalizeEventConfiguration/);
  assert.match(server, /event_configuration:/);
});

test("project browser provides one coherent IoT device configuration hierarchy", () => {
  assert.match(app, /function projectBrowserSources\(project, sources\)/);
  assert.match(app, /sourcePrefix: String\(component\.component_path\)/);
  assert.match(app, /treePrefix: `Komponenten\/\$\{componentTreeLabel\(component\)\}`/);
  assert.match(app, /treePath: \[mapping\.treePrefix, relativePath\]\.filter\(Boolean\)\.join\("\/"\)/);
  assert.match(app, /relativePath = relativePath\.replace\(\/\^Konfiguration/);
  assert.match(app, /source\.treePath \|\| source\.path/);
  assert.match(app, /`Komponenten\/\$\{label\}\/Konfiguration\/Übersicht`/);
  assert.match(app, /`Komponenten\/\$\{label\}\/Konfiguration\/Hardware\/Boardkonfiguration`/);
  assert.match(app, /function ideDeviceConfigurationComponents\(project\)/);
  assert.match(app, /component_id: "primary-iot-device"/);
  assert.match(app, /data-device-configuration="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /function renderDeviceConfigurationOverview\(project, component\)/);
  assert.match(app, /Alle Einstellungen dieses IoT-Devices liegen in dieser gemeinsamen Struktur/);
  assert.match(app, /Hardware und Board bearbeiten/);
  assert.match(app, /Boardkonfiguration[\s\S]*Angeschlossene Komponenten[\s\S]*Funktionen[\s\S]*Treiberverwaltung[\s\S]*Webserver-Konfiguration/);
  assert.match(app, /data-board-properties="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /data-sensor-properties="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /function renderSensorProperties/);
  assert.match(app, /sensor-configuration-table/);
  assert.match(app, /Diese Sicht wiederholt die gespeicherte Sensor-Zuordnung/);
  assert.match(app, /sensor-connection-summary/);
  assert.match(app, /data-device-connections="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /function renderDeviceConnections/);
  assert.match(app, /Alle direkt mit diesem IoT-Device verbundenen Sensoren und Aktoren/);
  assert.match(app, /device-connections-table/);
  assert.match(app, /device_sensor_input_config/);
  assert.match(app, /device_actuator_output_config/);
  assert.match(app, /peripheralProfile\.resources/);
  assert.doesNotMatch(app, /boardCapabilityLayer\("Treiber und Steuerungen"/);
  assert.match(app, /boardCapabilityLayer\("Runtime-Abstraktionen"/);
  assert.match(app, /boardCapabilityLayer\("MCU-Peripherie"/);
  assert.match(html, /id="ideDriverManagementView"/);
  assert.match(app, /Konfiguration\/Software\/Treiberverwaltung/);
  assert.match(app, /function renderDriverManagement/);
  assert.match(app, /openDriverManagement\(\)[\s\S]*ideCodeAssistant[\s\S]*renderIdeCodeAssistant\(project\)/);
  assert.match(app, /Wiederverwendbare Treiber/);
  assert.match(app, /Aus einer Funktion ableiten/);
  assert.match(app, /Aktuelle Funktion mit KI prüfen/);
  assert.match(app, /data-driver-ai-prompt/);
  assert.match(app, /function renderMotorDriverAssignments\(project\)/);
  assert.match(app, /Die Treiberkonfiguration verwendet nur Pins und Ressourcen dieses Projektsnapshots/);
  assert.match(app, /function saveMotorDriverAssignment\(event\)/);
  assert.match(app, /data-motor-driver-component/);
  assert.match(guidedProjectView, /"ai_generated_driver"/);
  assert.match(guidedProjectView, /state\.ideViewMode === "driver-management"/);
  assert.match(app, /Durch Runtime verwaltet/);
  assert.match(app, /Beim Aktor auswählen/);
  assert.match(app, /component_hardware_features/);
  assert.match(app, /component-hardware-features/);
  assert.match(server, /handleProjectComponentHardwareFeatures/);
  assert.match(server, /board\.peripheral_profile\?\.resources/);
  assert.match(server, /resources\.filter\(\(item\) => item\.configurable\)/);
  assert.match(server, /component_hardware_features:/);
  assert.match(server, /resource\.pin_profile_key/);
  assert.match(server, /board_peripheral_not_supported/);
});

test("IDE embeds the same board configuration plugin used by provisioning", () => {
  assert.match(html, /board-configuration-plugin\.js/);
  assert.match(app, /BoardConfigurationPlugin\.mount\(pluginRoot/);
  assert.match(app, /Dies ist dieselbe Boardauswahl wie im Provisioning/);
  assert.match(app, /data-save-ide-board-configuration="project"/);
  assert.match(app, /async function saveIdeBoardConfiguration\(saveAsAccount\)/);
  assert.match(app, /account-board-configurations/);
  assert.match(app, /development-projects\/\$\{encodeURIComponent\(project\.id\)\}\/hardware-configuration/);
  assert.match(boardPlugin, /function renderFeatureTable/);
  assert.match(boardPlugin, /function openPinEditor/);
});

test("basis features are visibly immutable and project web extensions remain configurable", () => {
  assert.match(app, /\["wifi", "mqtt", "ota", "http", "webserver"\]/);
  assert.match(app, /basisId === "gernetix-runtime-basissoftware"/);
  assert.match(app, /firmware_basis_variant \|\| \(basisId === "gernetix-runtime-basissoftware" \? "comfort" : ""\)/);
  assert.match(app, /Basissoftware · unveränderlich/);
  assert.match(app, /Messwertdiagramm/);
  assert.match(server, /component-features/);
  assert.match(server, /handleProjectComponentFeatures/);
});

test("data logger template exposes a project-bound PWA dashboard editor without notification rules", () => {
  assert.match(html, /id="idePwaDashboardView"/);
  assert.match(html, /id="pwaDashboardDialog"/);
  assert.match(app, /Komponenten\/Smartphone-App \(PWA\)\/Konfiguration\/PWA-Dashboard/);
  assert.match(app, /function renderPwaDashboardView\(project\)/);
  assert.match(app, /function openPwaDashboardEditor\(\)/);
  assert.match(app, /data-open-pwa-dashboard-editor/);
  assert.match(app, /visible_cards: data\.getAll\("pwa_dashboard_card"\)/);
  assert.match(app, /projektprivate Datenhaltung ist in dieser Datenlogger-Vorlage aktiviert/);
  assert.match(server, /pwa-dashboard/);
  assert.match(server, /handleProjectPwaDashboard/);
  assert.match(server, /pwa_dashboard_not_available/);
  assert.match(server, /normalizePwaDashboardConfiguration/);
  assert.match(server, /normalizeDataLoggerConfiguration/);
  assert.match(server, /dataLoggerConfiguration: template\.dataLogger/);
});
