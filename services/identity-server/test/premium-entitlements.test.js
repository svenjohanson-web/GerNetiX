const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");
const platform = fs.readFileSync(path.join(root, "public", "app", "development-platform.js"), "utf8");
const guidedProject = fs.readFileSync(path.join(root, "public", "app", "guided-project-view.js"), "utf8");

test("protects premium technology and all AI chat endpoints on server and client", () => {
  assert.match(server, /requiredEntitlements/);
  assert.match(server, /available: hasEntitlements\(session, template\.required_entitlements\)/);
  assert.match(server, /requireEntitlement\(res, session, "ai_assistant"\)/);
  assert.match(server, /requireEntitlements\(res, session, template\.requiredEntitlements \|\| \[\]\)/);
  assert.match(server, /"web_push"/);
  assert.match(platform, /template\.available === false \? "disabled"/);
  assert.match(platform, /hasPremiumAi/);
  assert.match(guidedProject, /KI-Unterstuetzung ist im Premium-Abo enthalten/);
});
