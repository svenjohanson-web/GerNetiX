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

test("keeps integrated camera and display configuration in their selected boards", () => {
  const platform = fs.readFileSync(path.join(root, "public/app/development-platform.js"), "utf8");

  assert.match(platform, /merged\.concrete_type !== "integrated_camera"/);
  assert.match(platform, /Kamera ist Bestandteil der gewählten Boardkonfiguration/);
  assert.match(platform, /Display ist Bestandteil der gewählten Boardkonfiguration/);
  assert.match(platform, /Angeschlossen an .* gemäß Boardkonfiguration/);
});
