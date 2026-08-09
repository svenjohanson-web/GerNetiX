"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
const html = read("public/app/index.html");
const app = read("public/app/app-shell-controller.js");
const card = read("public/app/project-repository-card.js");
const css = read("public/app/app.css");
const platform = read("public/app/development-platform.js");

test("development area contains the read-only Git repository card and all required views", () => {
  assert.match(html, /id="projectRepositoryCard"[^>]*aria-label="Git-Repository"/);
  assert.doesNotMatch(html, /<script[^>]+project-repository-card\.js/);
  assert.match(app, /loadPlatformScript\("\/app\/project-repository-card\.js\?v=20260803-forgejo-contract-v1"\)/);
  for (const label of ["Git-Repository", "Status", "Branch", "Head", "Dateibaum", "Datei", "Historie", "Commit-Diff"]) {
    assert.match(card, new RegExp(label));
  }
  assert.match(card, /read-only/);
  assert.match(card, /Binärdatei/);
  assert.match(card, /für die Browser-Vorschau zu groß/);
  assert.match(card, /Umbenannt/);
  assert.match(card, /Gelöscht/);
  assert.match(card, /Standkonflikt/);
  assert.match(platform, /repositoryCard\?\.render\(project\?\.isDraft \? null : project\)/);
  assert.match(platform, /projectOrigin: "transient_draft"/);
});

test("browser code uses only session-bound Identity routes and contains no Forgejo secrets or clone URLs", () => {
  assert.match(card, /\/api\/platform\/projects\/\$\{encodeURIComponent\(project\.id \|\| project\.project_server_id\)\}\/repository/);
  assert.doesNotMatch(card + html, /forgejo\.internal|clone_url|remote_url|runtime_token|admin_token|Authorization:/i);
});

test("repository card collapses to one column on mobile and two-column metadata on iPad-width layouts", () => {
  assert.match(css, /@media \(max-width: 1050px\)[\s\S]*\.project-repository-workspace \{ grid-template-columns: minmax\(180px, \.8fr\) minmax\(0, 2fr\); \}/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.project-repository-workspace \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.project-repository-header h2 \{ font-size: clamp\(18px, 2vw, 22px\); font-weight: 650; \}/);
});
