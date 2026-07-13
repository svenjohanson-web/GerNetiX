const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");

test("the complete IDE uses dense workbench spacing", () => {
  assert.match(css, /#ideView\s*\{[\s\S]*?margin: 0;[\s\S]*?padding: 5px;/);
  assert.match(css, /#ideView \.ide-layout \{ gap: 5px; \}/);
  assert.match(css, /#ideView \.ide-project-browser-panel,[\s\S]*?padding: 7px;/);
  assert.match(css, /#ideView \.ide-code-assistant \.code-explorer-chat\s*\{[\s\S]*?gap: 6px;[\s\S]*?padding: 7px;/);
  assert.match(css, /#ideView \.ide-viewer-head\s*\{[\s\S]*?margin: -7px -7px 0;[\s\S]*?padding: 6px 8px;/);
});
