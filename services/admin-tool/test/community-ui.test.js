const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");

test("admin UI separates support, community requests and reported messages", () => {
  const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(publicRoot, "admin-config.js"), "utf8");

  assert.match(html, /data-admin-view="community"/);
  assert.match(html, /Support-Anfragen/);
  assert.match(html, /Community-Anfragen/);
  assert.match(html, /Gemeldete Nachrichten/);
  assert.match(html, /kein Zugriff auf private Direktnachrichten/);
  assert.match(script, /\/api\/admin\/community\/support-threads/);
  assert.match(script, /\/api\/admin\/community\/message-reports/);
  assert.match(script, /admin_community_moderation/);
});
