const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
const publicApp = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const assistant = fs.readFileSync(path.resolve(__dirname, "../src/dev/development-assistant.js"), "utf8");

test("shows a contextual AI chat only for code explorer views", () => {
  assert.match(guidedView, /view\?\.type === "source_analysis"/);
  assert.match(guidedView, /artifact\?\.type === "code"/);
  assert.match(guidedView, /Code gemeinsam verstehen/);
  assert.match(guidedView, /assistantMode: "code_explorer"/);
  assert.match(guidedView, /content: artifact\.content \|\| document\.querySelector\("#sourceEditor"\)/);
});

test("routes code explorer questions with bounded source context", () => {
  assert.match(assistant, /codeExplorerMode \? "code_generation" : "architecture_discovery"/);
  assert.match(assistant, /Rolle: Code-Explorer/);
  assert.match(assistant, /slice\(0, 24000\)/);
  assert.match(assistant, /"code_explorer_assistance"/);
});

test("knows project artifacts and applies confirmed edits through project source persistence", () => {
  assert.match(publicApp, /GuidedProjectView\.create\(\{[\s\S]*getJson,[\s\S]*putJson,/);
  assert.match(guidedView, /loadCodeExplorerProjectFiles/);
  assert.match(guidedView, /artifacts: guidedViews\(project\)/);
  assert.match(guidedView, /data-apply-code-edit/);
  assert.match(guidedView, /await putJson\(`\/api\/platform\/projects\/\$\{encodeURIComponent\(project\.id\)\}\/sources/);
  assert.match(assistant, /<gernetix-file-edits>/);
  assert.match(assistant, /allowedPaths\.has\(edit\.path\)/);
});
