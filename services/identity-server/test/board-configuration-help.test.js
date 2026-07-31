const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const helpContent = fs.readFileSync(path.resolve(__dirname, "../public/app/help-content.js"), "utf8");

test("explains GerNetiX, account and project board configuration levels", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${helpContent};this.content = HelpContent;`, context);

  const topic = context.content.findTopic("board-configuration-levels");
  const article = context.content.articles[topic.articleId];
  const serialized = JSON.stringify(article);

  assert.equal(topic.title, "GerNetiX-, Account- und Projektboards");
  assert.equal(article.access, "account");
  assert.match(serialized, /GerNetiX-Systemboard/);
  assert.match(serialized, /Mein Board/);
  assert.match(serialized, /unveränderlichen Projektsnapshot/);
  assert.match(serialized, /verändert bestehende Projekte niemals automatisch/);
  assert.match(serialized, /neue Version deines Boards/);
  assert.match(serialized, /nur für dieses Projekt gelten/);
  assert.match(serialized, /physisch vorhandene Platine/);
  assert.ok(article.relatedTopics.includes("board-definition"));
  assert.ok(article.relatedTopics.includes("supported-devices"));
});
