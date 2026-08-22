const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { authenticatedGroup, authenticatedItem, navigationModel } = require("../test-support/navigation-model");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const source = readPlatformAppSource();
const server = ["dev-server.js", path.join("dev", "server", "web-routes.js")]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"))
  .join("\n");

test("main menu uses the shared dark typography and states", () => {
  assert.match(css, /\.app-menu\s*\{[\s\S]*?background: var\(--surface-panel\)/);
  assert.match(css, /\.app-menu a,[\s\S]*?font-family: inherit;[\s\S]*?font-size: 15px/);
  assert.match(css, /\.app-menu a\.active[\s\S]*?background: var\(--accent-soft\)/);
  assert.match(css, /\.app-menu \.menu-logout[\s\S]*?color: #fca5a5/);
});

test("groups the main destinations under clear user-facing headings", () => {
  assert.equal(authenticatedItem("/app/dashboard/").label, "Übersicht");
  assert.equal(authenticatedItem("/app/applications/").label, "Meine Anwendungen");
  assert.equal(authenticatedGroup("platform.menu.learn_develop").label, "Lernen & Entwickeln");
  assert.equal(authenticatedGroup("platform.menu.boards_tools").label, "Boards & Werkzeuge");
  assert.equal(authenticatedItem("hardwareLabMenuLink").route, "hardware-lab");
  assert.doesNotMatch(html, /127\.0\.0\.1:5100/);
  assert.equal(authenticatedGroup("platform.menu.service_shop").label, "Service & Shop");
  assert.equal(authenticatedGroup("platform.menu.account").label, "Konto");
  assert.equal(navigationModel.authenticated.groups.length, 4);
  assert.equal(authenticatedItem("/")?.href, undefined);
  assert.match(source, /group\.open = Boolean\(group\.querySelector\("a\.active"\)\)/);
  assert.match(css, /body\.public-information-anonymous #mainMenu \.app-menu-group-private/);
  assert.doesNotMatch(css, /body\.public-help-page #mainMenu \.app-menu-group-private/);
  assert.doesNotMatch(css, /body\.public-help-page #mainMenu a:not\(\.public-information-link\)/);
  assert.match(css, /body:not\(\.public-information-anonymous\) #mainMenu #loginMenuLink/);
});


test("puts learning, development, quiz, knowledge, community and rebuild projects in one group", () => {
  const group = authenticatedGroup("platform.menu.learn_develop");
  const destinations = [
    "/app/learn/",
    "/app/development-platform/",
    "/app/quiz/",
    "/wissen/",
    "/app/community/",
    "/nachbauprojekte/",
  ];
  assert.deepEqual(Array.from(group.items, (item) => item.href), [
    ...destinations.slice(0, 4),
    "/app/nachschlagewerke/",
    ...destinations.slice(4),
  ]);
  assert.equal(group.items.find((item) => item.href === "/wissen/").label, "Wissensspeicher");
  assert.equal(authenticatedGroup("platform.menu.boards_tools").items.some((item) => item.href === "/app/quiz/"), false);
});

test("keeps Help, Messages and the session action permanently outside collapsible hamburger groups", () => {
  const fixed = navigationModel.authenticated.fixed;
  assert.deepEqual(Array.from(fixed.filter((item) => !item.contexts || item.contexts.includes("app")), (item) => item.id), [
    "helpMenuLink", "welcomeGuideMenuButton", "messagesMenuLink", "loginMenuLink", "logoutButton",
  ]);
  assert.equal(fixed.filter((item) => item.href === "/hilfe/").length, 1);
  assert.equal(authenticatedItem("helpMenuLink").className, "utility public-information-link menu-fixed-action");
  assert.equal(authenticatedItem("messagesMenuLink").className, "utility menu-fixed-action");
  assert.match(css, /\.app-menu \.menu-fixed-action/);
  assert.match(authenticatedItem("loginMenuLink").className, /menu-session-action/);
  assert.match(css, /\.app-menu \.menu-session-action/);
});

test("platform uses the shared operator shell without claiming PWA delivery", () => {
  assert.match(html, /operator-shell\.css/);
  assert.doesNotMatch(html, /Plattform · PWA/);
  assert.match(html, /operator-surface/);
  assert.equal(authenticatedItem("/app/dashboard/").label, "Übersicht");
  assert.doesNotMatch(html, /data-route="builds">Betrieb/);
  assert.match(server, /\/app\/operator-shell\.css/);
});
