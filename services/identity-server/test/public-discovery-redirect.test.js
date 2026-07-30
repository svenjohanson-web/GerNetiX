const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");

test("redirects legacy discovery routes to the public project catalog", () => {
  assert.match(server, /url\.pathname === "\/entdecken"[\s\S]*redirect\(res, "\/nachbauprojekte\/"\)/);
  assert.match(server, /url\.pathname === "\/downloads"[\s\S]*redirect\(res, "\/nachbauprojekte\/"\)/);
  assert.equal(fs.existsSync(path.join(root, "public", "downloads", "index.html")), false);
});
