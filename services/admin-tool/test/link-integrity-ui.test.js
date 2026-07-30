"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");

test("Admin Tool exposes the capability-protected link integrity view", () => {
  const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(publicRoot, "admin-config.js"), "utf8");

  assert.match(html, /data-admin-view="link-integrity">Links/);
  assert.match(html, /id="linkIntegrityView"/);
  assert.match(html, /id="syncLinkIntegrityButton"/);
  assert.match(script, /\/api\/admin\/link-integrity\/sync/);
  assert.match(script, /latest_check/);
});
