const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");

test("serves public rebuild projects separately from the discovery page", () => {
  assert.match(server, /url\.pathname === "\/nachbauprojekte"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/index\.html"\)/);
  assert.match(server, /url\.pathname === "\/demos"[\s\S]*redirect\(res, "\/demos\/"\)/);
  assert.match(server, /url\.pathname\.startsWith\("\/demos\/"\)[\s\S]*proxyPublicDemo/);
  assert.match(page, /ESP32-S3 Touch Game Collection/);
  assert.match(page, /MakerWorld/);
  assert.match(page, /href="\/demos\/"/);
  assert.match(page, /Spielesammlung per USB installieren/);
  assert.match(page, /WebSerial funktioniert mit Chrome oder Edge/);
  assert.doesNotMatch(page, /Ver&ouml;ffentlichung folgt/);
});
