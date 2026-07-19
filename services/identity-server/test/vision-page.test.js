const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");

test("offers the GerNetiX vision as a dedicated platform page", () => {
  assert.match(html, /href="\/app\/vision\/" data-route="vision">Vision<\/a>/);
  assert.match(html, /id="visionView"/);
  assert.match(app, /vision: "visionView"/);
  assert.match(app, /label: "Vision", route: "\/app\/vision\/"/);
  assert.match(html, /data-open-route="\/app\/vision\/">Unsere Vision/);
});

test("states the vision without replacing engineering responsibility with AI", () => {
  const vision = html.slice(html.indexOf('<section id="visionView"'), html.indexOf('<section id="accountSetupView"'));
  assert.match(vision, /Verstehen\. Entwickeln\. Erschaffen\./);
  assert.match(vision, /Du bleibst der Architekt\./);
  assert.match(vision, /niemals das Denken und die Verantwortung/);
  assert.match(vision, /Technik als Gesamtsystem verstehen/);
  assert.match(vision, /Wer versteht, kann entwickeln\. Wer entwickelt, kann erschaffen\./);
});

test("uses the GerNetiX design tokens and responsive platform layout", () => {
  assert.match(css, /\.vision-card > span \{[\s\S]*color: var\(--accent\)/);
  assert.match(css, /\.vision-card p \{[\s\S]*color: var\(--muted\)/);
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*\.vision-learning-grid \{ grid-template-columns: 1fr; \}/);
});
