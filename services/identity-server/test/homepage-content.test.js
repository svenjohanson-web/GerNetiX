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
  assert.doesNotMatch(html, /Jetzt starten/);
});

test("presents the four requested homepage text boxes", () => {
  assert.match(html, /von der Cloud bis zum Embedded-System/);
  assert.match(html, /für alle, die mehr wollen, als nur fertige Lösungen nachzubauen/);
  assert.match(html, /machen auch ihre Zusammenhänge verständlich/);
  assert.doesNotMatch(html, /Die KI ist ein Werkzeug/);
  assert.match(html, /Verstehen\. Entwickeln\. Erschaffen\./);
  assert.match(html, /Unsere Motivation[\s\S]*Warum GerNetiX\?/);
  assert.match(html, /Der komplette Scope[\s\S]*Vom Embedded-System bis zur Cloud/);
  assert.match(html, /Unsere Plattform[\s\S]*Wissen und Infrastruktur aus einer Hand/);
  assert.match(html, /class="hero-system-graphic"/);
  assert.match(html, /PROBLEM[\s\S]*KONZEPTE[\s\S]*BEWERTEN[\s\S]*ENTSCHEIDEN[\s\S]*REALISIEREN/);
  assert.match(html, /class="scope-uml"[\s\S]*«device»[\s\S]*«component»[\s\S]*«service»[\s\S]*«application»/);
  assert.doesNotMatch(html, /UML-KOMPONENTENÜBERSICHT|Die Bausteine sind keine Pflichtkette|>lokal<|>optional<|>nutzen</);
  assert.match(html, /scopeUmlArrow[\s\S]*fill="#67e8f9"[\s\S]*stroke="#67e8f9"/);
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
  assert.match(css, /\.hero h1 \{ font-size: clamp\(25px, 3\.1vw, 40px\); \}/);
  assert.match(css, /\.hero-system-graphic \{/);
  assert.match(css, /\.hero-process-step rect \{/);
  assert.match(css, /\.hero-process-line \{ fill: none; stroke: #67e8f9; stroke-width: 3;/);
  assert.match(css, /\.scope-uml \{/);
  assert.match(css, /\.hero \{ grid-template-columns: minmax\(0, 1\.1fr\) minmax\(300px, \.9fr\);/);
});

test("connects the public motivation with the engineering-thinking chapter", () => {
  assert.match(html, /Wie GerNetiX entstanden ist/);
  assert.match(html, /KI macht dieses Wissen heute leichter zugänglich/);
  assert.match(html, /Menschen lernen unterschiedlich/);
  assert.doesNotMatch(html, /Ingenieursmäßiges Denken kennenlernen/);
  assert.match(css, /\.motivation-origin \{/);
});

test("offers reading, practice and personal guidance as equally valid learning paths", () => {
  assert.match(html, /Drei Wege, ein Ziel/);
  assert.match(html, /Wähle den Zugang, der dir gerade hilft/);
  assert.match(html, /href="\/wissen\/" class="learning-path-card"/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Flearn%2F" class="learning-path-card"/);
  assert.match(html, /href="\/community\/" class="learning-path-card"/);
  assert.match(css, /\.learning-path-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
});

test("offers a hamburger menu with the public webshop entry only", () => {
  const menu = html.slice(html.indexOf('id="publicMenu"'), html.indexOf("</nav>", html.indexOf('id="publicMenu"')));
  assert.match(html, /id="publicMenuButton"[\s\S]*aria-expanded="false"/);
  assert.match(menu, /href="\/">Startseite/);
  assert.match(menu, /href="\/hilfe\/">Hilfe/);
  assert.match(menu, /href="\/entdecken\/">GerNetiX entdecken/);
  assert.match(menu, /href="\/flashbox-einrichten\/">USB Helper/);
  assert.match(menu, /href="\/nachbauprojekte\/">Nachbauprojekte/);
  assert.match(menu, /href="\/shop\/">Webshop/);
  assert.match(menu, /href="\/app\/auth\/">Anmelden/);
  assert.doesNotMatch(menu, /Dashboard|Geräte|Billing|Entwicklungsplattform/);
  assert.match(css, /\.site-menu \{[\s\S]*position: absolute/);
  assert.match(client, /aria-expanded/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(html, /class="site-footer-links"[\s\S]*Warum GerNetiX\?[\s\S]*Wissensportal[\s\S]*Hilfe/);
  assert.doesNotMatch(html.match(/class="site-footer-links"[\s\S]*/)?.[0] || "", /href="\/app\/vision\/"/);
});
