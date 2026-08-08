const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = readPlatformAppSource();
const ide = fs.readFileSync(path.join(appRoot, "app-ide-controller.js"), "utf8");
const shell = fs.readFileSync(path.join(appRoot, "app-shell-controller.js"), "utf8");

test("IDE exposes one accessible splitter for editor frame and terminal", () => {
  assert.match(html, /id="ideWorkspaceResizeHandle"[\s\S]*role="separator"[\s\S]*aria-orientation="horizontal"/);
  assert.match(html, /app\.css\?v=20260808-guided-sequence-17/);
  assert.match(html, /app\.js\?v=20260807-flat-guided-learning-2/);
  assert.doesNotMatch(html, /app-ide-controller\.js/);
  assert.match(shell, /loadIdeWorkbenchAssets[\s\S]*app-ide-controller\.js/);
  assert.match(html, /app-event-bindings\.js\?v=20260805-shell-menu-1/);
  assert.match(ide, /function initializeIdeWorkspaceResize\(\)/);
  assert.match(ide, /ideWorkspaceResizeInitialized/);
  assert.match(ide, /startHeight - \(moveEvent\.clientY - startY\)/);
  assert.match(ide, /workbench\.style\.setProperty\("--ide-console-height"/);
  assert.match(ide, /\["ArrowUp", "ArrowDown", "Home"\]/);
  assert.match(ide, /handle\.addEventListener\("dblclick", resetIdeConsoleHeight\)/);
});
