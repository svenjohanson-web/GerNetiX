const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");
const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(publicRoot, "landing.css"), "utf8");
const client = fs.readFileSync(path.join(publicRoot, "landing.js"), "utf8");
const server = ["dev-server.js", path.join("dev", "server", "web-routes.js")]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"))
  .join("\n");

test("serves the GerNetiX homepage publicly before authentication", () => {
  assert.match(server, /path: "\/", handler: \(\{ res \}\) => serveStatic\(res, publicDir, "\/index\.html"\)/);
  assert.match(html, /href="\/app\/auth\/">Anmelden/);
  assert.doesNotMatch(html, /Jetzt starten/);
});

test("presents the four requested homepage text boxes", () => {
  assert.match(html, /Technik verstehen, eigene Systeme entwickeln oder direkt mit Projekten zum Nachbauen starten/);
  assert.match(html, /verständliches Lernen, eine gemeinsame Entwicklungsumgebung/);
  assert.doesNotMatch(html, /Die KI ist ein Werkzeug/);
  assert.match(html, /Verstehen\. Entwickeln\. Erschaffen\./);
  assert.match(html, /Unsere Motivation[\s\S]*Warum GerNetiX\?/);
  assert.match(html, /Der komplette Scope[\s\S]*Vom Embedded-System bis zur Cloud/);
  assert.match(html, /Unsere Plattform[\s\S]*Wissen und Infrastruktur aus einer Hand/);
  assert.doesNotMatch(html, /hero-system-graphic|hero-process-step|VOM PROBLEM ZUR LÖSUNG/);
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
  assert.match(css, /body \{[\s\S]*padding-top: 78px;/);
  assert.match(css, /\.site-header \{[\s\S]*position: fixed;[\s\S]*top: 0;[\s\S]*left: 16px;[\s\S]*right: 16px;/);
  assert.match(css, /\.panel \{[\s\S]*background: var\(--panel\)/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.scope-list \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.hero h1 \{ font-size: clamp\(26px, 3vw, 34px\); \}/);
  assert.doesNotMatch(css, /\.hero-system-graphic|\.hero-process-step|\.hero-process-line/);
  assert.match(css, /\.scope-uml \{/);
  assert.match(css, /\.hero \{ grid-template-columns: 1fr;/);
});

test("presents learning, IDE and Nexi as parallel GerNetiX entry areas", () => {
  assert.match(html, /id="gernetix-overview"[\s\S]*Was möchtest du mit GerNetiX machen/);
  assert.match(html, /class="home-area-card learning" href="#learning-paths"[\s\S]*class="home-area-card ide" href="#ide"[\s\S]*class="home-area-card nexi" href="#nexi"/);
  assert.match(html, /Technik verstehen[\s\S]*Systeme entwickeln[\s\S]*Nexi starten/);
  assert.doesNotMatch(html, /home-section-nav|home-area-switcher|Drei Bereiche|keine feste Reihenfolge/);
  assert.ok(html.indexOf('id="gernetix-overview"') < html.indexOf('id="nexi"'));
  assert.ok(html.indexOf('id="gernetix-overview"') < html.indexOf('id="learning-paths"'));
  assert.ok(html.indexOf('id="gernetix-overview"') < html.indexOf('id="ide"'));
  assert.match(css, /\.home-area-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(css, /\.home-section-nav|\.home-area-switcher/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.home-area-grid \{ grid-template-columns: 1fr; \}/);
});

test("connects the public motivation with the engineering-thinking chapter", () => {
  assert.match(html, /Wie GerNetiX entstanden ist/);
  assert.match(html, /KI macht dieses Wissen heute leichter zugänglich/);
  assert.match(html, /Menschen lernen unterschiedlich/);
  assert.doesNotMatch(html, /Ingenieursmäßiges Denken kennenlernen/);
  assert.match(css, /\.motivation-origin \{/);
});

test("offers reading, practice and personal guidance as equally valid learning paths", () => {
  assert.match(html, /Lernen, wie es zu dir passt/);
  assert.match(html, /Lies Wissen nach, sammle praktische Erfahrung/);
  assert.doesNotMatch(html, /Drei Wege, ein Ziel/);
  assert.match(html, /href="\/wissen\/" class="learning-path-card"/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Flearn%2F" class="learning-path-card"/);
  assert.match(html, /href="\/community\/" class="learning-path-card"/);
  assert.match(css, /\.learning-path-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
});

test("presents Nexi as a first-class configurable product before the learning paths", () => {
  assert.match(html, /Nexi · konfigurierbarer Sprachassistent/);
  assert.match(html, /Baue deinen eigenen Sprachassistenten – und richte ihn passend für deine Familie ein/);
  assert.match(html, /Ohne Konto[\s\S]*Nachbauen und lokal nutzen[\s\S]*Kostenloses Konto[\s\S]*Persönlich konfigurieren[\s\S]*Bei Bedarf[\s\S]*Erweiterungen bewusst wählen/);
  assert.match(html, /kostenlose Online-Basisfunktionen/);
  assert.match(html, /href="\/nachbauprojekte\/nexi-sprachassistent\/">Ohne Konto nachbauen/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Fnexi%2F">Mit kostenlosem Konto einrichten/);
  assert.match(html, /Unabhängig davon kannst du/);
  assert.match(html, /Nexi im Produkt Lernen verstehen/);
  assert.match(html, /eigene Ideen in der Entwicklungsplattform umsetzen/);
  assert.doesNotMatch(html, /Bereits eingerichtet|Nexi öffentlich nachbauen/);
  assert.doesNotMatch(html, /nexi-home-capabilities/);
  assert.match(css, /\.nexi-home-options \{ display: grid;[\s\S]*border-left: 1px solid/);
  assert.match(css, /\.nexi-home-options article \{[\s\S]*border: 0;[\s\S]*background: transparent;/);
  assert.match(css, /\.nexi-home-options article \+ article \{ border-top:/);
  assert.doesNotMatch(html, /nexi-home-path|nexi-home-step/);
  assert.doesNotMatch(css, /\.nexi-home-path|\.nexi-home-step/);
  assert.ok(html.indexOf('class="panel nexi-home-feature"') < html.indexOf('class="panel learning-paths"'));
  assert.match(css, /\.nexi-home-feature \{ display: grid; grid-template-columns:/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.nexi-home-feature \{ grid-template-columns: 1fr; \}/);
});

test("does not single out the UML learning project on the homepage", () => {
  assert.doesNotMatch(html, /Neues Lernprojekt · Modellierung/);
  assert.doesNotMatch(html, /catalog%3Duml-fundamentals/);
});

test("invites experienced developers into the full-system IDE", () => {
  assert.match(html, /Für Fortgeschrittene/);
  assert.match(html, /Dein gesamtes System in einer IDE/);
  assert.match(html, /vom Mikrocontroller bis zum Backend alles erstellen/);
  assert.match(html, /href="\/app\/auth\/\?next=%2Fapp%2Fdevelopment-platform%2F"[^>]*>GerNetiX IDE besuchen/);
  assert.match(html, /Für Fortgeschrittene[\s\S]*Unsere Motivation[\s\S]*Warum GerNetiX\?/);
  assert.match(css, /\.ide-invitation \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.ide-invitation \{ display: grid; grid-template-columns: 1fr; \}/);
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
  assert.match(css, /\.site-menu \{[\s\S]*position: absolute/);
  assert.match(client, /aria-expanded/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(html, /class="site-footer-links"[\s\S]*Warum GerNetiX\?[\s\S]*Wissensportal[\s\S]*Hilfe/);
  assert.doesNotMatch(html.match(/class="site-footer-links"[\s\S]*/)?.[0] || "", /href="\/app\/vision\/"/);
});
