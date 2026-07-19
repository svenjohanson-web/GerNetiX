const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");

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
