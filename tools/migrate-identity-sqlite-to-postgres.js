#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { PostgresIdentityRepository } = require("../services/identity-server/src/repositories/postgres-identity-repository");

const COLLECTIONS = {
  user_accounts: "userAccounts",
  local_credentials: "localCredentials",
  external_identities: "externalIdentities",
  verification_tokens: "verificationTokens",
  password_reset_tokens: "passwordResetTokens",
  offline_recovery_transactions: "offlineRecoveryTransactions",
  sessions: "sessions",
};

function readLegacyIdentityState(sqlitePath) {
  const state = Object.fromEntries(Object.values(COLLECTIONS).map((key) => [key, []]));
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return state;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const table = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='service_documents'",
    ).get();
    if (!table) return state;
    const rows = db.prepare(`
      SELECT collection_name, document_json
      FROM service_documents
      WHERE service_key='identity-server'
      ORDER BY collection_name, document_id
    `).all();
    for (const row of rows) {
      const target = COLLECTIONS[row.collection_name];
      if (target) state[target].push(JSON.parse(row.document_json));
    }
    return state;
  } finally {
    db.close();
  }
}

async function main() {
  const sqlitePath = process.env.IDENTITY_SQLITE_PATH || "/var/lib/gernetix/identity/gernetix-identity.sqlite";
  const repository = await PostgresIdentityRepository.create({
    poolOptions: {
      connectionString: process.env.IDENTITY_POSTGRES_URL || undefined,
      host: process.env.IDENTITY_POSTGRES_HOST || "identity-postgres",
      port: Number(process.env.IDENTITY_POSTGRES_PORT || 5432),
      database: process.env.IDENTITY_POSTGRES_DATABASE || "gernetix_runtime",
      user: process.env.IDENTITY_POSTGRES_USER || "gernetix_runtime",
      password: requiredSecret(process.env.IDENTITY_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(readLegacyIdentityState(sqlitePath));
    process.stdout.write(`${JSON.stringify({ sqlite_path: sqlitePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("IDENTITY_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Identity-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { COLLECTIONS, readLegacyIdentityState, requiredSecret };
