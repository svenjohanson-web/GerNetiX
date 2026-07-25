#!/usr/bin/env node
"use strict";

const domains = [
  ["identity", [
    "identity_user_accounts", "identity_local_credentials", "identity_external_identities",
    "identity_verification_tokens", "identity_password_reset_tokens",
    "identity_offline_recovery_transactions", "identity_sessions",
    "identity_knowledge_chapter_reads", "identity_migrations",
  ]],
  ["project", [
    "project_projects", "project_sources", "project_artifacts", "project_build_jobs",
    "project_consents", "project_feedback", "project_resource_policies", "project_migrations",
  ]],
  ["telemetry", [
    "telemetry_retention_policies", "telemetry_events", "telemetry_measurements", "telemetry_migrations",
  ]],
  ["community", [
    "community_questions", "community_answers", "community_knowledge_documents", "community_migrations",
  ]],
  ["device_management", [
    "device_management_devices", "device_management_credentials", "device_management_account_devices",
    "device_management_pairing_sessions", "device_management_challenges",
    "device_management_provisioning_tokens", "device_management_purchase_contexts",
    "device_management_consents", "device_management_audit_events", "device_management_migrations",
  ]],
  ["ai_usage", [
    "ai_usage_credit_accounts", "ai_usage_events", "ai_usage_ledger_entries",
    "ai_usage_policy", "ai_usage_admin_audit_events", "ai_usage_migrations",
  ]],
  ["hardware_catalog", [
    "hardware_catalog_capabilities", "hardware_catalog_items", "hardware_catalog_migrations",
  ]],
  ["hardware_shop", [
    "hardware_shop_offers", "hardware_shop_carts", "hardware_shop_orders", "hardware_shop_migrations",
  ]],
  ["operations", [
    "operations_system_events", "operations_interface_calls", "operations_admin_actions",
    "operations_audit_events", "operations_consents", "operations_legacy_snapshots", "operations_migrations",
  ]],
  ["ai_context", [
    "ai_context_policy", "ai_context_sources", "ai_context_prompt_foundations",
    "ai_context_architecture_components", "ai_context_help_articles",
    "ai_context_clarification_cases", "ai_context_intent_examples", "ai_context_grants",
    "ai_context_audit_events", "ai_context_migrations",
  ]],
];

function poolOptions(prefix, env = process.env) {
  const connectionString = env[`LEGACY_${prefix.toUpperCase()}_POSTGRES_URL`];
  if (connectionString) return { connectionString };
  const password = env[`LEGACY_${prefix.toUpperCase()}_POSTGRES_PASSWORD`];
  if (!password) return null;
  const legacyName = prefix === "project" ? "gernetix_projects" : `gernetix_${prefix}`;
  return {
    host: env[`LEGACY_${prefix.toUpperCase()}_POSTGRES_HOST`] || `${prefix.replaceAll("_", "-")}-postgres`,
    port: Number(env[`LEGACY_${prefix.toUpperCase()}_POSTGRES_PORT`] || 5432),
    database: env[`LEGACY_${prefix.toUpperCase()}_POSTGRES_DATABASE`] || legacyName,
    user: env[`LEGACY_${prefix.toUpperCase()}_POSTGRES_USER`] || legacyName,
    password,
  };
}

function targetPoolOptions(env = process.env) {
  return env.RUNTIME_POSTGRES_URL
    ? { connectionString: env.RUNTIME_POSTGRES_URL }
    : {
      host: env.RUNTIME_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.RUNTIME_POSTGRES_PORT || 5432),
      database: env.RUNTIME_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.RUNTIME_POSTGRES_USER || "gernetix_runtime",
      password: env.RUNTIME_POSTGRES_PASSWORD || "",
    };
}

function identifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Unsicherer SQL-Bezeichner: ${value}`);
  return `"${value}"`;
}

async function tableMetadata(pool, table) {
  const columns = (await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  )).rows.map((row) => row.column_name);
  if (!columns.length) return null;
  const primaryKey = (await pool.query(
    `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)`,
    [table],
  )).rows.map((row) => row.column_name);
  return { columns, primaryKey };
}

async function copyTable(source, target, table) {
  const sourceMeta = await tableMetadata(source, table);
  const targetMeta = await tableMetadata(target, table);
  if (!sourceMeta || !targetMeta) return 0;
  const columns = sourceMeta.columns.filter((column) => targetMeta.columns.includes(column));
  const rows = (await source.query(
    `SELECT ${columns.map(identifier).join(", ")} FROM ${identifier(table)}`,
  )).rows;
  const primaryKey = sourceMeta.primaryKey.filter((column) => columns.includes(column));
  const mutable = columns.filter((column) => !primaryKey.includes(column));
  const conflict = primaryKey.length && mutable.length
    ? `ON CONFLICT (${primaryKey.map(identifier).join(", ")}) DO UPDATE SET ${mutable.map((column) => `${identifier(column)} = EXCLUDED.${identifier(column)}`).join(", ")}`
    : "ON CONFLICT DO NOTHING";
  for (const row of rows) {
    await target.query(
      `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(", ")})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
       ${conflict}`,
      columns.map((column) => row[column]),
    );
  }
  return rows.length;
}

async function copyDomain(target, name, tables, options, Pool) {
  if (!options) {
    process.stdout.write(`Legacy-PostgreSQL ${name}: nicht konfiguriert, uebersprungen.\n`);
    return;
  }
  const marker = `legacy-postgres:${name}:v1`;
  if ((await target.query("SELECT 1 FROM runtime_postgres_consolidations WHERE migration_id = $1", [marker])).rowCount) {
    process.stdout.write(`Legacy-PostgreSQL ${name}: bereits konsolidiert.\n`);
    return;
  }
  const source = new Pool(options);
  let copied = 0;
  try {
    await source.query("SELECT 1");
    const sourceTables = (await source.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])",
      [tables],
    )).rows.map((row) => row.table_name);
    if (!sourceTables.length) throw new Error("keine erwartete Domaenentabelle in der Quelldatenbank gefunden");
    const targetTables = new Set((await target.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])",
      [sourceTables],
    )).rows.map((row) => row.table_name));
    const missingTargetTables = sourceTables.filter((table) => !targetTables.has(table));
    if (missingTargetTables.length) {
      throw new Error(`Zielschema fehlt fuer ${missingTargetTables.join(", ")}`);
    }
    await target.query("BEGIN");
    for (const table of tables.filter((table) => sourceTables.includes(table))) {
      copied += await copyTable(source, target, table);
    }
    await target.query(
      "INSERT INTO runtime_postgres_consolidations (migration_id, copied_rows) VALUES ($1, $2)",
      [marker, copied],
    );
    await target.query("COMMIT");
    process.stdout.write(`Legacy-PostgreSQL ${name}: ${copied} Zeilen konsolidiert.\n`);
  } catch (error) {
    await target.query("ROLLBACK").catch(() => {});
    throw new Error(`Legacy-PostgreSQL ${name}: ${error.message}`);
  } finally {
    await source.end();
  }
}

async function main(env = process.env, Pool = require("../services/identity-server/node_modules/pg").Pool) {
  const target = new Pool(targetPoolOptions(env));
  try {
    await target.query(`
      CREATE TABLE IF NOT EXISTS runtime_postgres_consolidations (
        migration_id text PRIMARY KEY,
        copied_rows integer NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const [name, tables] of domains) {
      await copyDomain(target, name, tables, poolOptions(name, env), Pool);
    }
  } finally {
    await target.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { copyTable, domains, identifier, poolOptions, targetPoolOptions };
