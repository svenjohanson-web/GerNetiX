const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const source = readPlatformAppSource();
const server = ["dev-server.js", path.join("dev", "server", "web-routes.js")]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"))
  .join("\n");

test("main menu uses the shared dark typography and states", () => {
  assert.match(css, /\.app-menu\s*\{[\s\S]*?background: #111827/);
  assert.match(css, /\.app-menu a,[\s\S]*?font-family: inherit;[\s\S]*?font-size: 15px/);
  assert.match(css, /\.app-menu a\.active[\s\S]*?background: #164e63/);
  assert.match(css, /\.app-menu \.menu-logout[\s\S]*?color: #fca5a5/);
});

test("groups the main destinations under clear user-facing headings", () => {
  assert.match(html, /data-route="dashboard"[^>]*>Übersicht/);
  assert.match(html, /<summary data-i18n="platform\.menu\.learn_develop">Lernen &amp; Entwickeln<\/summary>/);
  assert.match(html, /<summary data-i18n="platform\.menu\.boards_tools">Boards &amp; Werkzeuge<\/summary>/);
  assert.match(html, /id="hardwareLabMenuLink"[^>]*href="http:\/\/127\.0\.0\.1:5100\/"[^>]*>KI-Hardware-Labor<\/a>/);
  assert.match(html, /<summary data-i18n="platform\.menu\.service_shop">Service &amp; Shop<\/summary>/);
  assert.match(html, /<summary data-i18n="platform\.menu\.account">Konto<\/summary>/);
  assert.equal((html.match(/class="app-menu-group/g) || []).length, 4);
  assert.doesNotMatch(html, /<a class="utility public-information-link" href="\/">Startseite<\/a>/);
  assert.match(source, /group\.open = Boolean\(group\.querySelector\("a\.active"\)\)/);
  assert.match(css, /body\.public-information-anonymous #mainMenu \.app-menu-group-private/);
  assert.doesNotMatch(css, /body\.public-help-page #mainMenu \.app-menu-group-private/);
  assert.doesNotMatch(css, /body\.public-help-page #mainMenu a:not\(\.public-information-link\)/);
  assert.match(css, /body:not\(\.public-information-anonymous\) #mainMenu #loginMenuLink/);
});

test("puts learning, development, quiz, knowledge, community and rebuild projects in one group", () => {
  const menu = html.slice(html.indexOf('<nav id="mainMenu"'), html.indexOf("</nav>", html.indexOf('<nav id="mainMenu"')));
  const groupStart = menu.indexOf('platform.menu.learn_develop');
  const groupEnd = menu.indexOf("</details>", groupStart);
  const group = menu.slice(groupStart, groupEnd);
  const destinations = [
    "/app/learn/",
    "/app/development-platform/",
    "/app/quiz/",
    "/wissen/",
    "/app/community/",
    "/nachbauprojekte/",
  ];
  destinations.forEach((destination) => assert.match(group, new RegExp(`href="${destination.replaceAll("/", "\\/")}"`)));
  assert.match(group, /Wissensspeicher/);
  const toolsStart = menu.indexOf('platform.menu.boards_tools');
  const toolsEnd = menu.indexOf("</details>", toolsStart);
  assert.doesNotMatch(menu.slice(toolsStart, toolsEnd), /href="\/app\/quiz\/"/);
});

test("keeps Help, Messages and the session action permanently outside collapsible hamburger groups", () => {
  const menu = html.slice(html.indexOf('<nav id="mainMenu"'), html.indexOf("</nav>", html.indexOf('<nav id="mainMenu"')));
  const accountGroupEnd = menu.indexOf("</details>", menu.indexOf('platform.menu.account'));
  const helpIndex = menu.indexOf('id="helpMenuLink"');
  const messagesIndex = menu.indexOf('id="messagesMenuLink"');
  const loginIndex = menu.indexOf('id="loginMenuLink"');
  const logoutIndex = menu.indexOf('id="logoutButton"');
  assert.ok(helpIndex > accountGroupEnd);
  assert.ok(helpIndex < messagesIndex);
  assert.ok(messagesIndex < loginIndex);
  assert.ok(loginIndex > accountGroupEnd);
  assert.ok(logoutIndex > accountGroupEnd);
  assert.equal((menu.match(/href="\/hilfe\/"/g) || []).length, 1);
  assert.match(menu, /id="helpMenuLink" class="utility public-information-link menu-fixed-action"/);
  assert.match(menu, /id="messagesMenuLink" class="utility menu-fixed-action"/);
  assert.match(css, /\.app-menu \.menu-fixed-action/);
  assert.match(menu, /menu-session-action/);
  assert.match(css, /\.app-menu \.menu-session-action/);
});

test("platform uses the shared operator shell without claiming PWA delivery", () => {
  assert.match(html, /operator-shell\.css/);
  assert.doesNotMatch(html, /Plattform · PWA/);
  assert.match(html, /operator-surface/);
  assert.match(html, /data-route="dashboard"[^>]*>Übersicht/);
  assert.doesNotMatch(html, /data-route="builds">Betrieb/);
  assert.match(server, /\/app\/operator-shell\.css/);
});
