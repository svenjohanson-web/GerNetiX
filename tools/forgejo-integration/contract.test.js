"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const directory = __dirname;
const compose = fs.readFileSync(path.join(directory, "compose.yaml"), "utf8");
const runner = fs.readFileSync(path.join(directory, "run.sh"), "utf8");
const integration = fs.readFileSync(path.join(directory, "integration-test.js"), "utf8");
const postgres = fs.readFileSync(path.join(directory, "init-postgres.sql"), "utf8");

test("uses only project-scoped resources on an internal network without host ports", () => {
  assert.match(compose, /image: codeberg\.org\/forgejo\/forgejo:15\.0\.6-rootless/);
  assert.match(compose, /image: pgvector\/pgvector:pg17/);
  assert.match(compose, /integration:\n    internal: true/);
  assert.doesNotMatch(compose, /\n\s+ports:/);
  assert.match(runner, /project_name="gernetix-forgejo-it-\$\$"/);
  assert.match(runner, /down --volumes --remove-orphans --rmi local/);
  assert.doesNotMatch(runner, /compose\.vps\.yaml|\.env\.vps|staging/i);
  assert.match(compose, /test-state-init:[\s\S]*cap_add:\n\s+- CHOWN[\s\S]*command: \["chown", "1000:1000", "\/state"\]/);
  assert.match(compose, /test-state-init:[\s\S]*network_mode: none/);
  assert.match(compose, /adapter-test:[\s\S]*cap_drop:\n\s+- ALL/);
});

test("runs the real adapters and all required repository checks across a restart", () => {
  assert.match(integration, /ForgejoClient/);
  assert.match(integration, /ForgejoProjectRepositoryStore/);
  assert.match(integration, /GitProjectRepositoryStore/);
  for (const evidence of ["private", "provisionProject", "readFile", "commitChanges", "renamed", "operation: \"delete\"", "repository_head_conflict"]) {
    assert.ok(integration.includes(evidence), `${evidence} fehlt`);
  }
  assert.match(runner, /compose restart forgejo/);
  assert.match(runner, /TEST_PHASE=restart/);
});

test("denies the Forgejo login access to gernetix_runtime and probes that denial", () => {
  assert.match(postgres, /REVOKE CONNECT, TEMPORARY ON DATABASE gernetix_runtime FROM PUBLIC/);
  assert.match(postgres, /REVOKE ALL PRIVILEGES ON DATABASE gernetix_runtime FROM forgejo/);
  assert.match(runner, /--username forgejo --dbname forgejo/);
  assert.match(runner, /--username forgejo --dbname gernetix_runtime/);
  assert.match(runner, /FEHLER: Forgejo-Rolle konnte gernetix_runtime öffnen/);
});
