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
});

test("shows the catalog camera while keeping its board-supplied connection", () => {
  const platform = fs.readFileSync(path.join(root, "public/app/development-platform.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "src/dev-server.js"), "utf8");

  assert.match(platform, /merged\.concrete_type !== "integrated_camera"/);
  assert.match(platform, /Kamera ist Bestandteil der gewählten Boardkonfiguration/);
  assert.match(platform, /Display ist Bestandteil der gewählten Boardkonfiguration/);
  assert.match(platform, /Angeschlossen an .* gemäß Boardkonfiguration/);
  assert.match(platform, /Vom gewählten Boardprofil vorgegeben; Anschluss und Pins werden automatisch übernommen/);
  assert.match(platform, /Extern oder ausgetauscht; Anschluss und Mehrfach-Pinbelegung/);
  assert.match(platform, /components: synchronizeCameraComponents\(components, boards\)/);
  assert.match(platform, /camera\.concrete_type = catalogCamera\.sensor_type_id/);
  assert.match(platform, /device\.board_configuration\.board_features\.camera =/);
  assert.match(platform, /function boardFeatureForHardwareComponent\(component, configuration\)/);
  assert.match(platform, /!driverSpecific && !boardSuppliedPins && !component\.pin/);
  assert.match(server, /Pin-Zuordnung: .*\(Boardkonfiguration\)/);
  assert.match(server, /Board-Pins:/);
});
