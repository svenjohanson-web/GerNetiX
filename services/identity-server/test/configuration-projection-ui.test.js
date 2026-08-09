const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const ide = fs.readFileSync(path.join(root, "public", "app", "app-ide-controller.js"), "utf8");
const server = ["dev-server.js", path.join("dev", "projects", "project-configuration-service.js")]
  .map((file) => fs.readFileSync(path.join(root, "src", file), "utf8")).join("\n");

test("configuration dialogs refresh their newly projected files in the IDE tree", () => {
  assert.match(ide, /async function refreshProjectedProjectSources\(project\)/);
  assert.match(ide, /delete state\.projectSourcesByProjectId\[project\.id\]/);
  for (const saveFunction of [
    "saveEventConfiguration",
    "saveMotorDriverAssignment",
    "savePwaDashboard",
    "saveIdeBoardConfiguration",
    "saveComponentFeatures",
    "saveCommunicationSetup",
    "saveBasissoftwareConfiguration",
  ]) {
    const start = ide.indexOf(`function ${saveFunction}`);
    assert.notEqual(start, -1, `${saveFunction} fehlt`);
    assert.match(ide.slice(start, start + 7000), /refreshProjectedProjectSources\(/, `${saveFunction} aktualisiert den Projektbaum nicht`);
  }
});

test("dialog responses expose changed project paths and generated files stay read-only", () => {
  assert.match(server, /configuration_projection: persistedProject\.configuration_projection \|\| null/);
  assert.match(ide, /function configurationProjectionStatus\(response/);
  assert.match(ide, /source\?\.role !== "generated_configuration_header"/);
});
