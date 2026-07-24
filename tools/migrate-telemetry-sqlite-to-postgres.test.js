const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  hasTelemetryState,
  readLegacyTelemetryState,
  requiredSecret,
} = require("./migrate-telemetry-sqlite-to-postgres");

test("reads telemetry measurements, events and retention from SQLite", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "telemetry-migration-")), "telemetry.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE telemetry_measurements (
      measurement_id TEXT, account_id TEXT, project_id TEXT, device_id TEXT, metric TEXT,
      numeric_value REAL, unit TEXT, aggregation TEXT, measured_at TEXT, received_at TEXT,
      metadata_json TEXT
    );
    CREATE TABLE telemetry_events (
      event_id TEXT, account_id TEXT, project_id TEXT, device_id TEXT, event_type TEXT,
      severity TEXT, title TEXT, body TEXT, notify_push INTEGER, occurred_at TEXT,
      received_at TEXT, metadata_json TEXT
    );
    CREATE TABLE telemetry_retention_policies (
      account_id TEXT, project_id TEXT, measurement_retention_days INTEGER,
      event_retention_days INTEGER, updated_at TEXT
    );
  `);
  db.prepare("INSERT INTO telemetry_measurements VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
    "m1", "a1", "p1", "d1", "temperature", 21.5, "C", "sample",
    "2026-07-24T10:00:00Z", "2026-07-24T10:00:01Z", '{"sensor":"inside"}',
  );
  db.prepare("INSERT INTO telemetry_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "e1", "a1", "p1", "d1", "threshold", "warning", "Warm", "31 C", 1,
    "2026-07-24T10:00:00Z", "2026-07-24T10:00:01Z", "{}",
  );
  db.prepare("INSERT INTO telemetry_retention_policies VALUES (?,?,?,?,?)").run(
    "a1", "p1", 30, 90, "2026-07-24T10:00:00Z",
  );
  db.close();

  const state = readLegacyTelemetryState(sqlitePath);
  assert.equal(state.measurements[0].value, 21.5);
  assert.deepEqual(state.measurements[0].metadata, { sensor: "inside" });
  assert.equal(state.events[0].notify_push, true);
  assert.equal(state.retentionPolicies[0].event_retention_days, 90);
});

test("requires a telemetry PostgreSQL password", () => {
  assert.throws(() => requiredSecret(""), /TELEMETRY_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});

test("does not treat a policy-only database as the authoritative telemetry source", () => {
  assert.equal(hasTelemetryState({ measurements: [], events: [], retentionPolicies: [{ project_id: "p1" }] }), false);
  assert.equal(hasTelemetryState({ measurements: [{ measurement_id: "m1" }], events: [], retentionPolicies: [] }), true);
});
