"use strict";

const crypto = require("node:crypto");

class PostgresAdminRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresAdminRepository(pool);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS operations_consents (
        consent_id text PRIMARY KEY, account_id text NOT NULL, granted_to_role text NOT NULL,
        purpose text NOT NULL, valid_until timestamptz NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_consents_lookup
        ON operations_consents (account_id, granted_to_role, purpose, valid_until);
      CREATE TABLE IF NOT EXISTS operations_audit_events (
        audit_event_id text PRIMARY KEY, occurred_at timestamptz NOT NULL,
        account_id text, actor_id text, actor_role text, raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_audit_account_time
        ON operations_audit_events (account_id, occurred_at DESC);
      CREATE TABLE IF NOT EXISTS operations_admin_actions (
        action_id text PRIMARY KEY, occurred_at timestamptz NOT NULL,
        account_id text, action_type text NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS operations_system_events (
        event_id text PRIMARY KEY, occurred_at timestamptz NOT NULL,
        severity text NOT NULL, source_service text NOT NULL, target_service text NOT NULL,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_system_events_time
        ON operations_system_events (occurred_at DESC);
      CREATE TABLE IF NOT EXISTS operations_interface_calls (
        call_id bigserial PRIMARY KEY, occurred_at timestamptz NOT NULL,
        source_service text NOT NULL, target_service text NOT NULL, method text NOT NULL,
        route text NOT NULL, status_code integer NOT NULL, duration_ms integer NOT NULL,
        succeeded boolean NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_interface_calls_time
        ON operations_interface_calls (occurred_at DESC);
      CREATE TABLE IF NOT EXISTS operations_legacy_snapshots (
        snapshot_type text NOT NULL, snapshot_id text NOT NULL, raw_json jsonb NOT NULL,
        PRIMARY KEY (snapshot_type, snapshot_id)
      );
      CREATE TABLE IF NOT EXISTS operations_migrations (
        migration_id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async listDevices() { return this.listSnapshots("device"); }
  async findDevice(id) { return this.findSnapshot("device", id); }
  async listFeedback() { return this.listSnapshots("feedback"); }
  async listAiUsageEvents() { return this.listSnapshots("ai_usage_event"); }

  async createConsent(input) {
    const now = new Date().toISOString();
    const consent = {
      consent_id: createId("consent"), account_id: input.account_id,
      granted_by_account_id: input.granted_by_account_id || input.account_id,
      granted_to_role: input.granted_to_role, purpose: input.purpose,
      scope: input.scope || "customer_data", valid_from: input.valid_from || now,
      valid_until: input.valid_until, revoked_at: null, created_at: now,
    };
    await this.saveConsent(consent);
    return consent;
  }

  async saveConsent(consent) {
    await this.pool.query(`
      INSERT INTO operations_consents
        (consent_id, account_id, granted_to_role, purpose, valid_until, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (consent_id) DO UPDATE SET raw_json=EXCLUDED.raw_json,
        valid_until=EXCLUDED.valid_until
    `, [consent.consent_id, consent.account_id, consent.granted_to_role,
      consent.purpose, consent.valid_until, consent]);
    return clone(consent);
  }

  async revokeConsent(consentId) {
    const current = await this.findConsent(consentId);
    if (!current) return null;
    const consent = { ...current, revoked_at: new Date().toISOString() };
    await this.saveConsent(consent);
    return consent;
  }

  async findConsent(consentId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM operations_consents WHERE consent_id=$1", [consentId],
    ));
  }

  async findValidConsent({ accountId, role, purpose, at = new Date() }) {
    return first(await this.pool.query(`
      SELECT raw_json FROM operations_consents
      WHERE account_id=$1 AND granted_to_role IN ($2, 'any_internal_role')
        AND purpose=$3 AND (raw_json->>'revoked_at') IS NULL
        AND (raw_json->>'valid_from')::timestamptz <= $4
        AND valid_until > $4
      ORDER BY valid_until DESC LIMIT 1
    `, [accountId, role, purpose, at.toISOString()]));
  }

  async addAuditEvent(event) {
    const value = {
      audit_event_id: event.audit_event_id || createId("audit"),
      occurred_at: event.occurred_at || new Date().toISOString(),
      ...event,
    };
    await this.pool.query(`
      INSERT INTO operations_audit_events
        (audit_event_id, occurred_at, account_id, actor_id, actor_role, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (audit_event_id) DO NOTHING
    `, [value.audit_event_id, value.occurred_at, value.account_id || null,
      value.actor_id || null, value.actor_role || null, value]);
    return clone(value);
  }

  async listAuditEvents(filter = {}) {
    const result = filter.account_id
      ? await this.pool.query("SELECT raw_json FROM operations_audit_events WHERE account_id=$1 ORDER BY occurred_at DESC", [filter.account_id])
      : await this.pool.query("SELECT raw_json FROM operations_audit_events ORDER BY occurred_at DESC");
    return rows(result);
  }

  async addAdminAction(action) {
    const value = {
      action_id: action.action_id || createId("admin_action"),
      occurred_at: action.occurred_at || new Date().toISOString(),
      ...action,
    };
    await this.saveAdminAction(value);
    await this.addAuditEvent({
      actor_id: action.actor_id, actor_role: action.actor_role,
      accessed_data_model_id: "data_model.ai_admin_action_audit_event",
      purpose: "ai_cost_control", account_id: action.account_id || null,
      access_decision: "full", reason: action.action_type,
    });
    return clone(value);
  }

  async saveAdminAction(value) {
    await this.pool.query(`
      INSERT INTO operations_admin_actions
        (action_id, occurred_at, account_id, action_type, raw_json)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (action_id) DO NOTHING
    `, [value.action_id, value.occurred_at, value.account_id || null, value.action_type, value]);
    return clone(value);
  }

  async addSystemEvent(input) {
    const value = {
      event_id: input.event_id || createId("system_event"),
      occurred_at: input.occurred_at || new Date().toISOString(),
      severity: input.severity || "info", source_service: input.source_service || "unknown",
      target_service: input.target_service || "", category: input.category || "runtime",
      event_type: input.event_type || "notice", message: input.message || "",
      impact: input.impact || "", account_id: input.account_id || null,
      route: input.route || "", correlation_id: input.correlation_id || "",
      details: input.details || {},
    };
    await this.pool.query(`
      INSERT INTO operations_system_events
        (event_id, occurred_at, severity, source_service, target_service, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (event_id) DO NOTHING
    `, [value.event_id, value.occurred_at, value.severity, value.source_service,
      value.target_service, value]);
    return clone(value);
  }

  async listSystemEvents(filter = {}) {
    const conditions = [];
    const values = [];
    for (const field of ["severity", "source_service", "target_service"]) {
      if (!filter[field]) continue;
      values.push(filter[field]);
      conditions.push(`${field}=$${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM operations_system_events${where} ORDER BY occurred_at DESC`,
      values,
    ));
  }

  async addInterfaceCall(input) {
    await this.pool.query(`
      INSERT INTO operations_interface_calls
        (occurred_at, source_service, target_service, method, route,
         status_code, duration_ms, succeeded)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [input.occurred_at || new Date().toISOString(), input.source_service,
      input.target_service, input.method, input.route, Number(input.status_code || 0),
      Number(input.duration_ms || 0), Boolean(input.succeeded)]);
  }

  async saveSnapshot(type, id, value) {
    await this.pool.query(`
      INSERT INTO operations_legacy_snapshots (snapshot_type, snapshot_id, raw_json)
      VALUES ($1,$2,$3) ON CONFLICT (snapshot_type, snapshot_id)
      DO UPDATE SET raw_json=EXCLUDED.raw_json
    `, [type, id, value]);
  }

  async listSnapshots(type) {
    return rows(await this.pool.query(
      "SELECT raw_json FROM operations_legacy_snapshots WHERE snapshot_type=$1 ORDER BY snapshot_id",
      [type],
    ));
  }

  async findSnapshot(type, id) {
    return first(await this.pool.query(
      "SELECT raw_json FROM operations_legacy_snapshots WHERE snapshot_type=$1 AND snapshot_id=$2",
      [type, id],
    ));
  }

  async importLegacyState(state, migrationId = "operations-sqlite-v1") {
    const client = typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      const applied = await client.query("SELECT 1 FROM operations_migrations WHERE migration_id=$1", [migrationId]);
      if (applied.rowCount) {
        await client.query("ROLLBACK");
        return { imported: false, reason: "already_applied" };
      }
      const occupied = await client.query(`
        SELECT (SELECT count(*) FROM operations_consents)
          + (SELECT count(*) FROM operations_audit_events)
          + (SELECT count(*) FROM operations_admin_actions)
          + (SELECT count(*) FROM operations_system_events)
          + (SELECT count(*) FROM operations_interface_calls)
          + (SELECT count(*) FROM operations_legacy_snapshots) AS count
      `);
      if (Number(occupied.rows[0]?.count || 0) > 0) throw new Error("Operations-PostgreSQL-Ziel ist belegt, aber der Migrationsmarker fehlt.");
      const repository = new PostgresAdminRepository(client);
      for (const item of state.devices || []) await repository.saveSnapshot("device", item.device_id, item);
      for (const item of state.feedback || []) await repository.saveSnapshot("feedback", item.feedback_id, item);
      for (const item of state.aiUsageEvents || []) await repository.saveSnapshot("ai_usage_event", item.event_id, item);
      for (const item of state.consents || []) await repository.saveConsent(item);
      for (const item of state.auditEvents || []) await repository.addAuditEvent(item);
      for (const item of state.adminActions || []) await repository.saveAdminAction(item);
      for (const item of state.systemEvents || []) await repository.addSystemEvent(item);
      for (const item of state.interfaceCalls || []) await repository.addInterfaceCall(item);
      await client.query("INSERT INTO operations_migrations (migration_id) VALUES ($1)", [migrationId]);
      await client.query("COMMIT");
      return { imported: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      if (client !== this.pool) client.release();
    }
  }

  async close() { await this.pool.end(); }
}

function createId(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function rows(result) { return result.rows.map((row) => clone(row.raw_json)); }
function first(result) { return result.rows[0] ? clone(result.rows[0].raw_json) : null; }

module.exports = { PostgresAdminRepository };
