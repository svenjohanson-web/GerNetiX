const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("Admin-Oberflaeche trennt Support und Moderation nach Capabilities", () => {
  const root = path.join(__dirname, "..", "public");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "admin-config.js"), "utf8");
  assert.match(html, /data-community-capability="admin_community_support"/);
  assert.match(html, /data-community-capability="admin_community_moderation"/);
  assert.match(script, /function canAccessView/);
  assert.match(script, /Deine Rolle besitzt keinen Support-Zugriff/);
});
