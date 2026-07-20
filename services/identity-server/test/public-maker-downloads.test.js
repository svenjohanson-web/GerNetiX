const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "downloads", "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");

test("serves a public maker download page", () => {
  assert.match(server, /url\.pathname === "\/downloads"[\s\S]*serveStatic\(res, publicDir, "\/downloads\/index\.html"\)/);
  assert.match(page, /Freie Maker-Projekte/);
  assert.match(page, /ESP32-S3 Touch Game Collection/);
  assert.match(page, /MakerWorld/);
  assert.match(page, /Download folgt mit der Veröffentlichung/);
});
