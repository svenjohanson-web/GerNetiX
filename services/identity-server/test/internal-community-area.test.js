const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const identityRoot = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(identityRoot, "src", "dev-server.js"), "utf8");
const communityRoutes = fs.readFileSync(path.join(identityRoot, "src", "dev", "server", "community-routes.js"), "utf8");
const internalHtml = fs.readFileSync(path.join(identityRoot, "public", "app", "index.html"), "utf8");
const internalClient = readPlatformAppSource();
const publicHtml = fs.readFileSync(path.join(identityRoot, "public", "community", "index.html"), "utf8");

test("keeps creation and replies inside the authenticated community area", () => {
  assert.match(server, /registerWebRoutes/);
  const webRoutes = fs.readFileSync(path.join(identityRoot, "src", "dev", "server", "web-routes.js"), "utf8");
  assert.match(webRoutes, /pattern: \/\^\\\/app\\\//);
  assert.match(webRoutes, /await requireSession\(req, null\)/);
  assert.match(webRoutes, /redirect\(res, authRoute\(url\.pathname \+ url\.search\)\)/);
  assert.match(communityRoutes, /pattern: \/\^\\\/api\\\/community/);
  assert.match(communityRoutes, /requireSession\(req, res\)/);
  assert.match(internalHtml, /id="communityView"[\s\S]*Interner Kontobereich[\s\S]*id="communityRequestForm"/);
  assert.match(internalHtml, /name="visibility" value="public"[\s\S]*name="visibility" value="private"/);
  assert.match(internalClient, /postJson\("\/api\/community\/questions"/);
  assert.match(internalClient, /postJson\(`\/api\/community\/questions\/\$\{encodeURIComponent\(questionId\)\}\/answers`/);
});

test("keeps the public community read-only and sends authors to login", () => {
  assert.match(publicHtml, /Öffentlich lesen/);
  assert.match(publicHtml, /Öffentliche Fragen und Antworten kannst du ohne Konto lesen/);
  assert.match(publicHtml, /href="\/app\/auth\/\?next=%2Fapp%2Fcommunity%2F">Anmelden und Anfrage stellen/);
  assert.doesNotMatch(publicHtml, /<form/);
});
