const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("main menu uses the shared dark typography and states", () => {
  assert.match(css, /\.app-menu\s*\{[\s\S]*?background: #111827/);
  assert.match(css, /\.app-menu a,[\s\S]*?font-family: inherit;[\s\S]*?font-size: 15px/);
  assert.match(css, /\.app-menu a\.active[\s\S]*?background: #164e63/);
  assert.match(css, /\.app-menu \.menu-logout[\s\S]*?color: #fca5a5/);
});

test("authenticated menu groups detailed destinations under five visible choices", () => {
  assert.match(html, /data-route="dashboard"[^>]*>Übersicht/);
  assert.match(html, /<summary data-i18n="platform\.menu\.work">Arbeiten<\/summary>/);
  assert.match(html, /<summary data-i18n="platform\.menu\.knowledge_tools">Wissen &amp; Werkzeuge<\/summary>/);
  assert.match(html, /<summary data-i18n="platform\.menu\.gernetix">GerNetiX<\/summary>/);
  assert.match(html, /<summary data-i18n="platform\.menu\.account">Konto<\/summary>/);
  assert.equal((html.match(/class="app-menu-group/g) || []).length, 4);
  assert.doesNotMatch(html, /<a class="utility public-information-link" href="\/">Startseite<\/a>/);
  assert.match(source, /group\.open = Boolean\(group\.querySelector\("a\.active"\)\)/);
  assert.match(css, /body\.public-information-anonymous #mainMenu \.app-menu-group-private/);
  assert.doesNotMatch(css, /body\.public-help-page #mainMenu \.app-menu-group-private/);
  assert.doesNotMatch(css, /body\.public-help-page #mainMenu a:not\(\.public-information-link\)/);
  assert.match(css, /body:not\(\.public-information-anonymous\) #mainMenu a\[href="\/app\/auth\/"\]/);
});

test("platform uses the shared operator shell without claiming PWA delivery", () => {
  assert.match(html, /operator-shell\.css/);
  assert.doesNotMatch(html, /Plattform · PWA/);
  assert.match(html, /operator-surface/);
  assert.match(html, /data-route="dashboard"[^>]*>Übersicht/);
  assert.doesNotMatch(html, /data-route="builds">Betrieb/);
  assert.match(server, /\/app\/operator-shell\.css/);
});
