"use strict";

const { readPlatformAppSource } = require("../test-support/platform-app-source");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const server = [path.join(root, "src", "dev-server.js"), path.join(root, "src", "dev", "server", "project-routes.js")]
  .map((file) => fs.readFileSync(file, "utf8")).join("\n");
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const client = readPlatformAppSource();

test("protects Git Light with the Premium project-history entitlement", () => {
  assert.match(server, /"project_history"/);
  assert.match(server, /projects\\\/\(\[\^\/\]\+\)\\\/versions[\s\S]*requireEntitlement\(res, session, "project_history"\)/);
  assert.match(server, /versions\\\/\(\[\^\/\]\+\)\\\/restore[\s\S]*requireEntitlement\(res, session, "project_history"\)/);
});

test("offers versions with or without a freshly built binary", () => {
  assert.match(html, /id="projectVersionDialog"[\s\S]*Ohne Binary sofort speichern[\s\S]*frisch bauen[\s\S]*mit Binary speichern/);
  assert.match(client, /include_binary: includeBinary/);
  assert.match(client, /if \(completed\.status !== "succeeded"\) throw new Error/);
  assert.match(client, /snapshot_sha256/);
});
