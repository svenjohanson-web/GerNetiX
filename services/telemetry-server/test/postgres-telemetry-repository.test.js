const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresTelemetryRepository } = require("../src/repositories/postgres-telemetry-repository");

test("creates partitionable telemetry PostgreSQL tables and indexes", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresTelemetryRepository(pool);
  await repository.ensureSchema();
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS telemetry_measurements/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS telemetry_events/);
  assert.match(pool.calls[0].text, /telemetry_retention_policies/);
  assert.match(pool.calls[0].text, /telemetry_migrations/);
});

test("queries telemetry by server-derived account and project", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresTelemetryRepository(pool);
  await repository.listMeasurements("acct-1", "project-1", { metric: "temperature", limit: 50 });
  assert.match(pool.calls[0].text, /account_id=\$1 AND project_id=\$2/);
  assert.deepEqual(pool.calls[0].values, ["acct-1", "project-1", "temperature", 50]);
});

class RecordingPool {
  constructor() {
    this.calls = [];
  }
  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 0 };
  }
}
