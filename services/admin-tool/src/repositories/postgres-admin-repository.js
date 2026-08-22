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
      CREATE TABLE IF NOT EXISTS operations_user_action_events (
        event_id text PRIMARY KEY, occurred_at timestamptz NOT NULL,
        action_type text NOT NULL, action_id uuid NOT NULL,
        span_type text NOT NULL, span_id uuid NOT NULL, parent_span_id uuid,
        parent_action_id uuid,
        phase text NOT NULL, reason_code text NOT NULL, route_id text NOT NULL,
        release_id text NOT NULL, duration_bucket text NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_user_actions_type_time
        ON operations_user_action_events (action_type, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_operations_user_actions_action
        ON operations_user_action_events (action_id, occurred_at);
      CREATE TABLE IF NOT EXISTS operations_user_action_incidents (
        incident_id uuid PRIMARY KEY, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
        action_id uuid NOT NULL, action_type text NOT NULL, reason_code text NOT NULL,
        release_id text NOT NULL, status text NOT NULL, owner text NOT NULL,
        runbook_url text NOT NULL, fix_release_id text NOT NULL, note text NOT NULL,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_user_action_incidents_status
        ON operations_user_action_incidents (status, updated_at DESC);
      CREATE TABLE IF NOT EXISTS operations_user_action_alerts (
        alert_key text PRIMARY KEY, first_seen_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL,
        action_type text NOT NULL, release_id text NOT NULL, reason_code text NOT NULL,
        alert_kind text NOT NULL, severity text NOT NULL, status text NOT NULL,
        notification_state text NOT NULL, attempts integer NOT NULL, failures integer NOT NULL,
        failure_rate_percent numeric NOT NULL, hanging integer NOT NULL, window_hours integer NOT NULL,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_user_action_alerts_status
        ON operations_user_action_alerts (status, last_seen_at DESC);
      CREATE TABLE IF NOT EXISTS operations_synthetic_check_results (
        result_id uuid PRIMARY KEY, run_id uuid NOT NULL, checked_at timestamptz NOT NULL,
        check_id text NOT NULL, target_service text NOT NULL, route text NOT NULL,
        status text NOT NULL, http_status integer, response_ms integer NOT NULL,
        reason_code text NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_synthetic_checks_run
        ON operations_synthetic_check_results (run_id, checked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_operations_synthetic_checks_latest
        ON operations_synthetic_check_results (check_id, checked_at DESC);
      CREATE TABLE IF NOT EXISTS operations_interface_calls (
        call_id bigserial PRIMARY KEY, occurred_at timestamptz NOT NULL,
        source_service text NOT NULL, target_service text NOT NULL, method text NOT NULL,
        route text NOT NULL, status_code integer NOT NULL, duration_ms integer NOT NULL,
        succeeded boolean NOT NULL, action_id uuid, action_type text
      );
      ALTER TABLE operations_interface_calls ADD COLUMN IF NOT EXISTS action_id uuid;
      ALTER TABLE operations_interface_calls ADD COLUMN IF NOT EXISTS action_type text;
      CREATE INDEX IF NOT EXISTS idx_operations_interface_calls_time
        ON operations_interface_calls (occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_operations_interface_calls_action
        ON operations_interface_calls (action_id, occurred_at DESC);
      CREATE TABLE IF NOT EXISTS operations_link_targets (
        reference_id text PRIMARY KEY, target_url text NOT NULL, link_type text NOT NULL,
        owner_domain text NOT NULL, access_scope text NOT NULL, source_service text NOT NULL,
        active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_link_targets_status
        ON operations_link_targets (active, link_type, access_scope);
      CREATE TABLE IF NOT EXISTS operations_link_occurrences (
        occurrence_id text PRIMARY KEY, reference_id text NOT NULL REFERENCES operations_link_targets(reference_id),
        source_service text NOT NULL, source_location text NOT NULL, source_route text,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_link_occurrences_reference
        ON operations_link_occurrences (reference_id);
      CREATE TABLE IF NOT EXISTS operations_link_checks (
        check_id text PRIMARY KEY, reference_id text NOT NULL REFERENCES operations_link_targets(reference_id),
        checked_at timestamptz NOT NULL, status text NOT NULL, http_status integer,
        access_profile text NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_link_checks_latest
        ON operations_link_checks (reference_id, checked_at DESC);
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

  async addUserActionEvent(value) {
    await this.pool.query(`
      INSERT INTO operations_user_action_events
        (event_id, occurred_at, action_type, action_id, span_type, span_id,
         parent_span_id, parent_action_id, phase, reason_code, route_id, release_id,
         duration_bucket, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (event_id) DO NOTHING
    `, [value.event_id, value.occurred_at, value.action_type, value.action_id,
      value.span_type, value.span_id, value.parent_span_id || null, value.parent_action_id || null,
      value.phase, value.reason_code || "", value.route_id, value.release_id || "",
      value.duration_bucket || "", value]);
    return clone(value);
  }

  async listUserActionEvents(filter = {}) {
    const conditions = [];
    const values = [];
    for (const field of ["action_id", "action_type", "phase"]) {
      if (!filter[field]) continue;
      values.push(filter[field]);
      conditions.push(`${field}=$${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    values.push(Math.max(1, Math.min(1000, Number(filter.limit) || 200)));
    return rows(await this.pool.query(
      `SELECT raw_json FROM operations_user_action_events${where} ORDER BY occurred_at DESC LIMIT $${values.length}`, values,
    ));
  }

  async userActionOperationAggregates(filter = {}) {
    const hours = Math.max(1, Math.min(24 * 90, Number(filter.hours) || 24));
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 50));
    const result = await this.pool.query(`
      WITH filtered AS (
        SELECT * FROM operations_user_action_events
        WHERE occurred_at >= now() - make_interval(hours => $1::int)
      ), attempts AS (
        SELECT action_id,
          (array_agg(action_type ORDER BY occurred_at DESC))[1] AS action_type,
          (array_agg(release_id ORDER BY occurred_at DESC))[1] AS release_id,
          (array_agg(route_id ORDER BY occurred_at DESC))[1] AS route_id,
          min(occurred_at) AS started_at, max(occurred_at) AS last_seen_at,
          (array_agg(phase ORDER BY occurred_at DESC))[1] AS phase,
          coalesce((array_agg(reason_code ORDER BY occurred_at DESC)
            FILTER (WHERE phase IN ('failed','timed_out','unhandled')))[1], '') AS reason_code,
          coalesce((array_agg(span_type ORDER BY occurred_at DESC)
            FILTER (WHERE phase IN ('failed','timed_out','unhandled')))[1], '') AS failed_span,
          count(*)::int AS event_count, count(DISTINCT span_id)::int AS span_count
        FROM filtered GROUP BY action_id
      ), release_rows AS (
        SELECT action_type, release_id, count(*)::int AS attempts,
          count(*) FILTER (WHERE phase='succeeded')::int AS succeeded,
          count(*) FILTER (WHERE phase IN ('failed','timed_out','unhandled'))::int AS failed,
          count(*) FILTER (WHERE phase NOT IN ('succeeded','failed','timed_out','unhandled'))::int AS open,
          count(*) FILTER (WHERE phase IN ('triggered','started') AND last_seen_at < now() - CASE action_type
            WHEN 'identity.login.passkey' THEN interval '2 minutes'
            WHEN 'project.settings.save' THEN interval '30 seconds'
            WHEN 'project.build.start' THEN interval '15 minutes'
            WHEN 'nexi.flash.usb.start' THEN interval '10 minutes'
            ELSE interval '10 minutes' END)::int AS hanging,
          min(started_at) AS first_seen_at, max(last_seen_at) AS last_seen_at
        FROM attempts GROUP BY action_type, release_id
      ), reason_rows AS (
        SELECT action_type, release_id, reason_code, count(*)::int AS failures
        FROM attempts WHERE phase IN ('failed','timed_out','unhandled')
        GROUP BY action_type, release_id, reason_code
      )
      SELECT
        coalesce((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.last_seen_at DESC) FROM release_rows row), '[]'::jsonb) AS by_release,
        coalesce((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.failures DESC) FROM reason_rows row), '[]'::jsonb) AS top_reason_codes,
        coalesce((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.last_seen_at DESC) FROM
          (SELECT * FROM attempts ORDER BY last_seen_at DESC LIMIT $2) row), '[]'::jsonb) AS recent_actions
    `, [hours, limit]);
    const row = result.rows[0] || {};
    return {
      hours,
      by_release: row.by_release || [],
      top_reason_codes: row.top_reason_codes || [],
      recent_actions: row.recent_actions || [],
    };
  }

  async createUserActionIncident(value) {
    await this.pool.query(`
      INSERT INTO operations_user_action_incidents
        (incident_id, created_at, updated_at, action_id, action_type, reason_code,
         release_id, status, owner, runbook_url, fix_release_id, note, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `, [value.incident_id, value.created_at, value.updated_at, value.action_id,
      value.action_type, value.reason_code, value.release_id, value.status, value.owner,
      value.runbook_url, value.fix_release_id, value.note, value]);
    return clone(value);
  }

  async findUserActionIncident(incidentId) {
    const result = await this.pool.query(
      "SELECT raw_json FROM operations_user_action_incidents WHERE incident_id=$1",
      [incidentId],
    );
    return result.rows[0]?.raw_json ? clone(result.rows[0].raw_json) : null;
  }

  async updateUserActionIncident(incidentId, value) {
    const result = await this.pool.query(`
      UPDATE operations_user_action_incidents SET
        updated_at=$2, status=$3, owner=$4, runbook_url=$5, fix_release_id=$6,
        note=$7, raw_json=$8
      WHERE incident_id=$1
    `, [incidentId, value.updated_at, value.status, value.owner, value.runbook_url,
      value.fix_release_id, value.note, value]);
    return result.rowCount ? clone(value) : null;
  }

  async listUserActionIncidents(filter = {}) {
    const values = [];
    const conditions = [];
    if (filter.status) { values.push(filter.status); conditions.push(`status=$${values.length}`); }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM operations_user_action_incidents${where} ORDER BY updated_at DESC`, values,
    ));
  }

  async upsertUserActionAlert(value) {
    await this.pool.query(`
      INSERT INTO operations_user_action_alerts
        (alert_key, first_seen_at, last_seen_at, action_type, release_id, reason_code,
         alert_kind, severity, status, notification_state, attempts, failures,
         failure_rate_percent, hanging, window_hours, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (alert_key) DO UPDATE SET
        last_seen_at=EXCLUDED.last_seen_at, severity=EXCLUDED.severity,
        attempts=EXCLUDED.attempts, failures=EXCLUDED.failures,
        failure_rate_percent=EXCLUDED.failure_rate_percent, hanging=EXCLUDED.hanging,
        window_hours=EXCLUDED.window_hours, raw_json=EXCLUDED.raw_json
    `, [value.alert_key, value.first_seen_at, value.last_seen_at, value.action_type,
      value.release_id, value.reason_code, value.alert_kind, value.severity, value.status,
      value.notification_state, value.attempts, value.failures, value.failure_rate_percent,
      value.hanging, value.window_hours, value]);
    return clone(value);
  }

  async listUserActionAlerts() {
    const result = await this.pool.query(`
      SELECT alert_key, first_seen_at, last_seen_at, action_type, release_id,
        reason_code, alert_kind, severity, status, notification_state, attempts,
        failures, failure_rate_percent, hanging, window_hours
      FROM operations_user_action_alerts ORDER BY last_seen_at DESC
    `);
    return result.rows.map(normalizePostgresNumbers);
  }

  async addSyntheticCheckResults(results) {
    const client = typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      for (const value of results || []) {
        await client.query(`
          INSERT INTO operations_synthetic_check_results
            (result_id, run_id, checked_at, check_id, target_service, route,
             status, http_status, response_ms, reason_code, raw_json)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (result_id) DO NOTHING
        `, [value.result_id, value.run_id, value.checked_at, value.check_id,
          value.target_service, value.route, value.status, value.http_status || null,
          value.response_ms, value.reason_code, value]);
      }
      await client.query("COMMIT");
      return { accepted: (results || []).length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      if (client !== this.pool) client.release();
    }
  }

  async listSyntheticCheckResults(filter = {}) {
    const values = [];
    const conditions = [];
    if (filter.run_id) { values.push(filter.run_id); conditions.push(`run_id=$${values.length}`); }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    values.push(Math.max(1, Math.min(1000, Number(filter.limit) || 200)));
    return rows(await this.pool.query(
      `SELECT raw_json FROM operations_synthetic_check_results${where} ORDER BY checked_at DESC LIMIT $${values.length}`,
      values,
    ));
  }

  async addInterfaceCall(input) {
    await this.pool.query(`
      INSERT INTO operations_interface_calls
        (occurred_at, source_service, target_service, method, route,
         status_code, duration_ms, succeeded, action_id, action_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [input.occurred_at || new Date().toISOString(), input.source_service,
      input.target_service, input.method, input.route, Number(input.status_code || 0),
      Number(input.duration_ms || 0), Boolean(input.succeeded), input.action_id || null,
      input.action_type || null]);
  }

  async listInterfaceCalls(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.action_id) {
      values.push(filter.action_id);
      conditions.push(`action_id=$${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    values.push(Math.max(1, Math.min(1000, Number(filter.limit) || 200)));
    const result = await this.pool.query(`
      SELECT occurred_at, source_service, target_service, method, route,
        status_code, duration_ms, succeeded, action_id::text, action_type
      FROM operations_interface_calls${where}
      ORDER BY occurred_at DESC LIMIT $${values.length}
    `, values);
    return result.rows.map((item) => ({ ...item, succeeded: Boolean(item.succeeded) }));
  }

  async interfaceCallStatistics(filter = {}) {
    const hours = Math.max(1, Math.min(168, Number(filter.hours) || 24));
    const result = await this.pool.query(`
      SELECT source_service, target_service, COUNT(*)::integer AS calls,
        COUNT(*) FILTER (WHERE succeeded = false)::integer AS failed,
        ROUND(AVG(duration_ms))::integer AS average_ms,
        MAX(duration_ms)::integer AS maximum_ms, MAX(occurred_at) AS last_call
      FROM operations_interface_calls
      WHERE occurred_at >= now() - ($1::double precision * interval '1 hour')
      GROUP BY source_service, target_service
      ORDER BY calls DESC, target_service
    `, [hours]);
    return result.rows.map((item) => ({
      ...item, calls:Number(item.calls), failed:Number(item.failed), average_ms:Number(item.average_ms || 0), maximum_ms:Number(item.maximum_ms || 0),
    }));
  }

  async replaceLinkInventory(sourceService, inventory) {
    const client = typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    const generatedAt = inventory.generated_at || new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE operations_link_targets SET active=false, updated_at=$2 WHERE source_service=$1",
        [sourceService, generatedAt],
      );
      for (const target of inventory.targets || []) {
        const value = {
          ...target,
          source_service: sourceService,
          active: target.active !== false,
          updated_at: generatedAt,
        };
        await client.query(`
          INSERT INTO operations_link_targets
            (reference_id, target_url, link_type, owner_domain, access_scope,
             source_service, active, updated_at, raw_json)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (reference_id) DO UPDATE SET
            target_url=EXCLUDED.target_url, link_type=EXCLUDED.link_type,
            owner_domain=EXCLUDED.owner_domain, access_scope=EXCLUDED.access_scope,
            source_service=EXCLUDED.source_service, active=EXCLUDED.active,
            updated_at=EXCLUDED.updated_at, raw_json=EXCLUDED.raw_json
        `, [value.reference_id, value.target_url, value.link_type, value.owner_domain,
          value.access_scope, sourceService, value.active, generatedAt, value]);
      }
      await client.query("DELETE FROM operations_link_occurrences WHERE source_service=$1", [sourceService]);
      for (const occurrence of inventory.occurrences || []) {
        const value = { ...occurrence, source_service: sourceService };
        await client.query(`
          INSERT INTO operations_link_occurrences
            (occurrence_id, reference_id, source_service, source_location, source_route, raw_json)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (occurrence_id) DO UPDATE SET
            reference_id=EXCLUDED.reference_id, source_service=EXCLUDED.source_service,
            source_location=EXCLUDED.source_location, source_route=EXCLUDED.source_route,
            raw_json=EXCLUDED.raw_json
        `, [value.occurrence_id, value.reference_id, sourceService,
          value.source_location, value.source_route || "", value]);
      }
      await client.query("COMMIT");
      return {
        targets: (inventory.targets || []).length,
        occurrences: (inventory.occurrences || []).length,
        generated_at: generatedAt,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      if (client !== this.pool) client.release();
    }
  }

  async addLinkChecks(checks) {
    for (const check of checks || []) {
      await this.pool.query(`
        INSERT INTO operations_link_checks
          (check_id, reference_id, checked_at, status, http_status, access_profile, raw_json)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (check_id) DO NOTHING
      `, [check.check_id, check.reference_id, check.checked_at, check.status,
        check.http_status || null, check.access_profile || "public", check]);
    }
    return { accepted: (checks || []).length };
  }

  async listLinkTargets() {
    return rows(await this.pool.query(
      `SELECT raw_json || jsonb_build_object(
         'active', active,
         'updated_at', to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       ) AS raw_json
       FROM operations_link_targets ORDER BY active DESC, target_url`,
    ));
  }

  async listLinkOccurrences() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM operations_link_occurrences ORDER BY source_location",
    ));
  }

  async listLinkChecks() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM operations_link_checks ORDER BY checked_at DESC",
    ));
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
          + (SELECT count(*) FROM operations_user_action_events)
          + (SELECT count(*) FROM operations_synthetic_check_results)
          + (SELECT count(*) FROM operations_interface_calls)
          + (SELECT count(*) FROM operations_link_targets)
          + (SELECT count(*) FROM operations_link_occurrences)
          + (SELECT count(*) FROM operations_link_checks)
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
function normalizePostgresNumbers(value) {
  const result = { ...value };
  for (const field of ["attempts", "failures", "failure_rate_percent", "hanging", "window_hours"]) result[field] = Number(result[field] || 0);
  return result;
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function rows(result) { return result.rows.map((row) => clone(row.raw_json)); }
function first(result) { return result.rows[0] ? clone(result.rows[0].raw_json) : null; }

module.exports = { PostgresAdminRepository };
