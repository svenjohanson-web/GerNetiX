const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");

test("IDE uses a compact single-line platform header", () => {
  assert.match(css, /\.ide-workspace-active \.app-shell\s*\{[\s\S]*?padding: 4px 8px 8px;/);
  assert.match(css, /\.ide-workspace-active \.topbar\s*\{[\s\S]*?min-height: 44px;[\s\S]*?margin-bottom: 6px;/);
  assert.match(css, /\.ide-workspace-active \.top-navigation-context > \.eyebrow\s*\{\s*display: none;/);
  assert.match(css, /\.ide-workspace-active \.breadcrumb-tree a,[\s\S]*?min-height: 26px;/);
});
