const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("persists the camera and display template boards as its initial hardware realization", () => {
  const server = fs.readFileSync(path.join(root, "src/dev-server.js"), "utf8");

  assert.match(server, /let hardwareConfiguration = templateHardwareConfiguration\(template\)/);
  assert.match(server, /board_configuration: compilerBoardConfiguration\(null, board\)/);
  assert.match(server, /templateModelVersion: template\.schemaVersion,\s+hardwareConfiguration,/);
  assert.match(server, /defaultProjectCommunicationSetup\(softwareUnits\)/);
  assert.match(server, /communicationSetup,/);
  assert.match(server, /hardwareConfiguration = normalizeHardwareConfiguration\(hardwareConfiguration/);
  assert.ok((server.match(/software_units: softwareUnits/g) || []).length >= 2,
    "Systemtemplate und Accountkopie muessen dieselben aufgeloesten Software-Einheiten erhalten.");
});

test("repairs the runtime contract of account projects created from older camera templates", () => {
  const server = fs.readFileSync(path.join(root, "src/dev-server.js"), "utf8");

  assert.match(server, /synchronizeDevelopmentTemplateRuntimeModel\(project, session\)/);
  assert.match(server, /refreshCatalogBoardConfigurations = currentVersion < 19/);
  assert.match(server, /currentVersion >= targetVersion && !missingBoardConfiguration[\s\S]*!refreshCatalogBoardConfigurations/);
  assert.match(server, /missingCommunicationSetup/);
  assert.match(server, /communication_setup: communicationSetup/);
  assert.match(server, /applyProjectCommunicationSetup\(softwareUnits, communicationSetup\)/);
  assert.match(server, /hardware\.board_configuration[\s\S]*compilerBoardConfiguration\(null, catalogBoard\)/);
  assert.match(server, /preservedBuildValues\.board_configuration = compilerBoardConfiguration\([\s\S]*catalogBoard/);
  assert.match(server, /board_configuration: compilerBoardConfiguration\(component\.board_configuration, catalogBoard\)/);
  assert.match(server, /baseBuildConfig && resolvedBoardConfiguration[\s\S]*board_configuration: compilerBoardConfiguration\(resolvedBoardConfiguration, board\)/);
  assert.match(server, /runtime_model_version: targetVersion/);
  assert.match(server, /migrateCameraTemplateWifiArchitectureSources\(project\.project_id\)/);
  assert.match(server, /currentVersion < 19[\s\S]*migrateCameraTemplateDisplaySource\(project\.project_id\)/);
  assert.match(server, /view\.id === "architecture-diagram" && migratedArchitectureSource/);
  assert.match(server, /source_root: `Komponenten\/IoT-Device \$\{index \+ 1\}`/);
  assert.match(server, /\.\.\.canonical\.build_config/);
  assert.match(server, /currentVersion < 16[\s\S]*preservedBuildValues\.platformio_options = existingBuild\.platformio_options/);
});

test("shows the catalog camera while keeping its board-supplied connection", () => {
  const platform = fs.readFileSync(path.join(root, "public/app/development-platform.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "src/dev-server.js"), "utf8");

  assert.match(platform, /!String\(merged\.concrete_type \|\| ""\)\.startsWith\("integrated_"\)/);
  assert.match(platform, /\$\{escapeHtml\(component\.label\)\} ist Bestandteil der gewählten Boardkonfiguration/);
  assert.match(platform, /Angeschlossen an .* gemäß Boardkonfiguration/);
  assert.match(platform, /Vom gewählten Boardprofil vorgegeben; Anschluss und Pins werden automatisch übernommen/);
  assert.match(platform, /Extern oder ausgetauscht; Anschluss und Mehrfach-Pinbelegung/);
  assert.match(platform, /components: synchronizeCameraComponents\(components, boards\)/);
  assert.match(platform, /camera\.concrete_type = catalogCamera\.sensor_type_id/);
  assert.match(platform, /device\.board_configuration\.board_features\.camera =/);
  assert.match(platform, /function boardFeatureForHardwareComponent\(component, configuration\)/);
  assert.match(platform, /!boardIntegrated && !driverSpecific && !boardSuppliedPins && !component\.pin/);
  assert.match(server, /Pin-Zuordnung: .*\(Boardkonfiguration\)/);
  assert.match(server, /Board-Pins:/);
  assert.match(server, /component\.hardware_scope = boardFeatureId \? "board_integrated" : "board_external"/);
  assert.match(server, /component\.hardware_scope !== "board_integrated"/);
});
