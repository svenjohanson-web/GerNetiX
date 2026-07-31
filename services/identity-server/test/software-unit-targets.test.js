const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/app/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "public/app/app.js"), "utf8");
const development = fs.readFileSync(path.join(root, "public/app/development-platform.js"), "utf8");
const server = fs.readFileSync(path.join(root, "src/dev-server.js"), "utf8");

test("development platform builds all software units and uses target selection only for flash", () => {
  assert.match(html, /id="ideSoftwareUnitSelect"/);
  assert.match(html, /id="flashTargetChoiceDialog"[\s\S]*>Flash-Ziel\s*</);
  assert.doesNotMatch(html, /id="ideDeviceTools"[\s\S]*id="ideSoftwareUnitSelect"/);
  assert.match(development, /value="desktop_app"/);
  assert.match(development, /Getrennte Quellen und Build-Ziele/);
  assert.match(app, /async function startBuild\(\)[\s\S]*const buildTargets = softwareUnits\.length \? softwareUnits : \[null\]/);
  assert.match(app, /Promise\.allSettled\(buildTargets\.map/);
  assert.match(server, /software_unit_id: softwareUnit\?\.software_unit_id \|\| ""/);
  assert.match(app, /Gesamtbuild: \$\{succeeded\} von \$\{buildTargets\.length\} Software-Einheiten erfolgreich/);
  assert.match(app, /Gesamtbuild nicht gestartet\. Für folgende Software-Einheiten fehlt ein Build-Runner/);
  assert.match(app, /function prepareFlashTarget\(project, action, targetConfirmed = false\)/);
  assert.match(server, /function developmentSoftwareUnits/);
  assert.match(server, /unit\.hardware_profile_id === hardware\.board_profile_id/);
  assert.match(server, /unit\.source_root === hardware\?\.component_path/);
  assert.match(server, /!derivedSoftwareUnitIds\.has\(unit\.software_unit_id\)/);
  assert.match(server, /matchingUnit\?\.source_root/);
  assert.match(server, /runner_status: "not_connected"/);
});
