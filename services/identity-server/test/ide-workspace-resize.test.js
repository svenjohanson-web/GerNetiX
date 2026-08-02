const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = readPlatformAppSource();

test("IDE exposes one accessible splitter for editor frame and terminal", () => {
  assert.match(html, /id="ideWorkspaceResizeHandle"[\s\S]*role="separator"[\s\S]*aria-orientation="horizontal"/);
  assert.match(html, /app\.css\?v=20260802-debug-workspace-feedback-rating/);
  assert.match(html, /app\.js\?v=20260802-debug-workspace/);
  assert.match(html, /app-ide-controller\.js\?v=20260802-debug-workspace/);
  assert.match(html, /app-event-bindings\.js\?v=20260802-debug-workspace/);
  assert.match(app, /function initializeIdeWorkspaceResize\(\)/);
  assert.match(app, /startHeight - \(moveEvent\.clientY - startY\)/);
  assert.match(app, /workbench\.style\.setProperty\("--ide-console-height"/);
  assert.match(app, /\["ArrowUp", "ArrowDown", "Home"\]/);
  assert.match(app, /handle\.addEventListener\("dblclick", resetIdeConsoleHeight\)/);
});
