const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");
const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(publicRoot, "landing.css"), "utf8");
const client = fs.readFileSync(path.join(publicRoot, "landing.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("serves the GerNetiX homepage publicly before authentication", () => {
  assert.match(server, /url\.pathname === "\/"[\s\S]*serveStatic\(res, publicDir, "\/index\.html"\)/);
  assert.doesNotMatch(server, /url\.pathname === "\/"[\s\S]*redirect\(res, "\/app\/auth\/"\)/);
  assert.match(html, /href="\/app\/auth\/">Anmelden/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Fdashboard%2F">Jetzt starten/);
});

test("presents the four requested homepage text boxes", () => {
  assert.match(html, /Verstehe komplexe technische Systeme – vom Embedded-System bis zur Cloud\./);
  assert.match(html, /für alle, die mehr wollen, als nur fertige Lösungen nachzubauen/);
  assert.match(html, /sondern vor allem, <strong>warum<\/strong> sie funktionieren/);
  assert.match(html, /Die KI ist ein Werkzeug – sie unterstützt dich, übernimmt aber weder Denken noch Verantwortung\./);
  assert.match(html, /Verstehen\. Entwickeln\. Erschaffen\./);
  assert.match(html, /Unsere Motivation[\s\S]*Warum GerNetiX\?/);
  assert.match(html, /Der komplette Scope[\s\S]*Vom Embedded-System bis zur Cloud/);
  assert.match(html, /Unsere Plattform[\s\S]*Wissen und Infrastruktur aus einer Hand/);
});

test("shows the complete system scope and preserves user choice", () => {
  assert.match(html, /Embedded Systems &amp; Elektronik/);
  assert.match(html, /Kommunikation &amp; Netzwerke/);
  assert.match(html, /Apps &amp; Benutzeroberflächen/);
  assert.match(html, /Backend &amp; Cloud/);
  assert.match(html, /Verteilte Systeme &amp; Systemarchitektur/);
  assert.match(html, /KI als Entwicklungswerkzeug/);
  assert.match(html, /Open Source nutzen, kommerzielle Produkte einsetzen oder beides kombinieren/);
});

test("uses the GerNetiX corporate design and collapses the scope on mobile", () => {
  assert.match(css, /--accent: #22d3ee/);
  assert.match(css, /\.panel \{[\s\S]*background: var\(--panel\)/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.scope-list \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.hero h1 \{ font-size: clamp\(30px, 4\.2vw, 52px\); \}/);
});

test("offers a hamburger menu containing public information only", () => {
  const menu = html.slice(html.indexOf('id="publicMenu"'), html.indexOf("</nav>", html.indexOf('id="publicMenu"')));
  assert.match(html, /id="publicMenuButton"[\s\S]*aria-expanded="false"/);
  assert.match(menu, /href="\/">Startseite/);
  assert.match(menu, /href="#motivation">Warum GerNetiX\?/);
  assert.match(menu, /href="#scope">Themen/);
  assert.match(menu, /href="\/hilfe\/">Hilfe/);
  assert.match(menu, /href="\/app\/auth\/">Anmelden/);
  assert.doesNotMatch(menu, /Dashboard|Geräte|Billing|Entwicklungsplattform/);
  assert.match(css, /\.site-menu \{[\s\S]*position: absolute/);
  assert.match(client, /aria-expanded/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(html, /class="site-footer-links"[\s\S]*Vision[\s\S]*Über uns[\s\S]*Hilfe/);
});
