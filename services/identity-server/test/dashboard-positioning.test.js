const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");

test("keeps the authenticated dashboard focused on continuing work", () => {
  assert.match(html, /Verstehen\. Entwickeln\. Erschaffen\./);
  assert.match(html, /Willkommen bei GerNetiX/);
  assert.match(html, /Wähle deinen Arbeitsbereich/);
  assert.doesNotMatch(html, /id="dashboardView"[\s\S]*Unsere Motivation[\s\S]*id="visionView"/);
});

test("uses the existing GerNetiX design tokens for the dashboard", () => {
  assert.match(css, /\.dashboard-hero-intro \{[\s\S]*color: var\(--muted\)/);
  assert.doesNotMatch(css, /\.homepage-copy-box/);
});

test("groups dashboard destinations into scannable categories with at most three cards per row", () => {
  assert.match(html, /Entwickeln &amp; verwalten[\s\S]*\/app\/development-platform\/[\s\S]*\/app\/device-management\//);
  assert.match(html, /Lernen &amp; verstehen[\s\S]*\/app\/learn\/[\s\S]*\/wissen\/[\s\S]*\/app\/quiz\//);
  assert.doesNotMatch(html, /id="workspaceCommunityTitle"/);
  assert.match(css, /\.workspace-categories \{ display: grid; gap: 22px; \}/);
  assert.match(css, /\.workspace-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
});

test("places an extensible news category below the workspace categories", () => {
  assert.match(html, /class="workspace-categories"[\s\S]*id="dashboardNews"/);
  assert.match(html, /Was gibt es Neues\?/);
  assert.match(html, /Templates, Projekte, Nachbauprojekte, Hardware, Wissensinhalte und Beiträge aus der Community/);
  assert.match(html, /class="dashboard-news-community-link"[\s\S]*data-open-route="\/app\/community\/"/);
  assert.match(css, /\.dashboard-news-list \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
});

test("never serves the dashboard route without an authenticated session", () => {
  assert.match(server, /const dashboardRoute = url\.pathname === "\/app\/dashboard" \|\| url\.pathname\.startsWith\("\/app\/dashboard\/"\);/);
  assert.match(server, /if \(dashboardRoute\) \{[\s\S]*?if \(!await readSession\(req\)\) \{[\s\S]*?redirect\(res, authRoute\(url\.pathname \+ url\.search\)\);[\s\S]*?serveStatic\(res, appDir, "\/index\.html"\);/);
  assert.match(app, /const isServerAuthenticatedAppShell = \/\^\\\/app\\\/\(\?!auth/);
  assert.match(app, /const protectedAppRoute =/);
  assert.match(app, /if \(protectedAppRoute && !isServerAuthenticatedAppShell && !state\.account\) \{[\s\S]*?window\.location\.assign\(`\/app\/auth\/\?next=\$\{encodeURIComponent\(target\.pathname \+ target\.search\)\}`\)/);
});

test("does not mistake an early dashboard click for an anonymous session", () => {
  assert.match(app, /const isServerAuthenticatedAppShell = \/\^\\\/app\\\/\(\?!auth/);
  assert.match(app, /protectedAppRoute && !isServerAuthenticatedAppShell && !state\.account/);
});

test("sends standalone authentication routes to the login page instead of the dashboard view", () => {
  assert.match(app, /if \(\/\^\\\/app\\\/auth\(\?:\\\/\|\$\)\/\.test\(target\.pathname\)\) \{[\s\S]*?window\.location\.assign\(target\.pathname \+ target\.search \+ target\.hash\);[\s\S]*?return;/);
});
