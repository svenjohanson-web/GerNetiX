const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDevelopmentPlatformSource } = require("../test-support/platform-app-source");

const root = path.resolve(__dirname, "..");
const readServer = () => ["src/dev-server.js", "src/dev/projects/project-configuration-service.js", "src/dev/projects/project-hardware-model.js"]
  .map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

test("persists the camera and display template boards as its initial hardware realization", () => {
  const server = readServer();

  assert.match(server, /let hardwareConfiguration = templateHardwareConfiguration\(template\)/);
  assert.match(server, /board_configuration: compilerBoardConfiguration\(null, board\)/);
  assert.match(server, /templateModelVersion: template\.schemaVersion,\s+hardwareConfiguration,/);
  assert.match(server, /defaultProjectCommunicationSetup\(softwareUnits\)/);
  assert.match(server, /communicationSetup,/);
  assert.match(server, /hardwareConfiguration = normalizeHardwareConfiguration\(hardwareConfiguration/);
  assert.ok((server.match(/software_units: softwareUnits/g) || []).length >= 2,
    "Systemtemplate und Accountkopie muessen dieselben aufgeloesten Software-Einheiten erhalten.");
});

test("never migrates an existing camera template project while loading or opening it", () => {
  const devServer = fs.readFileSync(path.join(root, "src/dev-server.js"), "utf8");
  const proposal = fs.readFileSync(path.join(root, "src/dev/development-project-template-migrations.js"), "utf8");

  assert.doesNotMatch(devServer, /synchronizeDevelopmentTemplateRuntimeModel/);
  assert.doesNotMatch(devServer, /development-project-template-migrations/);
  assert.doesNotMatch(devServer, /migrateCameraTemplateWifiArchitecture/);
  assert.doesNotMatch(devServer, /migrateCameraTemplateDisplayGpioTypes/);
  assert.doesNotMatch(devServer, /runtime_model_version: targetVersion/);
  assert.match(proposal, /customer_consent_required: true/);
  assert.match(proposal, /automatic_execution: false/);
});

test("shows the catalog camera while keeping its board-supplied connection", () => {
  const platform = readDevelopmentPlatformSource();
  const server = readServer();

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

test("keeps non-editable catalog features in the board snapshot without false modification warnings", () => {
  const platform = readDevelopmentPlatformSource();

  assert.match(platform, /DevelopmentHardwareModel\.catalogBoardFeatureSelections\(board, catalog\)/);
  assert.match(platform, /DevelopmentHardwareModel\.hiddenBoardFeatureSelections\([\s\S]*previous\?\.board_features,[\s\S]*defaults,[\s\S]*visibleFeatureIds/);
});
