const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("main menu uses the shared dark typography and states", () => {
  assert.match(css, /\.app-menu\s*\{[\s\S]*?background: #111827/);
  assert.match(css, /\.app-menu a,[\s\S]*?font-family: inherit;[\s\S]*?font-size: 15px/);
  assert.match(css, /\.app-menu a\.active[\s\S]*?background: #164e63/);
  assert.match(css, /\.app-menu \.menu-logout[\s\S]*?color: #fca5a5/);
});

test("platform PWA uses the shared operator shell", () => {
  assert.match(html, /operator-shell\.css/);
  assert.match(html, /Plattform · PWA/);
  assert.match(html, /operator-surface/);
  assert.match(html, /data-route="dashboard">Übersicht/);
  assert.match(html, /data-route="builds">Betrieb/);
  assert.match(server, /\/app\/operator-shell\.css/);
});
