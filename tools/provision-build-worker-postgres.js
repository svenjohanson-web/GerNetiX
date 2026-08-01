#!/usr/bin/env node
"use strict";

const path = require("node:path");

const BUILD_WORKER_ROLE = "gernetix_build_worker";
const BUILD_TABLES = [
  "build_artifacts",
  "build_execution_jobs",
  "build_project_cache_epochs",
  "build_workers",
];

function escapeSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function provisionBuildWorkerRole(pool, password) {
  if (!password) return { configured: false, role: BUILD_WORKER_ROLE };
  await pool.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${BUILD_WORKER_ROLE}') THEN
        CREATE ROLE ${BUILD_WORKER_ROLE} LOGIN;
      END IF;
    END
  $$`);
  await pool.query(`ALTER ROLE ${BUILD_WORKER_ROLE} PASSWORD ${escapeSqlLiteral(password)}`);
  await pool.query(`GRANT CONNECT ON DATABASE gernetix_runtime TO ${BUILD_WORKER_ROLE}`);
  await pool.query(`GRANT USAGE ON SCHEMA public TO ${BUILD_WORKER_ROLE}`);
  await pool.query(`REVOKE CREATE ON SCHEMA public FROM ${BUILD_WORKER_ROLE}`);
  await pool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${BUILD_WORKER_ROLE}`);
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${BUILD_TABLES.join(", ")} TO ${BUILD_WORKER_ROLE}`);
  await pool.query(`GRANT SELECT ON TABLE build_deploy_ota_acknowledgements TO ${BUILD_WORKER_ROLE}`);
  return { configured: true, role: BUILD_WORKER_ROLE, tables: [...BUILD_TABLES] };
}

function loadPg() {
  const pgPath = require.resolve("pg", {
    paths: [path.resolve(__dirname, "..", "services", "build-deploy-server", "node_modules")],
  });
  return require(pgPath);
}

async function main() {
  const password = process.env.BUILD_WORKER_POSTGRES_PASSWORD || "";
  if (!password) {
    process.stdout.write("Build-Worker-PostgreSQL-Rolle: nicht konfiguriert, uebersprungen.\n");
    return;
  }
  const { Pool } = loadPg();
  const pool = new Pool({
    host: process.env.RUNTIME_POSTGRES_HOST || "runtime-postgres",
    port: Number(process.env.RUNTIME_POSTGRES_PORT || 5432),
    database: process.env.RUNTIME_POSTGRES_DATABASE || "gernetix_runtime",
    user: process.env.RUNTIME_POSTGRES_USER || "gernetix_runtime",
    password: process.env.RUNTIME_POSTGRES_PASSWORD || "",
  });
  try {
    const result = await provisionBuildWorkerRole(pool, password);
    process.stdout.write(`Build-Worker-PostgreSQL-Rolle bereit: ${result.role}\n`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Build-Worker-PostgreSQL-Provisionierung fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  BUILD_TABLES,
  BUILD_WORKER_ROLE,
  escapeSqlLiteral,
  provisionBuildWorkerRole,
};
