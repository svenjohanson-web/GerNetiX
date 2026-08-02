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

test("Build workers coordinate jobs and target locks through central PostgreSQL", () => {
  assert.match(compose, /BUILD_ARTIFACT_PERSISTENCE_BACKEND: postgres/);
  assert.match(compose, /BUILD_COORDINATION_BACKEND: postgres/);
  assert.match(compose, /BUILD_COORDINATION_POOL_MAX: 20/);
  assert.match(compose, /BUILD_WORKER_HEARTBEAT_MS: 15000/);
  assert.match(compose, /BUILD_WORKER_STALE_MS: 120000/);
  assert.match(compose, /BUILD_WORKER_POOL_BASE_URL: http:\/\/build-router:4400/);
  assert.match(compose, /^  build-router:$/m);
  assert.match(compose, /BUILD_WORKER_UPSTREAMS: \$\{BUILD_WORKER_UPSTREAMS:-\}/);
  assert.match(compose, /BUILD_WORKER_PRIMARY_UPSTREAMS: \$\{BUILD_WORKER_PRIMARY_UPSTREAMS:-\}/);
  assert.match(compose, /RUNTIME_POSTGRES_BIND_ADDRESS:-127\.0\.0\.1/);
  assert.match(envExample, /^BUILD_WORKER_UPSTREAMS=$/m);
  assert.match(envExample, /^BUILD_WORKER_PRIMARY_UPSTREAMS=$/m);
  assert.match(compose, /^  build-worker-postgres-access:$/m);
  assert.match(compose, /profiles: \["build-worker-provisioning"\]/);
  assert.match(remoteDeploy, /--profile build-worker-provisioning[\s\\]+\n\s*run --rm build-worker-postgres-access/);
  assert.match(compose, /provision-build-worker-postgres\.js/);
  assert.match(envExample, /^BUILD_WORKER_POSTGRES_PASSWORD=$/m);
});

test("Community administration uses a dedicated token instead of Identity operator accounts", () => {
  assert.match(compose, /COMMUNITY_ADMIN_TOKEN: \$\{COMMUNITY_ADMIN_TOKEN:\?COMMUNITY_ADMIN_TOKEN muss gesetzt sein\}/);
  assert.doesNotMatch(compose, /COMMUNITY_OPERATOR_USER_IDS:/);
});

test("link integrity uses a dedicated token only in Identity and Admin Tool", () => {
  const assignments = compose.match(/^\s+LINK_INTEGRITY_INGEST_TOKEN:\s+.+$/gm) || [];
  assert.equal(assignments.length, 2);
  assert.ok(assignments.every((line) => line.includes("${LINK_INTEGRITY_INGEST_TOKEN:")));
  assert.match(envExample, /^LINK_INTEGRITY_INGEST_TOKEN=replace-with-a-separate-long-random-secret$/m);
});
