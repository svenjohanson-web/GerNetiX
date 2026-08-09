const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const app = readPlatformAppSource();
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const boardPlugin = fs.readFileSync(path.resolve(__dirname, "../public/app/board-configuration-plugin.js"), "utf8");
const shell = fs.readFileSync(path.resolve(__dirname, "../public/app/app-shell-controller.js"), "utf8");
const server = ["dev-server.js", path.join("dev", "server", "project-routes.js"), path.join("dev", "projects", "project-configuration-service.js")]
  .map((file) => fs.readFileSync(path.resolve(__dirname, "../src", file), "utf8"))
  .join("\n");
const guidedProjectView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");

test("IDE exposes component properties and an embedded web interface workspace", () => {
  assert.match(html, /id="ideComponentFeaturesView"/);
  assert.match(html, /id="ideBoardPropertiesView"/);
  assert.match(html, /id="ideSensorPropertiesView"/);
  assert.match(html, /id="ideDeviceConnectionsView"/);
  assert.doesNotMatch(html, /id="ideDeviceWebView"/);
  assert.match(app, /Weboberfläche des Entwicklungsprojekts/);
  assert.match(app, /<iframe title="Device-Webserver"/);
  assert.match(app, /data-web-interface-tab="configuration"/);
  assert.match(app, /data-web-interface-tab="preview"/);
  assert.doesNotMatch(app, /renderProjectRealizations\(/);
  assert.match(app, /async function loadIdeProject[\s\S]*renderIdeCodeAssistant\(project\);[\s\S]*if \(projectNeedsHardwareTools\(project\)\) void refreshUsbPorts\(false\);[\s\S]*const sources = await loadProjectSources\(project\);/);
});

test("software configuration views are direct entries in the component configuration folder", () => {
  assert.doesNotMatch(app, /`\$\{component\}\/Konfiguration\/Funktionen`/);
  assert.match(app, /`\$\{component\}\/Konfiguration\/Treiber`/);
  assert.match(app, /`\$\{component\}\/Konfiguration\/Weboberfläche`/);
  assert.doesNotMatch(app, /`\$\{component\}\/Konfiguration\/Webserver(?:-Vorschau)?`/);
  assert.doesNotMatch(app, /`\$\{component\}\/Konfiguration\/Software\//);
  assert.match(app, /function renderWebInterface\(project\)/);
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

test("project browser keeps one flat IoT device configuration folder", () => {
  assert.match(app, /function projectBrowserSources\(project, sources\)/);
  assert.match(app, /sourcePrefix: String\(component\.component_path\)/);
  assert.match(app, /treePrefix: `Komponenten\/\$\{componentTreeLabel\(component\)\}`/);
  assert.match(app, /treePath: \[mapping\.treePrefix, relativePath\]\.filter\(Boolean\)\.join\("\/"\)/);
  assert.match(app, /rootSource && primaryMapping/);
  assert.match(app, /function sourceTreeRelativePath\(value\)/);
  assert.match(app, /Source\/include`, directoryOnly: true/);
  assert.match(app, /Source\/src`, directoryOnly: true/);
  assert.match(app, /if \(source\.directoryOnly\)/);
  assert.match(app, /primaryMapping\.treePrefix\}\/\$\{sourceTreeRelativePath\(source\.path\)\}/);
  assert.match(app, /relativePath = sourceTreeRelativePath\(relativePath\)/);
  assert.match(app, /relativePath = relativePath\.replace\(\/\^Konfiguration/);
  assert.match(app, /source\.treePath \|\| source\.path/);
  assert.match(app, /data-ide-tree-path="\$\{escapeAttribute\(file\.path\)\}"/);
  assert.match(app, /function selectIdeTreePath\(path\)/);
  assert.match(app, /state\.ideTreeSelectionPath \|\| state\.sourcePath/);
  assert.match(app, /selectIdeTreePath\(selectedTreeEntry\.dataset\.ideTreePath\)/);
  assert.match(app, /`Komponenten\/\$\{label\}\/Konfiguration\/Board`/);
  assert.match(app, /`Komponenten\/\$\{label\}\/Konfiguration\/Boardexterne Anschlüsse`/);
  assert.doesNotMatch(app, /Konfiguration\/Übersicht|Konfiguration\/Hardware\/Boardkonfiguration/);
  assert.match(app, /function ideDeviceConfigurationComponents\(project\)/);
  assert.match(app, /component_id: "primary-iot-device"/);
  assert.doesNotMatch(app, /data-device-configuration=|renderDeviceConfigurationOverview|device-configuration-overview/);
  assert.match(app, /data-board-properties="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /data-sensor-properties="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /function renderSensorProperties/);
  assert.match(app, /sensor-configuration-table/);
  assert.match(app, /Diese Sicht wiederholt die gespeicherte Sensor-Zuordnung/);
  assert.match(app, /sensor-connection-summary/);
  assert.match(app, /data-device-connections="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /function renderDeviceConnections/);
  assert.match(app, /Hier erscheinen ausschließlich zusätzlich am Board angeschlossene Sensoren und Aktoren/);
  assert.match(app, /function isBoardIntegratedHardwareComponent/);
  assert.match(app, /item\.target_device_id === device\.component_id && !isBoardIntegratedHardwareComponent\(item, device\)/);
  assert.match(app, /Integrierte Ausstattung findest du unter Board/);
  assert.match(app, /device-connections-table/);
  assert.match(app, /device_sensor_input_config/);
  assert.match(app, /device_actuator_output_config/);
  assert.match(app, /component_data[\s\S]*component_relations[\s\S]*device_board_config/);
  assert.doesNotMatch(app, /MCU-Peripherie|Runtime-Abstraktionen|Verwendete Boardfunktionen|Boardfunktionen speichern/);
  assert.doesNotMatch(app, /saveBoardPeripheralUsage|board-capability-hierarchy/);
  assert.match(html, /id="ideDriverManagementView"/);
  assert.match(app, /Konfiguration\/Treiber/);
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
  assert.match(server, /handleProjectComponentHardwareFeatures/);
  assert.match(server, /board\.peripheral_profile\?\.resources/);
  assert.match(server, /resources\.filter\(\(item\) => item\.configurable\)/);
  assert.match(server, /component_hardware_features:/);
  assert.match(server, /resource\.pin_profile_key/);
  assert.match(server, /board_peripheral_not_supported/);
});

test("project browser separates implementation and header files below the component Source folder", () => {
  const functionSource = app.slice(app.indexOf("function projectBrowserSources"), app.indexOf("function projectVirtualTreeEntries"));
  const projectBrowserSources = vm.runInNewContext(`${functionSource}\nprojectBrowserSources;`, {
    projectHardwareComponents: () => [{ abstract_type: "iot_device", component_path: "Komponenten/IoT-Device 1", label: "IoT-Device 1" }],
    projectNeedsHardwareTools: () => true,
    primaryComponentPath: () => "Komponenten/IoT-Device 1",
    componentTreeLabel: (component) => component.label,
  });
  const result = projectBrowserSources({}, [
    { path: "src/main.cpp", role: "user_code" },
    { path: "Komponenten/IoT-Device 1/src/user_main.cpp", role: "user_code" },
    { path: "Komponenten/IoT-Device 1/include/camera_state.hpp", role: "header" },
    { path: "Komponenten/IoT-Device 1/src/legacy_state.h", role: "header" },
  ]);
  assert.equal(result[0].treePath, "Komponenten/IoT-Device 1/Source/src/main.cpp");
  assert.equal(result[1].treePath, "Komponenten/IoT-Device 1/Source/src/user_main.cpp");
  assert.equal(result[2].treePath, "Komponenten/IoT-Device 1/Source/include/camera_state.hpp");
  assert.equal(result[3].treePath, "Komponenten/IoT-Device 1/Source/include/legacy_state.h");
});

test("IDE embeds the same board configuration plugin used by provisioning", () => {
  assert.doesNotMatch(html, /board-configuration-plugin\.js/);
  assert.match(shell, /loadGuidedProjectAssets[\s\S]*board-configuration-plugin\.js/);
  assert.match(app, /BoardConfigurationPlugin\.mount\(pluginRoot/);
  assert.match(app, /Änderungen werden als eigener, vollständiger Projektsnapshot gespeichert/);
  assert.match(app, /configuration_scope: "project"/);
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
  assert.match(app, /Der Quellcode der GerNetiX-Basissoftware bleibt unveränderbar/);
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
