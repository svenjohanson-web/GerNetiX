const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const guide = fs.readFileSync(path.join(root, "welcome-guide.js"), "utf8");
const guideCss = fs.readFileSync(path.join(root, "welcome-guide.css"), "utf8");
const auth = fs.readFileSync(path.join(root, "auth", "auth.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "app-shell-controller.js"), "utf8");
const events = fs.readFileSync(path.join(root, "app-event-bindings.js"), "utf8");
const accountRoutes = fs.readFileSync(path.join(__dirname, "..", "src", "dev", "server", "account-routes.js"), "utf8");
const sqliteRepository = fs.readFileSync(path.join(__dirname, "..", "src", "repositories", "sqlite-backed-identity-repository.js"), "utf8");

test("presents the GerNetiX portfolio before explaining boards", () => {
  assert.match(html, /GerNetiX verbindet Wissen, praktische Projekte, Entwicklung und echte Hardware/);
  assert.match(html, /Nachbauprojekte/);
  assert.match(html, /Entwicklungsplattform &amp; Bot/);
  assert.match(html, /Wissensportal &amp; Bücher/);
  assert.match(html, /Lernprojekte/);
  assert.ok(html.indexOf("Nachbauprojekte") < html.indexOf("Warum Boards inventarisieren?"));
});

test("explains firmware transfer and inventory as one embedded workflow", () => {
  assert.match(html, /Vom Lernen zur laufenden Firmware/);
  assert.match(html, /Über das Netzwerk/);
  assert.match(html, /Direkt per Kabel/);
  assert.match(html, /Mit der FlashBox/);
  assert.match(html, /mehrere Boards im Netzwerk/);
  assert.match(html, /data-welcome-destination>Board inventarisieren/);
});

test("opens the guide after login and keeps it available from help", () => {
  assert.match(auth, /withWelcomeGuide\(result\.next \|\| "\/app\/dashboard\/"\)/);
  assert.match(auth, /url\.searchParams\.set\("welcome", "1"\)/);
  assert.match(shell, /GerNetiXWelcomeGuide\.maybeOpen\(state\.account\)/);
  assert.match(events, /#welcomeGuideMenuButton/);
  assert.match(html, /id="welcomeGuideMenuButton"/);
  assert.match(guide, /url\.searchParams\.delete\("welcome"\)/);
});

test("stores the do-not-show choice as an account preference", () => {
  assert.match(html, /id="welcomeGuideDisabled"/);
  assert.match(guide, /ApiClient\.patchJson\("\/api\/account\/preferences"/);
  assert.match(accountRoutes, /welcome_guide_disabled: Boolean\(session\.account\.welcome_guide_disabled\)/);
  assert.match(sqliteRepository, /welcome_guide_disabled INTEGER NOT NULL DEFAULT 0/);
});

test("keeps the guide compact and responsive", () => {
  assert.match(guideCss, /max-height: min\(820px, calc\(100vh - 32px\)\)/);
  assert.match(guideCss, /@media \(max-width: 720px\)/);
  assert.match(html, /aria-label="Schritte der Willkommensführung"/);
});
