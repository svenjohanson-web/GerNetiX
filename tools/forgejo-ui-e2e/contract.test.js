"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const compose = read("compose.yaml");
const dockerfile = read("Dockerfile");
const runner = read("run-ui-e2e.js");
const shell = read("run.sh");

test("pins an isolated browser runner without host ports or persistent test data", () => {
  assert.match(dockerfile, /mcr\.microsoft\.com\/playwright:v1\.62\.0-noble/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.doesNotMatch(compose, /ports:/);
  assert.match(compose, /tmpfs:/);
  assert.match(shell, /down --volumes --remove-orphans --rmi local/);
});

test("uses production repository UI and session-protected Identity routes against real Forgejo adapters", () => {
  assert.match(runner, /project-repository-card\.js/);
  assert.match(runner, /registerProjectRoutes/);
  assert.match(runner, /createProjectRepositoryRead/);
  assert.match(runner, /ForgejoProjectRepositoryStore/);
  assert.match(runner, /createHttpApp/);
  assert.match(runner, /anonymous\.status, 401/);
  assert.match(runner, /foreign\.status, 404/);
});

test("asserts visible repository behavior and rejects browser-side Forgejo exposure", () => {
  for (const evidence of ["Git-Repository", "src/main.cpp", "Commit-Diff", "forgejoToken", "forgejoBaseUrl", "requestUrls"]) {
    assert.match(runner, new RegExp(evidence.replace(/[.]/g, "\\.")));
  }
  assert.match(runner, /Browser greift nie direkt auf Forgejo zu/);
  assert.match(runner, /Repository-Karte wechselt mobil in eine Spalte/);
});

function read(name) {
  return fs.readFileSync(new URL(name, `file://${__dirname}/`), "utf8");
}
