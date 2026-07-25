#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { PostgresAdminRepository } = require("../services/admin-tool/src/repositories/postgres-admin-repository");

const COLLECTIONS = {
  devices: "devices",
  feedback: "feedback",
  ai_usage_events: "aiUsageEvents",
  consents: "consents",
  audit_events: "auditEvents",
  admin_actions: "adminActions",
  system_events: "systemEvents",
};

function readLegacyOperationsState(sqlitePath) {
  const state = {
    devices: [], feedback: [], aiUsageEvents: [], consents: [],
    auditEvents: [], adminActions: [], systemEvents: [], interfaceCalls: [],
  };
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return state;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    if (tableExists(db, "service_documents")) {
      for (const row of db.prepare(`
        SELECT collection_name, document_json FROM service_documents
        WHERE service_key='admin-tool' ORDER BY collection_name, document_id
      `).all()) {
        const target = COLLECTIONS[row.collection_name];
        if (target) state[target].push(JSON.parse(row.document_json));
      }
    }
    const typed = {
      devices: ["admin_tool_devices", "device_id"],
      feedback: ["admin_tool_feedback", "feedback_id"],
      aiUsageEvents: ["admin_tool_ai_usage_events", "event_id"],
      auditEvents: ["admin_tool_audit_events", "audit_event_id"],
      adminActions: ["admin_tool_admin_actions", "action_id"],
      systemEvents: ["admin_tool_system_events", "event_id"],
    };
    for (const [target, [table, id]] of Object.entries(typed)) {
      if (!state[target].length && tableExists(db, table)) {
        state[target] = db.prepare(`SELECT raw_json FROM ${table} ORDER BY ${id}`)
          .all().map((row) => JSON.parse(row.raw_json));
      }
    }
    if (!state.consents.length && tableExists(db, "admin_tool_consents")) {
      state.consents = db.prepare("SELECT * FROM admin_tool_consents ORDER BY consent_id").all();
    }
    if (tableExists(db, "gernetix_external_interface_calls")) {
      state.interfaceCalls = db.prepare(`
        SELECT occurred_at, source_service, target_service, method, route,
          status_code, duration_ms, succeeded
        FROM gernetix_external_interface_calls ORDER BY call_id
      `).all().map((row) => ({ ...row, succeeded: Boolean(row.succeeded) }));
    }
    return state;
  } finally {
    db.close();
  }
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

async function main() {
  const sqlitePath = process.env.OPERATIONS_SQLITE_PATH
    || process.env.PERSISTENCE_SQLITE_PATH
    || "/var/lib/gernetix/services/gernetix-services.sqlite";
  const repository = await PostgresAdminRepository.create({
    poolOptions: {
      connectionString: process.env.OPERATIONS_POSTGRES_URL || undefined,
      host: process.env.OPERATIONS_POSTGRES_HOST || "operations-postgres",
      port: Number(process.env.OPERATIONS_POSTGRES_PORT || 5432),
      database: process.env.OPERATIONS_POSTGRES_DATABASE || "gernetix_operations",
      user: process.env.OPERATIONS_POSTGRES_USER || "gernetix_operations",
      password: requiredSecret(process.env.OPERATIONS_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(readLegacyOperationsState(sqlitePath));
    process.stdout.write(`${JSON.stringify({ sqlite_path: sqlitePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("OPERATIONS_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Operations-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { readLegacyOperationsState, requiredSecret };
