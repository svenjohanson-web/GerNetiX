const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const server = ["dev-server.js", path.join("dev", "server", "web-routes.js")]
  .map((file) => fs.readFileSync(path.join(root, "src", file), "utf8"))
  .join("\n");

test("redirects legacy discovery routes to the public project catalog", () => {
  assert.match(server, /\["\/entdecken", "\/entdecken\/", "\/downloads", "\/downloads\/"\][\s\S]*redirect\(res, "\/nachbauprojekte\/"\)/);
  assert.equal(fs.existsSync(path.join(root, "public", "downloads", "index.html")), false);
});
