#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const {
  PostgresAiUsageRepository,
} = require("../services/ai-usage-server/src/repositories/postgres-ai-usage-repository");
const {
  defaultPolicy,
} = require("../services/ai-usage-server/src/repositories/in-memory-ai-usage-repository");

function readLegacyAiUsageState(sqlitePath) {
  const state = {
    creditAccounts: [],
    ledgerEntries: [],
    usageEvents: [],
    adminAuditEvents: [],
    policy: defaultPolicy(),
  };
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return state;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    if (tableExists(db, "service_documents")) {
      const mapping = {
        credit_accounts: "creditAccounts",
        ledger_entries: "ledgerEntries",
        usage_events: "usageEvents",
        admin_audit_events: "adminAuditEvents",
        policy: "policy",
      };
      for (const row of db.prepare(`
        SELECT collection_name, document_json
        FROM service_documents
        WHERE service_key='ai-usage-server'
        ORDER BY collection_name, document_id
      `).all()) {
        const target = mapping[row.collection_name];
        if (!target) continue;
        const value = JSON.parse(row.document_json);
        if (target === "policy") state.policy = value.value || value;
        else state[target].push(value);
      }
      if (state.creditAccounts.length || state.ledgerEntries.length
        || state.usageEvents.length || state.adminAuditEvents.length) return state;
    }
    state.creditAccounts = readRows(db, "ai_usage_credit_accounts", (row) => ({
      account_id: row.account_id,
      plan_id: row.plan_id,
      total_granted_credits: Number(row.total_granted_credits || 0),
      consumed_credits: Number(row.consumed_credits || 0),
      held_credits: Number(row.held_credits || 0),
      blocked_until: row.blocked_until,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    state.ledgerEntries = readRows(db, "ai_usage_ledger_entries", (row) => ({
      ledger_entry_id: row.ledger_entry_id,
      account_id: row.account_id,
      entry_type: "legacy_adjustment",
      amount_credits: Number(row.amount_credits || 0),
      reason: row.reason,
      reference_id: row.reference_id,
      created_at: row.created_at,
    }));
    state.usageEvents = readJsonRows(db, "ai_usage_events");
    state.adminAuditEvents = readJsonRows(db, "ai_usage_admin_audit_events");
    const policies = readJsonRows(db, "ai_usage_policy");
    if (policies.length) state.policy = policies[0];
    return state;
  } finally {
    db.close();
  }
}

function readRows(db, table, mapper) {
  if (!tableExists(db, table)) return [];
  return db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(mapper);
}

function readJsonRows(db, table) {
  if (!tableExists(db, table)) return [];
  return db.prepare(`SELECT raw_json FROM ${table} ORDER BY rowid`)
    .all().map((row) => JSON.parse(row.raw_json));
}

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

async function main() {
  const sqlitePath = process.env.AI_USAGE_SQLITE_PATH
    || process.env.PERSISTENCE_SQLITE_PATH
    || "/var/lib/gernetix/services/gernetix-services.sqlite";
  const repository = await PostgresAiUsageRepository.create({
    poolOptions: {
      connectionString: process.env.AI_USAGE_POSTGRES_URL || undefined,
      host: process.env.AI_USAGE_POSTGRES_HOST || "ai-usage-postgres",
      port: Number(process.env.AI_USAGE_POSTGRES_PORT || 5432),
      database: process.env.AI_USAGE_POSTGRES_DATABASE || "gernetix_ai_usage",
      user: process.env.AI_USAGE_POSTGRES_USER || "gernetix_ai_usage",
      password: requiredSecret(process.env.AI_USAGE_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(readLegacyAiUsageState(sqlitePath));
    process.stdout.write(`${JSON.stringify({ sqlite_path: sqlitePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("AI_USAGE_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`AI-Usage-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { readLegacyAiUsageState, requiredSecret };
