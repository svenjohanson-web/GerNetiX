#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { PostgresTelemetryRepository } = require("../services/telemetry-server/src/repositories/postgres-telemetry-repository");

function readLegacyTelemetryState(sqlitePath) {
  const state = { measurements: [], events: [], retentionPolicies: [] };
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return state;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    if (tableExists(db, "telemetry_measurements")) {
      state.measurements = db.prepare("SELECT * FROM telemetry_measurements ORDER BY rowid").all()
        .map((row) => ({
          ...row,
          value: row.numeric_value,
          metadata: parseJson(row.metadata_json),
        }));
    }
    if (tableExists(db, "telemetry_events")) {
      state.events = db.prepare("SELECT * FROM telemetry_events ORDER BY rowid").all()
        .map((row) => ({
          ...row,
          notify_push: Boolean(row.notify_push),
          metadata: parseJson(row.metadata_json),
        }));
    }
    if (tableExists(db, "telemetry_retention_policies")) {
      state.retentionPolicies = db.prepare(
        "SELECT * FROM telemetry_retention_policies ORDER BY account_id, project_id",
      ).all();
    }
    return state;
  } finally {
    db.close();
  }
}

function hasTelemetryState(state) {
  return state.measurements.length > 0 || state.events.length > 0;
}

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

async function main() {
  const sqlitePath = process.env.TELEMETRY_SQLITE_PATH
    || "/var/lib/gernetix/telemetry/gernetix-telemetry.sqlite";
  const fallbackPath = process.env.TELEMETRY_LEGACY_SHARED_SQLITE_PATH || "";
  const primaryState = readLegacyTelemetryState(sqlitePath);
  const usePrimary = hasTelemetryState(primaryState) || !fallbackPath || !fs.existsSync(fallbackPath);
  const sourcePath = usePrimary ? sqlitePath : fallbackPath;
  const state = usePrimary ? primaryState : readLegacyTelemetryState(fallbackPath);
  const repository = await PostgresTelemetryRepository.create({
    poolOptions: {
      connectionString: process.env.TELEMETRY_POSTGRES_URL || undefined,
      host: process.env.TELEMETRY_POSTGRES_HOST || "telemetry-postgres",
      port: Number(process.env.TELEMETRY_POSTGRES_PORT || 5432),
      database: process.env.TELEMETRY_POSTGRES_DATABASE || "gernetix_telemetry",
      user: process.env.TELEMETRY_POSTGRES_USER || "gernetix_telemetry",
      password: requiredSecret(process.env.TELEMETRY_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(state);
    process.stdout.write(`${JSON.stringify({ sqlite_path: sourcePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("TELEMETRY_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Telemetry-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { hasTelemetryState, readLegacyTelemetryState, requiredSecret };
