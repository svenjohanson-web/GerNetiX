const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("platform offers an authenticated USB Serial Helper download area", () => {
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  assert.match(html, /href="\/app\/downloads\/"/);
  assert.match(html, /USB Serial Helper/);
  assert.match(app, /\/api\/platform\/downloads/);
  assert.match(serverSource, /if \(!readSession\(req\)\)/);
  assert.match(serverSource, /downloads\/usb-serial-helper/);
  assert.match(serverSource, /mac-arm64\\\.zip/);
  assert.match(serverSource, /win-x64\\\.exe/);
});
