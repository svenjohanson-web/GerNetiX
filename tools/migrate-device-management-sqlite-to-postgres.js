#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const {
  PostgresDeviceManagementRepository,
} = require("../services/device-management-server/src/repositories/postgres-device-management-repository");

const TABLES = {
  device_management_devices: "devices",
  device_management_credentials: "credentials",
  device_management_challenges: "challenges",
  device_management_pairing_sessions: "pairingSessions",
  device_management_provisioning_tokens: "provisioningTokens",
  device_management_account_devices: "accountDevices",
  device_management_purchase_contexts: "purchaseContexts",
  device_management_consents: "consents",
  device_management_audit_events: "auditEvents",
};

function readLegacyDeviceManagementState(sqlitePath) {
  const state = Object.fromEntries(Object.values(TABLES).map((name) => [name, []]));
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return state;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    for (const [table, collection] of Object.entries(TABLES)) {
      if (!tableExists(db, table)) continue;
      state[collection] = db.prepare(`SELECT raw_json FROM ${table} ORDER BY rowid`)
        .all().map((row) => sanitize(collection, JSON.parse(row.raw_json)));
    }
    if (Object.values(state).some((items) => items.length > 0) || !tableExists(db, "service_documents")) {
      return state;
    }
    const collectionMap = {
      devices: "devices",
      credentials: "credentials",
      challenges: "challenges",
      pairing_sessions: "pairingSessions",
      provisioning_tokens: "provisioningTokens",
      account_devices: "accountDevices",
      purchase_contexts: "purchaseContexts",
      consents: "consents",
      audit_events: "auditEvents",
    };
    for (const row of db.prepare(`
      SELECT collection_name, document_json
      FROM service_documents
      WHERE service_key='device-management-server'
      ORDER BY collection_name, document_id
    `).all()) {
      const collection = collectionMap[row.collection_name];
      if (collection) state[collection].push(sanitize(collection, JSON.parse(row.document_json)));
    }
    return state;
  } finally {
    db.close();
  }
}

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

function sanitize(collection, value) {
  if (collection !== "credentials") return value;
  const credential = { ...value };
  for (const field of ["secret", "device_secret", "one_time_device_secret", "secret_sha256"]) delete credential[field];
  return credential;
}

async function main() {
  const sqlitePath = process.env.DEVICE_MANAGEMENT_SQLITE_PATH
    || process.env.PERSISTENCE_SQLITE_PATH
    || "/var/lib/gernetix/services/gernetix-services.sqlite";
  const repository = await PostgresDeviceManagementRepository.create({
    poolOptions: {
      connectionString: process.env.DEVICE_MANAGEMENT_POSTGRES_URL || undefined,
      host: process.env.DEVICE_MANAGEMENT_POSTGRES_HOST || "device-management-postgres",
      port: Number(process.env.DEVICE_MANAGEMENT_POSTGRES_PORT || 5432),
      database: process.env.DEVICE_MANAGEMENT_POSTGRES_DATABASE || "gernetix_device_management",
      user: process.env.DEVICE_MANAGEMENT_POSTGRES_USER || "gernetix_device_management",
      password: requiredSecret(process.env.DEVICE_MANAGEMENT_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(readLegacyDeviceManagementState(sqlitePath));
    process.stdout.write(`${JSON.stringify({ sqlite_path: sqlitePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("DEVICE_MANAGEMENT_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Device-Management-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { readLegacyDeviceManagementState, requiredSecret };
