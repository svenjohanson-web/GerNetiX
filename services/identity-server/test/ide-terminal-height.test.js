const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");

test("IDE build console keeps several terminal lines visible", () => {
  assert.match(css, /\.ide-workspace-active \.ide-build-console\s*\{[\s\S]*?height: clamp\(260px, 32vh, 360px\);/);
  assert.match(css, /\.ide-workspace-active \.ide-build-console\s*\{[\s\S]*?min-height: 230px;/);
  assert.match(css, /resize: vertical;/);
});
