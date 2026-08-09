const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = readPlatformAppSource();
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const server = ["../src/dev-server.js", "../src/dev/server/build-routes.js", "../src/dev/builds/build-service.js"]
  .map((file) => fs.readFileSync(path.resolve(__dirname, file), "utf8")).join("\n");

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
  assert.match(server, /customerArtifactList\(jobId, artifacts\)/);
  assert.match(server, /isCustomerDownloadableArtifactName\(fileName\)/);
});

test("explains each saved build with a stable configuration snapshot and readable result", () => {
  assert.match(app, /function buildTargetLabel\(build, project\)/);
  assert.match(app, /function buildBasisLabel\(build, project\)/);
  assert.match(app, /function buildDurationLabel\(build\)/);
  assert.match(app, /Technische Kennung/);
  assert.match(server, /build_config: job\.build_config \|\| project\.build_config \|\| null/);
});
