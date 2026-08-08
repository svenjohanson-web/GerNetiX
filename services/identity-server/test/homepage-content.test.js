const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");
const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(publicRoot, "landing.css"), "utf8");
const headerCss = fs.readFileSync(path.join(publicRoot, "public-header.css"), "utf8");
const client = fs.readFileSync(path.join(publicRoot, "landing.js"), "utf8");
const server = ["dev-server.js", path.join("dev", "server", "web-routes.js")]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"))
  .join("\n");

test("serves the GerNetiX homepage publicly before authentication", () => {
  assert.match(server, /path: "\/", handler: \(\{ res \}\) => serveStatic\(res, publicDir, "\/index\.html"\)/);
  assert.match(html, /href="\/app\/auth\/">Anmelden/);
  assert.doesNotMatch(html, /Jetzt starten/);
});

test("introduces learning and development as the two GerNetiX areas", () => {
  assert.match(html, /Technik verstehen und eigene Systeme entwickeln/);
  assert.match(html, /GerNetiX hat zwei Bereiche:[\s\S]*Wissensportal und Community begleiten dich auf beiden Wegen/);
  assert.match(html, /href="#learning-paths"[\s\S]*Zum Lernbereich/);
  assert.match(html, /href="#ide"[\s\S]*Zum Entwicklungsbereich/);
  assert.doesNotMatch(html, /direkt mit Projekten zum Nachbauen starten|Drei Bereiche/);
});

test("integrates motivation and the complete system scope into one closing story", () => {
  assert.match(html, /class="panel home-purpose"[\s\S]*Verstehen macht dich unabhängig/);
  assert.match(html, /class="panel home-purpose"[\s\S]*id="scope" class="home-scope"/);
  assert.match(html, /Ein zusammenhängendes System[\s\S]*Vom Embedded-Gerät bis zur Anwendung/);
  assert.match(html, /class="system-chain"[\s\S]*Embedded-System[\s\S]*Lokaler Server[\s\S]*Cloud &amp; Dienste[\s\S]*Anwendung/);
  assert.match(html, /Embedded Systems &amp; Elektronik/);
  assert.match(html, /Kommunikation &amp; Netzwerke/);
  assert.match(html, /Apps &amp; Benutzeroberflächen/);
  assert.match(html, /Backend &amp; Cloud/);
  assert.match(html, /Verteilte Systeme &amp; Systemarchitektur/);
  assert.match(html, /KI als Entwicklungswerkzeug/);
  assert.doesNotMatch(html, /id="platform-title"|Unsere Plattform|class="scope-uml"/);
});

test("uses the GerNetiX corporate design and responsive homepage grids", () => {
  assert.match(css, /--accent: #22d3ee/);
  assert.match(css, /body \{[\s\S]*padding-top: 78px;/);
  assert.match(headerCss, /\.site-header \{[\s\S]*position: fixed;[\s\S]*top: 0;[\s\S]*left: 16px;[\s\S]*right: 16px;/);
  assert.match(css, /\.panel \{[\s\S]*background: var\(--panel\)/);
  assert.match(css, /\.hero h1 \{ font-size: clamp\(26px, 3vw, 34px\); \}/);
  assert.match(css, /\.home-area-grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.shared-space-grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.system-chain \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*\.nexi-home-feature,[\s\S]*\.home-purpose-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.home-area-grid \{ grid-template-columns: 1fr; \}[\s\S]*\.shared-space-grid,[\s\S]*\.system-chain \{ grid-template-columns: 1fr; \}/);
});

test("gives learning and development equal, direct entry cards", () => {
  assert.match(html, /id="gernetix-overview"[\s\S]*Wo möchtest du beginnen/);
  assert.equal((html.match(/class="home-area-card /g) || []).length, 2);
  assert.match(html, /id="learning-paths" class="home-area-card learning"[\s\S]*id="ide" class="home-area-card development"/);
  assert.match(html, /Lernbereich[\s\S]*Verstehen, ausprobieren, weiterbauen/);
  assert.match(html, /Entwicklungsbereich[\s\S]*Eigene Systeme an einem Ort entwickeln/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Flearn%2F"[\s\S]*Lernbereich öffnen/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Fdevelopment-platform%2F"[\s\S]*Entwicklungsbereich öffnen/);
  assert.doesNotMatch(html, /home-area-card nexi|Für Fortgeschrittene/);
});

test("shows the knowledge portal and community as shared companions", () => {
  assert.match(html, /id="shared-spaces"[\s\S]*Für beide Bereiche/);
  assert.match(html, /Wissensportal und Community sind keine weiteren Wege[\s\S]*beim Lernen genauso wie beim Entwickeln/);
  assert.match(html, /class="shared-space-card" href="\/wissen\/"[\s\S]*Wissensportal/);
  assert.match(html, /class="shared-space-card" href="\/community\/"[\s\S]*Community/);
  assert.equal((html.match(/class="shared-space-card"/g) || []).length, 2);
  assert.ok(html.indexOf('id="ide"') < html.indexOf('id="shared-spaces"'));
  assert.ok(html.indexOf('id="shared-spaces"') < html.indexOf('id="nexi"'));
});

test("keeps the GerNetiX motivation concise and connected to both areas", () => {
  assert.match(html, /Warum GerNetiX\?[\s\S]*Verstehen macht dich unabhängig/);
  assert.match(html, /Deshalb gehören Lernen und Entwickeln bei GerNetiX zusammen/);
  assert.match(html, /Unterschiedliche Lernwege[\s\S]*Technik mit Verantwortung/);
  assert.match(html, /KI kann erklären und unterstützen/);
  assert.doesNotMatch(html, /Wie GerNetiX entstanden ist|class="motivation-origin"/);
  assert.match(css, /\.home-purpose-layout \{ display: grid; grid-template-columns:/);
});

test("keeps Nexi as a concrete example instead of a third platform area", () => {
  assert.match(html, /Ein Beispiel, beide Bereiche/);
  assert.match(html, /Mit Nexi erst verstehen – und dann selbst weiterentwickeln/);
  assert.match(html, /Nachbauen und ausprobieren[\s\S]*Im Lernbereich verstehen[\s\S]*Im Entwicklungsbereich erweitern/);
  assert.match(html, /href="\/nachbauprojekte\/nexi-sprachassistent\/"[\s\S]*Nexi nachbauen/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Fnexi%2F"[\s\S]*Nexi persönlich einrichten/);
  assert.match(css, /\.nexi-home-options \{ display: grid;[\s\S]*border-left: 1px solid/);
  assert.match(css, /\.nexi-home-options li \{ display: grid;/);
  assert.ok(html.indexOf('id="nexi"') < html.indexOf('id="motivation"'));
});

test("does not single out the UML learning project on the homepage", () => {
  assert.doesNotMatch(html, /Neues Lernprojekt · Modellierung/);
  assert.doesNotMatch(html, /catalog%3Duml-fundamentals/);
});

test("offers a hamburger menu with the public webshop entry only", () => {
  const menu = html.slice(html.indexOf('id="publicMenu"'), html.indexOf("</nav>", html.indexOf('id="publicMenu"')));
  assert.match(html, /id="publicMenuButton"[\s\S]*aria-expanded="false"/);
  assert.match(menu, /href="\/">Startseite/);
  assert.match(menu, /href="\/nachbauprojekte\/nexi-sprachassistent\/">Nexi/);
  assert.match(menu, /href="\/hilfe\/">Hilfe/);
  assert.doesNotMatch(menu, /href="\/entdecken\/"|GerNetiX entdecken/);
  assert.match(menu, /href="\/nachbauprojekte\/">Projekte zum Nachbauen/);
  assert.match(menu, /href="\/flashbox-einrichten\/">FlashBox einrichten/);
  assert.match(menu, /href="\/shop\/">Webshop/);
  assert.match(menu, /href="\/app\/auth\/">Anmelden/);
  assert.doesNotMatch(menu, /Dashboard|Geräte|Billing|Entwicklungsplattform/);
  assert.match(headerCss, /\.site-menu \{[\s\S]*position: absolute/);
  assert.match(client, /aria-expanded/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(html, /class="site-footer-links"[\s\S]*Warum GerNetiX\?[\s\S]*Wissensportal[\s\S]*Hilfe/);
  assert.doesNotMatch(html.match(/class="site-footer-links"[\s\S]*/)?.[0] || "", /href="\/app\/vision\/"/);
});
