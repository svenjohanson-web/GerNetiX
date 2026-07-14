const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");

test("IDE collects project information and action hints in a switchable terminal area", () => {
  assert.match(html, /class="ide-console-workspace"/);
  assert.match(html, /id="showIdeTerminalButton"/);
  assert.match(html, /id="showIdeProjectInformationButton"/);
  assert.match(html, /id="showIdeProjectHintsButton"/);
  assert.match(html, /id="ideProjectInformation"/);
  assert.match(html, /id="ideActionReason"/);
  assert.match(html, /id="ideProjectHintsPanel" class="ide-project-hints"/);
  assert.match(app, /function renderIdeProjectInformation\(project\)/);
  assert.match(app, /Build-Profil/);
  assert.match(app, /Keine offenen Hinweise fuer dieses Projekt/);
  assert.match(app, /function setIdeConsoleView\(view\)/);
  assert.match(css, /\.ide-console-workspace\.show-project-information \.ide-terminal \{ display: none; \}/);
  assert.match(css, /\.ide-console-workspace\.show-project-information \.ide-project-information \{ display: block;/);
  assert.match(css, /\.ide-console-workspace\.show-hints \.ide-project-hints \{ display: block;/);
});

test("terminal is the default and all three lower IDE views are exclusive", () => {
  assert.match(html, /id="showIdeTerminalButton" class="active"/);
  assert.match(css, /\.ide-project-information,[\s\S]*?\.ide-project-hints\s*\{[\s\S]*?display: none;/);
  assert.match(app, /workspace\.classList\.toggle\("show-hints", showHints\)/);
});
