const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

class SqliteTelemetryRepository {
  constructor(sqlitePath) {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    this.db = new DatabaseSync(sqlitePath);
    this.db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_measurements (
        measurement_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        metric TEXT NOT NULL,
        numeric_value REAL NOT NULL,
        unit TEXT NOT NULL,
        aggregation TEXT NOT NULL,
        measured_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_measurements_account_project_time
        ON telemetry_measurements (account_id, project_id, measured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_telemetry_measurements_device_metric_time
        ON telemetry_measurements (device_id, metric, measured_at DESC);
      CREATE TABLE IF NOT EXISTS telemetry_events (
        event_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        notify_push INTEGER NOT NULL DEFAULT 0,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_events_account_project_time
        ON telemetry_events (account_id, project_id, occurred_at DESC);
      CREATE TABLE IF NOT EXISTS telemetry_retention_policies (
        account_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        measurement_retention_days INTEGER NOT NULL,
        event_retention_days INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, project_id)
      );
    `);
    this.insertMeasurement = this.db.prepare(`INSERT OR IGNORE INTO telemetry_measurements
      (measurement_id, account_id, project_id, device_id, metric, numeric_value, unit, aggregation, measured_at, received_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.insertEvent = this.db.prepare(`INSERT OR IGNORE INTO telemetry_events
      (event_id, account_id, project_id, device_id, event_type, severity, title, body, notify_push, occurred_at, received_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  }

  saveBatch({ measurements = [], events = [] }) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const item of measurements) this.insertMeasurement.run(item.measurement_id, item.account_id, item.project_id, item.device_id, item.metric, item.value, item.unit, item.aggregation, item.measured_at, item.received_at, JSON.stringify(item.metadata || {}));
      for (const item of events) this.insertEvent.run(item.event_id, item.account_id, item.project_id, item.device_id, item.event_type, item.severity, item.title, item.body, item.notify_push ? 1 : 0, item.occurred_at, item.received_at, JSON.stringify(item.metadata || {}));
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  listMeasurements(accountId, projectId, query = {}) {
    const clauses = ["account_id = ?", "project_id = ?"];
    const params = [accountId, projectId];
    if (query.device_id) { clauses.push("device_id = ?"); params.push(query.device_id); }
    if (query.metric) { clauses.push("metric = ?"); params.push(query.metric); }
    if (query.from) { clauses.push("measured_at >= ?"); params.push(query.from); }
    if (query.to) { clauses.push("measured_at <= ?"); params.push(query.to); }
    params.push(limit(query.limit));
    return this.db.prepare(`SELECT * FROM telemetry_measurements WHERE ${clauses.join(" AND ")} ORDER BY measured_at DESC LIMIT ?`).all(...params).map(measurementRow);
  }

  listEvents(accountId, projectId, query = {}) {
    const clauses = ["account_id = ?", "project_id = ?"];
    const params = [accountId, projectId];
    if (query.device_id) { clauses.push("device_id = ?"); params.push(query.device_id); }
    if (query.from) { clauses.push("occurred_at >= ?"); params.push(query.from); }
    if (query.to) { clauses.push("occurred_at <= ?"); params.push(query.to); }
    params.push(limit(query.limit));
    return this.db.prepare(`SELECT * FROM telemetry_events WHERE ${clauses.join(" AND ")} ORDER BY occurred_at DESC LIMIT ?`).all(...params).map(eventRow);
  }

  setRetentionPolicy(accountId, projectId, policy) {
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO telemetry_retention_policies (account_id, project_id, measurement_retention_days, event_retention_days, updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id, project_id) DO UPDATE SET measurement_retention_days = excluded.measurement_retention_days, event_retention_days = excluded.event_retention_days, updated_at = excluded.updated_at`)
      .run(accountId, projectId, policy.measurement_retention_days, policy.event_retention_days, now);
    return this.getRetentionPolicy(accountId, projectId);
  }

  getRetentionPolicy(accountId, projectId) {
    return this.db.prepare("SELECT * FROM telemetry_retention_policies WHERE account_id = ? AND project_id = ?").get(accountId, projectId) || null;
  }

  deleteProjectData(accountId, projectId) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const measurements = this.db.prepare("DELETE FROM telemetry_measurements WHERE account_id = ? AND project_id = ?").run(accountId, projectId).changes;
      const events = this.db.prepare("DELETE FROM telemetry_events WHERE account_id = ? AND project_id = ?").run(accountId, projectId).changes;
      this.db.prepare("DELETE FROM telemetry_retention_policies WHERE account_id = ? AND project_id = ?").run(accountId, projectId);
      this.db.exec("COMMIT");
      return { measurements_deleted: measurements, events_deleted: events };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  prune(defaultMeasurementDays, defaultEventDays, now = new Date()) {
    const policies = this.db.prepare("SELECT * FROM telemetry_retention_policies").all();
    let measurements = 0; let events = 0;
    for (const policy of policies) {
      measurements += this.db.prepare("DELETE FROM telemetry_measurements WHERE account_id = ? AND project_id = ? AND measured_at < ?").run(policy.account_id, policy.project_id, cutoff(policy.measurement_retention_days, now)).changes;
      events += this.db.prepare("DELETE FROM telemetry_events WHERE account_id = ? AND project_id = ? AND occurred_at < ?").run(policy.account_id, policy.project_id, cutoff(policy.event_retention_days, now)).changes;
    }
    measurements += this.db.prepare(`DELETE FROM telemetry_measurements WHERE measured_at < ? AND NOT EXISTS (SELECT 1 FROM telemetry_retention_policies p WHERE p.account_id = telemetry_measurements.account_id AND p.project_id = telemetry_measurements.project_id)`).run(cutoff(defaultMeasurementDays, now)).changes;
    events += this.db.prepare(`DELETE FROM telemetry_events WHERE occurred_at < ? AND NOT EXISTS (SELECT 1 FROM telemetry_retention_policies p WHERE p.account_id = telemetry_events.account_id AND p.project_id = telemetry_events.project_id)`).run(cutoff(defaultEventDays, now)).changes;
    return { measurements_deleted: measurements, events_deleted: events, executed_at: now.toISOString() };
  }

  close() { this.db.close(); }
}

function cutoff(days, now) { return new Date(now.getTime() - Number(days) * 86400000).toISOString(); }
function limit(value) { return Math.max(1, Math.min(1000, Number(value) || 200)); }
function measurementRow(row) { return { ...row, value: row.numeric_value, metadata: JSON.parse(row.metadata_json) }; }
function eventRow(row) { return { ...row, notify_push: Boolean(row.notify_push), metadata: JSON.parse(row.metadata_json) }; }

module.exports = { SqliteTelemetryRepository };
