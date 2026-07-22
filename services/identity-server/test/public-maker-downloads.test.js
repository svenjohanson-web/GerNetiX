const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "downloads", "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "landing.css"), "utf8");

test("serves the public GerNetiX discovery area", () => {
  assert.match(server, /url\.pathname === "\/entdecken"[\s\S]*serveStatic\(res, publicDir, "\/downloads\/index\.html"\)/);
  assert.match(server, /url\.pathname === "\/downloads"[\s\S]*redirect\(res, "\/entdecken\/"\)/);
  assert.match(page, /GerNetiX entdecken/);
  assert.match(page, /href="\/nachbauprojekte\/"/);
  assert.match(page, /WLAN &amp; USB Flash Helper/);
  assert.match(page, /href="\/flashbox-einrichten\/"/);
  assert.match(page, /href="\/wissen\/"/);
  assert.doesNotMatch(page, /ESP32-S3 Touch Game Collection/);
  assert.match(styles, /h1 \{ max-width: 1040px; font-size: clamp\(28px, 3\.6vw, 42px\); \}/);
  assert.doesNotMatch(styles, /font-size: clamp\(34px, 5\.4vw, 66px\)/);
});
