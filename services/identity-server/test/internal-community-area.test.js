const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const identityRoot = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(identityRoot, "src", "dev-server.js"), "utf8");
const internalHtml = fs.readFileSync(path.join(identityRoot, "public", "app", "index.html"), "utf8");
const internalClient = fs.readFileSync(path.join(identityRoot, "public", "app", "app.js"), "utf8");
const publicHtml = fs.readFileSync(path.join(identityRoot, "public", "community", "index.html"), "utf8");

test("keeps creation and replies inside the authenticated community area", () => {
  assert.match(server, /if \(url\.pathname\.startsWith\("\/app\/"\)\) \{[\s\S]*?if \(!readSession\(req\)\) \{[\s\S]*?redirect\(res, authRoute\(url\.pathname \+ url\.search\)\)/);
  assert.match(server, /if \(url\.pathname\.startsWith\("\/api\/community"\)\) \{[\s\S]*?if \(!session\) \{ sendJson\(res, 401, \{ error: "not_authenticated" \}\)/);
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
