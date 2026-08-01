"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  BUILD_TABLES,
  escapeSqlLiteral,
  provisionBuildWorkerRole,
} = require("./provision-build-worker-postgres");

test("escapes a PostgreSQL password without logging or interpolating an unsafe quote", () => {
  assert.equal(escapeSqlLiteral("worker's-secret"), "'worker''s-secret'");
});

test("provisions a role restricted to build tables", async () => {
  const queries = [];
  const pool = { query: async (sql) => { queries.push(sql); return { rows: [] }; } };
  const result = await provisionBuildWorkerRole(pool, "secret-value");
  const sql = queries.join("\n");
  assert.equal(result.configured, true);
  assert.match(sql, /CREATE ROLE gernetix_build_worker LOGIN/);
  assert.match(sql, /REVOKE CREATE ON SCHEMA public/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public/);
  for (const table of BUILD_TABLES) assert.match(sql, new RegExp(table));
  assert.doesNotMatch(sql, /identity_user_accounts|project_projects|telemetry_measurements/);
});

test("does nothing until a separate worker password is configured", async () => {
  let queries = 0;
  const result = await provisionBuildWorkerRole({ query: async () => { queries += 1; } }, "");
  assert.equal(result.configured, false);
  assert.equal(queries, 0);
});
