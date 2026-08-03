#!/usr/bin/env node
"use strict";

const path = require("node:path");

const FORGEJO_DATABASE = "forgejo";
const FORGEJO_ROLE = "forgejo";
const RUNTIME_DATABASE = "gernetix_runtime";

function escapeSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function requiredSecret(value, name = "FORGEJO_POSTGRES_PASSWORD") {
  const secret = String(value || "").trim();
  if (!secret) throw new Error(`${name} fehlt.`);
  return secret;
}

async function provisionForgejoPostgres({ maintenancePool, runtimePool, forgejoPool }, password) {
  const escapedPassword = escapeSqlLiteral(requiredSecret(password));
  await maintenancePool.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${FORGEJO_ROLE}') THEN
        CREATE ROLE ${FORGEJO_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
      END IF;
    END
  $$`);
  await maintenancePool.query(`ALTER ROLE ${FORGEJO_ROLE}
    WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
    PASSWORD ${escapedPassword}`);

  const databaseResult = await maintenancePool.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [FORGEJO_DATABASE],
  );
  if (databaseResult.rows.length === 0) {
    await maintenancePool.query(`CREATE DATABASE ${FORGEJO_DATABASE} OWNER ${FORGEJO_ROLE}`);
  }
  await maintenancePool.query(`ALTER DATABASE ${FORGEJO_DATABASE} OWNER TO ${FORGEJO_ROLE}`);
  await maintenancePool.query(`REVOKE ALL PRIVILEGES ON DATABASE ${FORGEJO_DATABASE} FROM PUBLIC`);
  await maintenancePool.query(`GRANT CONNECT, CREATE, TEMPORARY ON DATABASE ${FORGEJO_DATABASE} TO ${FORGEJO_ROLE}`);

  // Runtime services use the database owner. Other technical logins must receive
  // CONNECT explicitly, so Forgejo cannot regain access through PUBLIC.
  await maintenancePool.query(`REVOKE CONNECT, TEMPORARY ON DATABASE ${RUNTIME_DATABASE} FROM PUBLIC`);
  await maintenancePool.query(`REVOKE ALL PRIVILEGES ON DATABASE ${RUNTIME_DATABASE} FROM ${FORGEJO_ROLE}`);
  await runtimePool.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${FORGEJO_ROLE}`);
  await runtimePool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${FORGEJO_ROLE}`);
  await runtimePool.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${FORGEJO_ROLE}`);
  await runtimePool.query(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${FORGEJO_ROLE}`);

  await forgejoPool.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await forgejoPool.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${FORGEJO_ROLE}`);
  return { database: FORGEJO_DATABASE, role: FORGEJO_ROLE };
}

function loadPg() {
  const pgPath = require.resolve("pg", {
    paths: [path.resolve(__dirname, "..", "services", "build-deploy-server", "node_modules")],
  });
  return require(pgPath);
}

async function main() {
  const password = requiredSecret(process.env.FORGEJO_POSTGRES_PASSWORD);
  const { Pool } = loadPg();
  const base = {
    host: process.env.RUNTIME_POSTGRES_HOST || "runtime-postgres",
    port: Number(process.env.RUNTIME_POSTGRES_PORT || 5432),
    user: process.env.RUNTIME_POSTGRES_USER || "gernetix_runtime",
    password: requiredSecret(process.env.RUNTIME_POSTGRES_PASSWORD, "RUNTIME_POSTGRES_PASSWORD"),
  };
  const pools = {
    maintenancePool: new Pool({ ...base, database: "postgres" }),
    runtimePool: new Pool({ ...base, database: RUNTIME_DATABASE }),
    forgejoPool: new Pool({ ...base, database: FORGEJO_DATABASE }),
  };
  try {
    const result = await provisionForgejoPostgres(pools, password);
    process.stdout.write(`Forgejo-PostgreSQL-Vertrag bereit: ${result.database}/${result.role}\n`);
  } finally {
    await Promise.all(Object.values(pools).map((pool) => pool.end()));
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Forgejo-PostgreSQL-Provisionierung fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  FORGEJO_DATABASE,
  FORGEJO_ROLE,
  RUNTIME_DATABASE,
  escapeSqlLiteral,
  provisionForgejoPostgres,
  requiredSecret,
};
