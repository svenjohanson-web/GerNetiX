const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicController = fs.readFileSync(path.resolve(__dirname, "../public/app/development-platform.js"), "utf8");
const devServer = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("restores persisted PlantUML when an existing development project is activated", () => {
  const activateProjectBody = publicController.match(/function activateProject[\s\S]*?\n    }\n\n    function architectureDiagramForProject/)?.[0] || "";
  assert.match(publicController, /architectureDiagram = architectureDiagramForProject\(currentProject\(\)\)/);
  assert.match(publicController, /view\?\.payload\?\.source/);
  assert.match(publicController, /view\.payload\?\.derived_from/);
  assert.doesNotMatch(activateProjectBody, /architectureDiagram = null/);
});

test("persists architecture derivation metadata in the project view manifest", () => {
  assert.match(devServer, /derived_from: diagram\?\.derived_from \|\| \(buildable \? "project_template" : "persisted_project"\)/);
  assert.match(devServer, /diagram\?\.function_coverage/);
});
