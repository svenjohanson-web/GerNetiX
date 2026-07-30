const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const compose = fs.readFileSync(path.join(__dirname, "..", "compose.vps.yaml"), "utf8");
const envExample = fs.readFileSync(path.join(__dirname, "..", ".env.vps.example"), "utf8");
const remoteDeploy = fs.readFileSync(path.join(__dirname, "..", "scripts", "staging", "remote-deploy.sh"), "utf8");

test("VPS compose runs exactly one PostgreSQL container", () => {
  const postgresImages = compose.match(/^\s+image:\s+(?:postgres|pgvector\/pgvector):[^\n]+$/gm) || [];
  assert.equal(postgresImages.length, 1);
  assert.match(compose, /^  runtime-postgres:$/m);
  assert.match(compose, /POSTGRES_DB: gernetix_runtime/);
  assert.match(compose, /runtime_postgres_data:\/var\/lib\/postgresql\/data/);
  assert.match(compose, /runtime-postgres-access:/);
  assert.match(compose, /  backend:\n    internal: true\n/);
  assert.match(compose, /\n  runtime-postgres-access:\n/);
});

test("productive runtime services do not select SQLite persistence", () => {
  assert.doesNotMatch(compose, /^\s+[A-Z0-9_]*PERSISTENCE_BACKEND:\s+sqlite\s*$/m);
  assert.match(compose, /postgres-consolidation-migration:/);
  assert.match(compose, /profiles: \["postgres-consolidation"\]/);
  assert.match(remoteDeploy, /run --rm --no-deps postgres-consolidation-migration/);
  assert.match(remoteDeploy, /up -d --no-deps --force-recreate runtime-postgres/);
  assert.match(remoteDeploy, /up -d --remove-orphans/);
});

test("link integrity uses a dedicated token only in Identity and Admin Tool", () => {
  const assignments = compose.match(/^\s+LINK_INTEGRITY_INGEST_TOKEN:\s+.+$/gm) || [];
  assert.equal(assignments.length, 2);
  assert.ok(assignments.every((line) => line.includes("${LINK_INTEGRITY_INGEST_TOKEN:")));
  assert.match(envExample, /^LINK_INTEGRITY_INGEST_TOKEN=replace-with-a-separate-long-random-secret$/m);
});
