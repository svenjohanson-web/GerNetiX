const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const helpContent = fs.readFileSync(path.join(appRoot, "help-content.js"), "utf8");
const helpView = fs.readFileSync(path.join(appRoot, "help-view.js"), "utf8");
const helpChatService = fs.readFileSync(path.join(appRoot, "help-chat-service.js"), "utf8");

test("keeps Help reachable through the main menu and renders it as a dedicated view", () => {
  assert.match(html, /href="\/app\/help\/" data-route="help">Hilfe<\/a>/);
  assert.match(html, /id="helpView"/);
  assert.match(html, /id="helpMount"/);
  assert.match(app, /help: "helpView"/);
  assert.match(app, /label: "Hilfe", route: "\/app\/help\/"/);
  assert.match(app, /function renderHelpTopic\(\)/);
  assert.match(app, /HelpView\.render\(\{/);
  assert.match(css, /\.help-layout \{/);
  assert.match(css, /\.help-topic-navigation \{/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("keeps help content, navigation and assistant integration independently extensible", () => {
  assert.match(html, /id="helpMount"/);
  assert.match(html, /help-content\.js/);
  assert.match(html, /help-chat-service\.js/);
  assert.match(html, /help-view\.js/);
  assert.match(helpContent, /const topics = \[/);
  assert.match(helpContent, /"provision-new-board"[\s\S]*Neues Board in Betrieb nehmen/);
  assert.match(helpContent, /"usb-wifi-setup"/);
  assert.match(helpContent, /SSID und Passwort/);
  assert.match(helpContent, /Captive Portal/);
  assert.match(helpContent, /Öffentliche Informationen[\s\S]*Mit GerNetiX-Konto[\s\S]*Premium-Abo/);
  assert.match(helpContent, /"quick-start"[\s\S]*"supported-devices"/);
  assert.match(helpContent, /"update-profiles"[\s\S]*Wann wählt man was\?/);
  assert.match(helpView, /help-article-table/);
  assert.match(helpView, /function openDialog\(topicId\)/);
  assert.match(helpView, /help-topic-dialog-close/);
  assert.match(helpView, /Ask GerNetiX Help/);
  assert.match(helpView, /data-help-topic/);
  assert.match(helpView, /relatedTopics/);
  assert.match(helpChatService, /help-assistant\/chat/);
  assert.match(helpChatService, /relatedTopics/);
  assert.match(css, /\.help-chat \{/);
  assert.match(css, /\.help-topic-group \{/);
  assert.match(helpContent, /"ai-premium"/);
  assert.match(helpContent, /externe KI-Anbieter/);
  assert.match(helpView, /KI-Unterstuetzung ist im Premium-Abo enthalten/);
  assert.match(helpView, /access\.premium/);
});

test("shows compatible hardware from the catalog and explains USB provisioning limits", () => {
  assert.match(helpContent, /"compatible-hardware"/);
  assert.match(helpContent, /iPhone und iPad/);
  assert.match(helpContent, /Android ist für kabelgebundenes Web Serial kein verlässlicher Provisionierungsweg/);
  assert.match(helpContent, /GerNetiX-Webshop[\s\S]*geeigneten Basissoftware/);
  assert.match(helpView, /api\/platform\/hardware\/processor-boards/);
  assert.match(helpView, /function renderHardwareCard/);
  assert.match(helpView, /compatibleHardwareCatalog/);
  assert.match(css, /\.help-hardware-card/);
});

test("separates public, account and premium help with an in-article paywall", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");
  const publicHelp = fs.readFileSync(path.join(__dirname, "..", "public", "help", "index.html"), "utf8");
  assert.match(helpContent, /const articleAccess =/);
  assert.match(helpContent, /"first-project": "premium"/);
  assert.match(helpContent, /"register-device": "account"/);
  assert.match(helpView, /function renderPaywall/);
  assert.match(helpView, /Premium-Inhalt/);
  assert.match(helpView, /help-access-badge/);
  assert.match(css, /\.help-paywall/);
  assert.match(server, /url\.pathname === "\/hilfe"/);
  assert.match(publicHelp, /Öffentlich[\s\S]*Mit Konto[\s\S]*Premium/);
});
