"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

test("offers an admin view for Forgejo sources, commit-bound builds and artifacts", () => {
  assert.match(html, /data-admin-view="source-repositories"/);
  assert.match(html, /Basissoftware und Produkte/);
  assert.match(html, /Private Projekt-Repositories/);
  assert.match(html, /Letzte Builds und Artefakte/);
  assert.match(client, /\/api\/admin\/source-repositories/);
  assert.match(client, /basissoftware_references/);
  assert.match(client, /package_sha256/);
});
