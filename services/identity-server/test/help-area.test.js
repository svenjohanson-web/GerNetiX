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
  assert.match(app, /HelpView\.render\(\)/);
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
  assert.match(helpContent, /Getting Started[\s\S]*Account and Registration[\s\S]*Troubleshooting/);
  assert.match(helpContent, /"quick-start"[\s\S]*"register-device"[\s\S]*"pair-device"[\s\S]*"supported-devices"/);
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
});
