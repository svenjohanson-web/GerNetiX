"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev", "server", "account-routes.js"), "utf8");

test("account asset API derives ownership only from the authenticated session", () => {
  assert.match(server, /path: "\/api\/account\/assets"/);
  assert.match(server, /repository\.create\(session\.account\.user_id,/);
  assert.match(server, /repository\.list\(session\.account\.user_id\)/);
  assert.match(server, /repository\.get\(session\.account\.user_id,/);
  assert.match(server, /repository\.delete\(session\.account\.user_id,/);
  assert.doesNotMatch(server, /repository\.(?:create|list|get|delete)\(body\.account_id/);
});
