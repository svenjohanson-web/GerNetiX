"use strict";

class PostgresTelemetryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresTelemetryRepository(pool);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS telemetry_measurements (
        measurement_id text PRIMARY KEY,
        account_id text NOT NULL,
        project_id text NOT NULL,
        device_id text NOT NULL,
        metric text NOT NULL,
        numeric_value double precision NOT NULL,
        unit text NOT NULL,
        aggregation text NOT NULL,
        measured_at timestamptz NOT NULL,
        received_at timestamptz NOT NULL,
        metadata_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_measurements_account_project_time
        ON telemetry_measurements (account_id, project_id, measured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_telemetry_measurements_device_metric_time
        ON telemetry_measurements (device_id, metric, measured_at DESC);

      CREATE TABLE IF NOT EXISTS telemetry_events (
        event_id text PRIMARY KEY,
        account_id text NOT NULL,
        project_id text NOT NULL,
        device_id text NOT NULL,
        event_type text NOT NULL,
        severity text NOT NULL,
        title text NOT NULL,
        body text NOT NULL,
        notify_push boolean NOT NULL DEFAULT false,
        occurred_at timestamptz NOT NULL,
        received_at timestamptz NOT NULL,
        metadata_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_events_account_project_time
        ON telemetry_events (account_id, project_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS telemetry_retention_policies (
        account_id text NOT NULL,
        project_id text NOT NULL,
        measurement_retention_days integer NOT NULL,
        event_retention_days integer NOT NULL,
        updated_at timestamptz NOT NULL,
        PRIMARY KEY (account_id, project_id)
      );

      CREATE TABLE IF NOT EXISTS telemetry_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async saveBatch({ measurements = [], events = [] }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of measurements) {
        await insertMeasurement(client, item);
      }
      for (const item of events) {
        await insertEvent(client, item);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listMeasurements(accountId, projectId, query = {}) {
    const { sql, values } = filteredQuery({
      table: "telemetry_measurements",
      accountId,
      projectId,
      query,
      timeColumn: "measured_at",
      metric: true,
    });
    return (await this.pool.query(sql, values)).rows.map(measurementRow);
  }

  async listEvents(accountId, projectId, query = {}) {
    const { sql, values } = filteredQuery({
      table: "telemetry_events",
      accountId,
      projectId,
      query,
      timeColumn: "occurred_at",
    });
    return (await this.pool.query(sql, values)).rows.map(eventRow);
  }

  async setRetentionPolicy(accountId, projectId, policy) {
    await this.pool.query(`
      INSERT INTO telemetry_retention_policies
        (account_id, project_id, measurement_retention_days, event_retention_days, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (account_id, project_id) DO UPDATE SET
        measurement_retention_days=EXCLUDED.measurement_retention_days,
        event_retention_days=EXCLUDED.event_retention_days,
        updated_at=EXCLUDED.updated_at
    `, [accountId, projectId, policy.measurement_retention_days, policy.event_retention_days]);
    return this.getRetentionPolicy(accountId, projectId);
  }

  async getRetentionPolicy(accountId, projectId) {
    return (await this.pool.query(
      "SELECT * FROM telemetry_retention_policies WHERE account_id=$1 AND project_id=$2",
      [accountId, projectId],
    )).rows[0] || null;
  }

  async deleteProjectData(accountId, projectId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const measurements = await client.query(
        "DELETE FROM telemetry_measurements WHERE account_id=$1 AND project_id=$2",
        [accountId, projectId],
      );
      const events = await client.query(
        "DELETE FROM telemetry_events WHERE account_id=$1 AND project_id=$2",
        [accountId, projectId],
      );
      await client.query(
        "DELETE FROM telemetry_retention_policies WHERE account_id=$1 AND project_id=$2",
        [accountId, projectId],
      );
      await client.query("COMMIT");
      return { measurements_deleted: measurements.rowCount, events_deleted: events.rowCount };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async prune(defaultMeasurementDays, defaultEventDays, now = new Date()) {
    const result = await this.pool.query(`
      WITH deleted_measurements AS (
        DELETE FROM telemetry_measurements m
        WHERE m.measured_at < ($1::timestamptz - make_interval(days =>
          COALESCE((
            SELECT p.measurement_retention_days
            FROM telemetry_retention_policies p
            WHERE p.account_id=m.account_id AND p.project_id=m.project_id
          ), $2::integer)
        ))
        RETURNING 1
      ), deleted_events AS (
        DELETE FROM telemetry_events e
        WHERE e.occurred_at < ($1::timestamptz - make_interval(days =>
          COALESCE((
            SELECT p.event_retention_days
            FROM telemetry_retention_policies p
            WHERE p.account_id=e.account_id AND p.project_id=e.project_id
          ), $3::integer)
        ))
        RETURNING 1
      )
      SELECT
        (SELECT count(*) FROM deleted_measurements)::integer AS measurements_deleted,
        (SELECT count(*) FROM deleted_events)::integer AS events_deleted
    `, [now.toISOString(), defaultMeasurementDays, defaultEventDays]);
    return { ...result.rows[0], executed_at: now.toISOString() };
  }

  async hasMigration(migrationId) {
    return (await this.pool.query(
      "SELECT 1 FROM telemetry_migrations WHERE migration_id=$1",
      [migrationId],
    )).rowCount > 0;
  }

  async importLegacyState(state, migrationId = "telemetry-sqlite-v1") {
    if (await this.hasMigration(migrationId)) return { imported: false, reason: "already_applied" };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(`
        SELECT
          (SELECT count(*) FROM telemetry_measurements)
          + (SELECT count(*) FROM telemetry_events)
          + (SELECT count(*) FROM telemetry_retention_policies) AS count
      `);
      if (Number(existing.rows[0].count) > 0) throw new Error("TELEMETRY_POSTGRES_NOT_EMPTY");
      for (const item of state.measurements || []) await insertMeasurement(client, item);
      for (const item of state.events || []) await insertEvent(client, item);
      for (const policy of state.retentionPolicies || []) {
        await client.query(`
          INSERT INTO telemetry_retention_policies
            (account_id, project_id, measurement_retention_days, event_retention_days, updated_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          policy.account_id,
          policy.project_id,
          policy.measurement_retention_days,
          policy.event_retention_days,
          policy.updated_at,
        ]);
      }
      await client.query("INSERT INTO telemetry_migrations (migration_id) VALUES ($1)", [migrationId]);
      await client.query("COMMIT");
      return {
        imported: true,
        measurements: (state.measurements || []).length,
        events: (state.events || []).length,
        retention_policies: (state.retentionPolicies || []).length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

async function insertMeasurement(client, item) {
  await client.query(`
    INSERT INTO telemetry_measurements
      (measurement_id, account_id, project_id, device_id, metric, numeric_value, unit,
       aggregation, measured_at, received_at, metadata_json)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (measurement_id) DO NOTHING
  `, [
    item.measurement_id, item.account_id, item.project_id, item.device_id, item.metric,
    item.value ?? item.numeric_value, item.unit, item.aggregation, item.measured_at,
    item.received_at, item.metadata || item.metadata_json || {},
  ]);
}

async function insertEvent(client, item) {
  await client.query(`
    INSERT INTO telemetry_events
      (event_id, account_id, project_id, device_id, event_type, severity, title, body,
       notify_push, occurred_at, received_at, metadata_json)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (event_id) DO NOTHING
  `, [
    item.event_id, item.account_id, item.project_id, item.device_id, item.event_type,
    item.severity, item.title, item.body, Boolean(item.notify_push), item.occurred_at,
    item.received_at, item.metadata || item.metadata_json || {},
  ]);
}

function filteredQuery({ table, accountId, projectId, query, timeColumn, metric = false }) {
  const clauses = ["account_id=$1", "project_id=$2"];
  const values = [accountId, projectId];
  for (const [field, value] of [
    ["device_id", query.device_id],
    ...(metric ? [["metric", query.metric]] : []),
  ]) {
    if (value) {
      values.push(value);
      clauses.push(`${field}=$${values.length}`);
    }
  }
  if (query.from) {
    values.push(query.from);
    clauses.push(`${timeColumn}>=$${values.length}`);
  }
  if (query.to) {
    values.push(query.to);
    clauses.push(`${timeColumn}<=$${values.length}`);
  }
  values.push(limit(query.limit));
  return {
    sql: `SELECT * FROM ${table} WHERE ${clauses.join(" AND ")} ORDER BY ${timeColumn} DESC LIMIT $${values.length}`,
    values,
  };
}

function measurementRow(row) {
  const { numeric_value: numericValue, metadata_json: metadata, ...rest } = row;
  return { ...rest, value: Number(numericValue), numeric_value: Number(numericValue), metadata };
}

function eventRow(row) {
  const { metadata_json: metadata, ...rest } = row;
  return { ...rest, notify_push: Boolean(row.notify_push), metadata };
}

function limit(value) {
  return Math.max(1, Math.min(1000, Number(value) || 200));
}

module.exports = { PostgresTelemetryRepository };
