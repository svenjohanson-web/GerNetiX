"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { readLegacyOperationsState, requiredSecret } = require("./migrate-operations-sqlite-to-postgres");

test("reads Admin events and interface calls from the shared SQLite", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "operations-migration-")), "legacy.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE service_documents (service_key TEXT, collection_name TEXT, document_id TEXT, document_json TEXT);
    CREATE TABLE gernetix_external_interface_calls (
      call_id INTEGER PRIMARY KEY, occurred_at TEXT, source_service TEXT, target_service TEXT,
      method TEXT, route TEXT, status_code INTEGER, duration_ms INTEGER, succeeded INTEGER
    );
  `);
  db.prepare("INSERT INTO service_documents VALUES (?,?,?,?)").run(
    "admin-tool", "system_events", "event-1",
    JSON.stringify({ event_id: "event-1", source_service: "identity-server", severity: "error" }),
  );
  db.prepare("INSERT INTO gernetix_external_interface_calls VALUES (1,?,?,?,?,?,?,?,?)").run(
    "2026-07-25T00:00:00.000Z", "identity-server", "project-server", "GET",
    "/health", 200, 12, 1,
  );
  db.close();
  const state = readLegacyOperationsState(sqlitePath);
  assert.equal(state.systemEvents[0].event_id, "event-1");
  assert.equal(state.interfaceCalls[0].succeeded, true);
});

test("requires an Operations PostgreSQL password", () => {
  assert.throws(() => requiredSecret(""), /OPERATIONS_POSTGRES_PASSWORD/);
});
