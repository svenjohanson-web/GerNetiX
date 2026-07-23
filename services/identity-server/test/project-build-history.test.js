const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("keeps build results inside the active project instead of a global operations page", () => {
  assert.doesNotMatch(html, /id="buildsView"/);
  assert.doesNotMatch(html, /data-route="builds">Betrieb/);
  assert.doesNotMatch(server, /builds: "\/app\/builds\/"/);
  assert.match(html, /id="ideBuildResultsPanel"[\s\S]*id="buildList"/);
  assert.match(app, /state\.builds\.filter\(\(build\) => build\.project_server_id === project\.id\)/);
});

test("offers persisted firmware artifacts as authenticated project downloads", () => {
  assert.match(app, /function renderBuildArtifacts\(build\)/);
  assert.match(app, /download_url/);
  assert.match(app, /SHA-256/);
  assert.match(server, /\/api\/firmware-artifacts\?project_id=/);
  assert.match(server, /job\.user_id !== projectServerUserId\(session\)/);
  assert.match(server, /Content-Disposition/);
  assert.match(server, /function buildArtifactDownloads\(jobId, completedJob\)/);
});
