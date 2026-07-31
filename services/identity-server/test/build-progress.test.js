const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = readPlatformAppSource();
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const server = ["dev-server.js", path.join("dev", "server", "build-routes.js")]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8")).join("\n");

test("forwards live build progress into the IDE terminal", () => {
  const buildWait = app.slice(app.indexOf("async function waitForCompletedBuild"), app.indexOf("function appendBuildFailureLog"));

  assert.match(buildWait, /const seenProgress = new Set\(\)/);
  assert.match(buildWait, /appendBuildProgress\(current\.progress, seenProgress, options\)/);
  assert.match(buildWait, /appendIdeTerminal\(kind, message\)/);
  assert.match(server, /progress: Array\.isArray\(job\.progress\) \? job\.progress : \[\]/);
  assert.match(server, /projectJob\?\.error\?\.details\?\.build_log/);
});

test("IDE clean action clears all target caches without clearing source files", () => {
  assert.match(html, /id="cleanBuildButton"[^>]*>Clean<\/button>/);
  assert.match(app, /cleanBuildButton"\)\.addEventListener\("click", cleanProjectBuildCache\)/);
  assert.match(app, /postJson\("\/api\/user-ide\/build-cache\/clean", \{ project_slug: project\.slug \}\)/);
  assert.match(app, /Der nächste Gesamtbuild wird vollständig neu aufgebaut\./);
  assert.match(server, /buildDeployJson\("\/api\/build-cache\/clean"/);
});

test("IDE terminal keeps linker causes in the compact failure diagnosis", () => {
  assert.match(app, /undefined reference/);
  assert.match(app, /multiple definition/);
  assert.match(app, /cannot find/);
});
