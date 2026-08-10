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
  assert.match(html, /id="publicLoginLink" class="header-login-link" href="\/app\/auth\/"[\s\S]*Anmelden/);
  assert.match(css, /\.header-login-link, \.menu-button, \.public-language-switcher, \.public-theme-toggle \{[\s\S]*background: linear-gradient\(180deg, #f0ece5 0%, #e6ded2 100%\);[\s\S]*box-shadow:/);
  assert.match(client, /publicLoginLink\.href = "\/app\/dashboard\/";[\s\S]*publicLoginLink\.textContent = "Zum Dashboard";/);
  assert.doesNotMatch(html, /Jetzt starten/);
});

test("puts engineering thinking, freedom and manageable complexity at the top of the homepage", () => {
  assert.match(html, /Ingenieurdenken lernen\. Technik frei gestalten/);
  assert.match(html, /nimmt dir Komplexität nicht einfach weg[\s\S]*nachvollziehbaren Schritten[\s\S]*eigene Hardware einbindest[\s\S]*verteilte Systeme frei gestalten/);
});

test("does not interrupt the opening with a disconnected area choice", () => {
  assert.doesNotMatch(html, /Wo möchtest du beginnen|id="gernetix-overview"|class="home-area-card/);
  assert.doesNotMatch(html, /href="#learning-paths"|href="#ide"/);
});

test("places motivation and the complete system scope directly below the hero", () => {
  assert.match(html, /class="panel home-purpose"[\s\S]*Verstehen macht dich unabhängig/);
  assert.match(html, /class="panel home-purpose"[\s\S]*id="scope" class="home-scope"/);
  assert.match(html, /Ein zusammenhängendes System[\s\S]*Vom Embedded-Gerät bis zur Anwendung/);
  assert.match(html, /class="system-flow-visual"[\s\S]*src="\/images\/gernetix-system-flow\.png"[\s\S]*alt="[^"]*Embedded-Elektronik[^"]*lokalen Server[^"]*Cloud-Dienste[^"]*Anwendung/);
  assert.ok(fs.existsSync(path.join(publicRoot, "images", "gernetix-system-flow.png")));
  assert.doesNotMatch(html, /class="system-chain"|<svg[^>]*class="system-flow-visual"/);
  assert.match(html, /Embedded Systems &amp; Elektronik/);
  assert.match(html, /Kommunikation &amp; Netzwerke/);
  assert.match(html, /Apps &amp; Benutzeroberflächen/);
  assert.match(html, /Backend &amp; Cloud/);
  assert.match(html, /Verteilte Systeme &amp; Systemarchitektur/);
  assert.match(html, /KI als Entwicklungswerkzeug/);
  assert.doesNotMatch(html, /id="platform-title"|Unsere Plattform|class="scope-uml"/);
  assert.ok(html.indexOf('id="hero-title"') < html.indexOf('id="motivation"'));
  assert.ok(html.indexOf('id="motivation"') < html.indexOf('id="shared-spaces"'));
});

test("uses the GerNetiX corporate design and responsive homepage grids", () => {
  assert.match(css, /--accent: #22d3ee/);
  assert.match(css, /body \{[\s\S]*padding-top: 78px;/);
  assert.match(headerCss, /\.site-header \{[\s\S]*position: fixed;[\s\S]*top: 0;[\s\S]*left: 16px;[\s\S]*right: 16px;/);
  assert.match(css, /\.panel \{[\s\S]*background: var\(--panel\)/);
  assert.match(css, /\.hero h1 \{ font-size: clamp\(26px, 3vw, 34px\); \}/);
  assert.match(css, /\.home-area-grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.shared-spaces \{ grid-template-columns: minmax\(190px, \.55fr\) minmax\(0, 1\.45fr\);[\s\S]*padding: 30px 0;/);
  assert.match(css, /\.shared-space-links \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.system-flow-visual \{[\s\S]*overflow: hidden;[\s\S]*border: 1px solid/);
  assert.match(css, /\.system-flow-visual img \{ display: block; width: 100%; height: auto; \}/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*\.nexi-home-feature,[\s\S]*\.home-purpose-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.shared-spaces \{ grid-template-columns: 1fr;[\s\S]*\.shared-space-links \{ grid-template-columns: 1fr; \}/);
});

test("shows the knowledge portal and community as shared companions", () => {
  assert.match(html, /id="shared-spaces"[\s\S]*Wissen und Austausch/);
  assert.match(html, /class="shared-space-link" href="\/wissen\/"[\s\S]*Wissensportal/);
  assert.match(html, /class="shared-space-link" href="\/community\/"[\s\S]*Community/);
  assert.equal((html.match(/class="shared-space-link"/g) || []).length, 2);
  assert.doesNotMatch(html, /Für beide Bereiche|keine weiteren Wege|shared-space-contexts|Wissensportal öffnen|Community öffnen/);
  assert.ok(html.indexOf('id="motivation"') < html.indexOf('id="shared-spaces"'));
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
  assert.match(html, /class="project-example-label"[\s\S]*Beispiel aus den Nachbauprojekten/);
  assert.match(html, /id="nexi-home-title"[\s\S]*Nexi: Sprachassistent zum Nachbauen/);
  assert.match(html, /Nachbauen und ausprobieren[\s\S]*Im Lernbereich verstehen[\s\S]*Im Entwicklungsbereich erweitern/);
  assert.match(html, /href="\/nachbauprojekte\/nexi-sprachassistent\/"[\s\S]*Nexi ansehen/);
  assert.match(html, /href="\/nachbauprojekte\/"[\s\S]*Alle Nachbauprojekte/);
  assert.doesNotMatch(html, /Nexi persönlich einrichten/);
  assert.match(css, /\.nexi-home-copy #nexi-home-title \{[\s\S]*font-size: clamp\(21px, 2\.3vw, 27px\);/);
  assert.match(css, /\.nexi-home-options \{ display: grid;[\s\S]*border-left: 1px solid/);
  assert.match(css, /\.nexi-home-options li \{ display: grid;/);
  assert.ok(html.indexOf('id="motivation"') < html.indexOf('id="nexi"'));
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
