const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("admin UI provides a prioritized AI clarification workflow", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

  assert.match(html, /data-admin-sub-view="ai-clarifications"/);
  assert.match(html, /id="aiClarificationPriorityFilter"/);
  assert.match(html, /id="aiClarificationRows"/);
  assert.match(script, /action: row\.querySelector\("\.clarification-action-select"\)/);
  assert.match(script, /promote: true/);
  assert.match(script, /Prioritaet setzen/);
});

test("admin UI provides maintenance for local help knowledge", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

  assert.match(html, /data-admin-sub-view="ai-help-knowledge"/);
  assert.match(html, /id="aiHelpKnowledgeForm"/);
  assert.match(html, /nur an das lokale Ollama-Modell/);
  assert.match(script, /\/api\/admin\/ai-help-articles/);
  assert.match(script, /Help-Wissen wird gespeichert und lokal eingebettet/);
});

test("admin UI provides encrypted IONOS SMTP configuration", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

  assert.match(html, /data-admin-view="email-config"/);
  assert.match(html, /id="adminEmailPassword"/);
  assert.match(html, /verschluesselt im Identity-SQLite/);
  assert.match(script, /\/api\/admin\/email-config/);
});
