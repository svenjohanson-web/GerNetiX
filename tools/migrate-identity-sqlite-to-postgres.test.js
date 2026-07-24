"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { readLegacyIdentityState, requiredSecret } = require("./migrate-identity-sqlite-to-postgres");

test("reads normalized identity collections from the legacy SQLite document store", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-identity-migration-"));
  const sqlitePath = path.join(root, "identity.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE service_documents (
      service_key TEXT NOT NULL,
      collection_name TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (service_key, collection_name, document_id)
    )
  `);
  db.prepare("INSERT INTO service_documents VALUES (?, ?, ?, ?, ?)").run(
    "identity-server",
    "user_accounts",
    "acct-1",
    JSON.stringify({ id: "acct-1", username: "maker" }),
    "2026-07-23T10:00:00.000Z",
  );
  db.close();

  const state = readLegacyIdentityState(sqlitePath);
  assert.equal(state.userAccounts[0].id, "acct-1");
  assert.deepEqual(state.sessions, []);
});

test("requires an explicit PostgreSQL secret", () => {
  assert.throws(() => requiredSecret(""), /IDENTITY_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});
