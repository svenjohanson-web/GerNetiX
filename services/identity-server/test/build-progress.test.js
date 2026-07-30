const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("forwards live build progress into the IDE terminal", () => {
  const buildWait = app.slice(app.indexOf("async function waitForCompletedBuild"), app.indexOf("function appendBuildFailureLog"));

  assert.match(buildWait, /const seenProgress = new Set\(\)/);
  assert.match(buildWait, /appendBuildProgress\(current\.progress, seenProgress\)/);
  assert.match(buildWait, /appendIdeTerminal\(kind, entry\?\.message \|\| ""\)/);
  assert.match(server, /progress: Array\.isArray\(job\.progress\) \? job\.progress : \[\]/);
});
