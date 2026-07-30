"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const client = fs.readFileSync(path.join(root, "public", "app", "app.js"), "utf8");

test("protects Git Light with the Premium project-history entitlement", () => {
  assert.match(server, /"project_history"/);
  assert.match(server, /platformVersions[\s\S]*requireEntitlement\(res, session, "project_history"\)/);
  assert.match(server, /platformVersionRestore[\s\S]*requireEntitlement\(res, session, "project_history"\)/);
});

test("offers versions with or without a freshly built binary", () => {
  assert.match(html, /id="projectVersionDialog"[\s\S]*Ohne Binary sofort speichern[\s\S]*frisch bauen[\s\S]*mit Binary speichern/);
  assert.match(client, /include_binary: includeBinary/);
  assert.match(client, /if \(completed\.status !== "succeeded"\) throw new Error/);
  assert.match(client, /snapshot_sha256/);
});
