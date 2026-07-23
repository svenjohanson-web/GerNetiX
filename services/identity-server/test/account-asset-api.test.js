"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("account asset API derives ownership only from the authenticated session", () => {
  assert.match(server, /url\.pathname === "\/api\/account\/assets"/);
  assert.match(server, /accountAssetRepository\.create\(\s*session\.account\.user_id,/);
  assert.match(server, /accountAssetRepository\.list\(session\.account\.user_id\)/);
  assert.match(server, /accountAssetRepository\.get\(session\.account\.user_id,/);
  assert.match(server, /accountAssetRepository\.delete\(session\.account\.user_id,/);
  assert.doesNotMatch(server, /accountAssetRepository\.(?:create|list|get|delete)\(body\.account_id/);
});
