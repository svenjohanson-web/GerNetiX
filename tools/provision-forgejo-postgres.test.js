"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  escapeSqlLiteral,
  provisionForgejoPostgres,
  requiredSecret,
} = require("./provision-forgejo-postgres");

function recordingPool({ databaseExists = true } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (/SELECT 1 FROM pg_database/.test(sql)) {
        return { rows: databaseExists ? [{ "?column?": 1 }] : [] };
      }
      return { rows: [] };
    },
  };
}

test("requires a dedicated Forgejo database secret and escapes quotes", () => {
  assert.throws(() => requiredSecret(""), /FORGEJO_POSTGRES_PASSWORD/);
  assert.equal(escapeSqlLiteral("forgejo's-secret"), "'forgejo''s-secret'");
});

test("creates a least-privilege Forgejo role and isolated database", async () => {
  const maintenancePool = recordingPool({ databaseExists: false });
  const runtimePool = recordingPool();
  const forgejoPool = recordingPool();
  const result = await provisionForgejoPostgres(
    { maintenancePool, runtimePool, forgejoPool },
    "separate-secret",
  );
  const maintenanceSql = maintenancePool.queries.map(({ sql }) => sql).join("\n");
  const runtimeSql = runtimePool.queries.map(({ sql }) => sql).join("\n");
  const forgejoSql = forgejoPool.queries.map(({ sql }) => sql).join("\n");

  assert.deepEqual(result, { database: "forgejo", role: "forgejo" });
  assert.match(maintenanceSql, /CREATE ROLE forgejo LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.match(maintenanceSql, /CREATE DATABASE forgejo OWNER forgejo/);
  assert.match(maintenanceSql, /REVOKE ALL PRIVILEGES ON DATABASE forgejo FROM PUBLIC/);
  assert.match(maintenanceSql, /REVOKE CONNECT, TEMPORARY ON DATABASE gernetix_runtime FROM PUBLIC/);
  assert.match(maintenanceSql, /REVOKE ALL PRIVILEGES ON DATABASE gernetix_runtime FROM forgejo/);
  assert.match(runtimeSql, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM forgejo/);
  assert.match(runtimeSql, /REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM forgejo/);
  assert.match(forgejoSql, /GRANT USAGE, CREATE ON SCHEMA public TO forgejo/);
  assert.doesNotMatch(maintenanceSql + runtimeSql + forgejoSql, /gernetix_build_worker/);
});

test("keeps an existing Forgejo database and reapplies ownership and grants", async () => {
  const maintenancePool = recordingPool({ databaseExists: true });
  await provisionForgejoPostgres(
    { maintenancePool, runtimePool: recordingPool(), forgejoPool: recordingPool() },
    "rotated-secret",
  );
  const sql = maintenancePool.queries.map((query) => query.sql).join("\n");
  assert.doesNotMatch(sql, /CREATE DATABASE forgejo OWNER/);
  assert.match(sql, /ALTER DATABASE forgejo OWNER TO forgejo/);
  assert.match(sql, /PASSWORD 'rotated-secret'/);
});
