const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");
const communityRoutes = fs.readFileSync(path.join(__dirname, "..", "src", "dev", "server", "community-routes.js"), "utf8");
const webRoutes = fs.readFileSync(path.join(__dirname, "..", "src", "dev", "server", "web-routes.js"), "utf8");
const html = fs.readFileSync(path.join(publicRoot, "community", "index.html"), "utf8");
const client = fs.readFileSync(path.join(publicRoot, "community", "app.js"), "utf8");

test("serves a readable public community while keeping requests behind login", () => {
  assert.match(server, /registerWebRoutes/);
  assert.match(webRoutes, /path: routePath[\s\S]*serveStatic\(res, publicDir, "\/community\/index\.html"\)/);
  assert.match(communityRoutes, /path: "\/api\/public\/community\/questions"/);
  assert.match(communityRoutes, /api\\\/public\\\/community\\\/questions/);
  assert.match(html, /Öffentlich lesen/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Fcommunity%2F">Anmelden und Anfrage stellen/);
  assert.match(client, /\/api\/public\/community\/questions/);
});
