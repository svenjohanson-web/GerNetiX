const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");
const httpApp = fs.readFileSync(path.join(__dirname, "..", "src", "http-app.js"), "utf8");
const shell = fs.readFileSync(path.join(__dirname, "..", "..", "shared", "public", "operator-shell.css"), "utf8");
const appStyles = fs.readFileSync(path.join(__dirname, "..", "public", "app.css"), "utf8");

test("admin uses the shared private operator shell without changing server authorization", () => {
  assert.match(html, /operator-shell\.css/);
  assert.match(html, /Private Administration/);
  assert.match(html, />Übersicht<\/button>/);
  assert.match(html, />Sicherheit<\/button>/);
  assert.match(html, />Bewertungen<\/button>/);
  assert.match(html, /id="learningFeedbackView"/);
  assert.match(client, /\/api\/admin\/learning-feedback\?purpose=feedback_review/);
  assert.match(client, /Verständlichkeit/);
  assert.match(html, /Auswertung je Lernprojekt/);
  assert.match(html, /id="learningFeedbackSummaryRows"/);
  assert.match(client, /item\.learning_project_id/);
  assert.match(client, /function ratingDistribution/);
  assert.match(client, /classList\.toggle\("is-active", active\)/);
  assert.match(httpApp, /\/admin\/operator-shell\.css/);
  assert.match(shell, /Gemeinsame visuelle Sprache/);
  assert.match(shell, /operator-surface-badge/);
});

test("admin cards, forms, status boxes and diagrams use the dark operator palette", () => {
  assert.match(appStyles, /color-scheme:\s*dark/);
  assert.match(appStyles, /--panel:\s*#111827/);
  assert.match(appStyles, /--panel-soft:\s*#1b2430/);
  assert.match(appStyles, /\.action-incident-card[^}]+background:\s*var\(--panel-soft\)/s);
  assert.match(appStyles, /\.action-alert-card[^}]+background:\s*var\(--panel-soft\)/s);
  assert.match(appStyles, /\.action-timeline li[^}]+background:\s*var\(--panel-soft\)/s);
  assert.match(appStyles, /\.uml-class rect[^}]+fill:\s*#111827/s);
  assert.doesNotMatch(appStyles, /background:\s*(?:#fff(?:fff)?|#f8fafc|#fef2f2|#fffbeb|#eff6ff|#ecfdf5|#e2e8f0)\b/i);
});
