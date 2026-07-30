const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");

test("IDE resizes the editor frame and terminal as one split workspace", () => {
  assert.match(css, /\.ide-workspace-active \.ide-workbench\s*\{[\s\S]*?grid-template-rows: minmax\(0, 1fr\) 7px var\(--ide-console-height, clamp\(260px, 32vh, 360px\)\)/);
  assert.match(css, /\.ide-workspace-active \.ide-source-workspace textarea\s*\{[\s\S]*?resize: none;/);
  assert.match(css, /\.ide-workspace-active \.ide-workspace-resize-handle\s*\{[\s\S]*?cursor: row-resize;/);
  assert.match(css, /\.ide-workspace-active \.ide-build-console\s*\{[\s\S]*?grid-row: 3;[\s\S]*?resize: none;/);
});
