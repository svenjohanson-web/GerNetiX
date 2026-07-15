const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");
const httpApp = fs.readFileSync(path.join(__dirname, "..", "src", "http-app.js"), "utf8");
const shell = fs.readFileSync(path.join(__dirname, "..", "..", "shared", "public", "operator-shell.css"), "utf8");

test("admin uses the shared private operator shell without changing server authorization", () => {
  assert.match(html, /operator-shell\.css/);
  assert.match(html, /Private Administration/);
  assert.match(html, />Übersicht<\/button>/);
  assert.match(html, />Sicherheit<\/button>/);
  assert.match(client, /classList\.toggle\("is-active", active\)/);
  assert.match(httpApp, /\/admin\/operator-shell\.css/);
  assert.match(shell, /Gemeinsame visuelle Sprache/);
  assert.match(shell, /operator-surface-badge/);
});
