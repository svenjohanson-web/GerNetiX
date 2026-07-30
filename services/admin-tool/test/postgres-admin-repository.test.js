"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresAdminRepository } = require("../src/repositories/postgres-admin-repository");

test("creates Operations tables for audit and interface telemetry", async () => {
  const pool = new RecordingPool();
  await new PostgresAdminRepository(pool).ensureSchema();
  assert.match(pool.calls[0].text, /operations_system_events/);
  assert.match(pool.calls[0].text, /operations_audit_events/);
  assert.match(pool.calls[0].text, /operations_interface_calls/);
  assert.match(pool.calls[0].text, /operations_link_targets/);
  assert.match(pool.calls[0].text, /operations_link_occurrences/);
  assert.match(pool.calls[0].text, /operations_link_checks/);
  assert.match(pool.calls[0].text, /operations_migrations/);
});

test("filters system events in PostgreSQL", async () => {
  const event = { event_id: "event-1", severity: "error" };
  const pool = new RecordingPool([{ raw_json: event }]);
  const items = await new PostgresAdminRepository(pool).listSystemEvents({
    severity: "error", source_service: "identity-server",
  });
  assert.deepEqual(items, [event]);
  assert.deepEqual(pool.calls[0].values, ["error", "identity-server"]);
});

class RecordingPool {
  constructor(rows = []) { this.rows = rows; this.calls = []; }
  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: this.rows, rowCount: this.rows.length };
  }
}
