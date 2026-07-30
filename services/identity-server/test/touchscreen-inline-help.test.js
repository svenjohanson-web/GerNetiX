const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const controller = fs.readFileSync(path.join(appRoot, "development-platform.js"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");

test("explains touchscreen board question marks on hover, focus and click", () => {
  assert.match(html, /data-inline-help[\s\S]*aria-controls="touchscreenBoardHelp"/);
  assert.match(html, /data-inline-help[\s\S]*aria-controls="touchscreenInventoryHelp"/);
  assert.match(html, /class="hardware-inline-help-popover" role="tooltip"/);
  assert.match(controller, /function handleInlineHelpClick\(event\)[\s\S]*aria-expanded", "true"/);
  assert.match(controller, /function handleInlineHelpKeydown\(event\)[\s\S]*event\.key !== "Escape"/);
  assert.match(css, /\.hardware-inline-help-wrap:hover \.hardware-inline-help-popover/);
  assert.match(css, /\.hardware-inline-help-wrap:focus-within \.hardware-inline-help-popover/);
  assert.match(css, /\.hardware-inline-help-wrap\.is-open \.hardware-inline-help-popover/);
});

test("does not ask users to choose an internal game pattern", () => {
  assert.doesNotMatch(html, /Spiel-Pattern|Pattern waehlen|data-game-field="pattern_id"/);
  assert.doesNotMatch(controller, /querySelector\('\[data-game-field="pattern_id"\]'\)/);
  assert.match(controller, /disabled = !configuration\.board_profile_id[\s\S]*!configuration\.selected_game_ids\.length/);
});

test("opens the configured game project after saving", () => {
  assert.match(html, /data-game-save>Spielprojekt speichern und öffnen/);
  assert.match(controller, /function saveTouchscreenGameConfiguration\(\)[\s\S]*await persistDevelopmentDialog\(\)[\s\S]*await openProjectInIde\(projectId\)/);
  assert.match(controller, /saveDevelopmentArchitectureButton"\)\?\.classList\.toggle\("hidden", visible\)/);
  assert.match(controller, /acceptDevelopmentArchitectureButton"\)\?\.classList\.toggle\("hidden", visible\)/);
});
