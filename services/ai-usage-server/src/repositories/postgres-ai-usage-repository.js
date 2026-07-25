"use strict";

const { defaultPolicy } = require("./in-memory-ai-usage-repository");

class PostgresAiUsageRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresAiUsageRepository(pool);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_credit_accounts (
        account_id text PRIMARY KEY, plan_id text NOT NULL,
        raw_json jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ai_usage_ledger_entries (
        ledger_entry_id text PRIMARY KEY, account_id text NOT NULL,
        raw_json jsonb NOT NULL, created_at text NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_account
        ON ai_usage_ledger_entries (account_id, created_at);
      CREATE TABLE IF NOT EXISTS ai_usage_events (
        event_id text PRIMARY KEY, account_id text NOT NULL, status text NOT NULL,
        model text NOT NULL, raw_json jsonb NOT NULL, created_at text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_usage_events_account
        ON ai_usage_events (account_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_events_status
        ON ai_usage_events (status, created_at);
      CREATE TABLE IF NOT EXISTS ai_usage_policy (
        policy_id text PRIMARY KEY, raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ai_usage_admin_audit_events (
        admin_audit_event_id text PRIMARY KEY, account_id text,
        action_type text NOT NULL, raw_json jsonb NOT NULL, created_at text NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_usage_admin_audit_account
        ON ai_usage_admin_audit_events (account_id, created_at);
      CREATE TABLE IF NOT EXISTS ai_usage_migrations (
        migration_id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await this.savePolicy(defaultPolicy(), { insertOnly: true });
  }

  async saveCreditAccount(account) {
    await this.pool.query(`
      INSERT INTO ai_usage_credit_accounts (account_id, plan_id, raw_json)
      VALUES ($1,$2,$3)
      ON CONFLICT (account_id) DO UPDATE SET
        plan_id=EXCLUDED.plan_id, raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [account.account_id, account.plan_id, account]);
    return clone(account);
  }

  async findCreditAccount(accountId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM ai_usage_credit_accounts WHERE account_id=$1",
      [accountId],
    ));
  }

  async listCreditAccounts() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM ai_usage_credit_accounts ORDER BY account_id",
    ));
  }

  async addLedgerEntry(entry) {
    await this.pool.query(`
      INSERT INTO ai_usage_ledger_entries (ledger_entry_id, account_id, raw_json, created_at)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (ledger_entry_id) DO NOTHING
    `, [entry.ledger_entry_id, entry.account_id, entry, entry.created_at]);
    return clone(entry);
  }

  async listLedgerEntries(filter = {}) {
    if (filter.account_id) {
      return rows(await this.pool.query(
        "SELECT raw_json FROM ai_usage_ledger_entries WHERE account_id=$1 ORDER BY created_at, ledger_entry_id",
        [filter.account_id],
      ));
    }
    return rows(await this.pool.query(
      "SELECT raw_json FROM ai_usage_ledger_entries ORDER BY created_at, ledger_entry_id",
    ));
  }

  async addUsageEvent(event) {
    await this.pool.query(`
      INSERT INTO ai_usage_events (event_id, account_id, status, model, raw_json, created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (event_id) DO NOTHING
    `, [event.event_id, event.account_id, event.status, event.model, event, event.created_at]);
    return clone(event);
  }

  async updateUsageEvent(eventId, patch) {
    const current = await this.findUsageEvent(eventId);
    if (!current) return null;
    const event = { ...current, ...clone(patch) };
    await this.pool.query(`
      UPDATE ai_usage_events
      SET account_id=$2, status=$3, model=$4, raw_json=$5, updated_at=now()
      WHERE event_id=$1
    `, [eventId, event.account_id, event.status, event.model, event]);
    return event;
  }

  async findUsageEvent(eventId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM ai_usage_events WHERE event_id=$1",
      [eventId],
    ));
  }

  async listUsageEvents(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.account_id) {
      values.push(filter.account_id);
      conditions.push(`account_id=$${values.length}`);
    }
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status=$${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM ai_usage_events${where} ORDER BY created_at, event_id`,
      values,
    ));
  }

  async savePolicy(policy, options = {}) {
    await this.pool.query(`
      INSERT INTO ai_usage_policy (policy_id, raw_json)
      VALUES ($1,$2)
      ON CONFLICT (policy_id) DO ${options.insertOnly
    ? "NOTHING"
    : "UPDATE SET raw_json=EXCLUDED.raw_json, updated_at=now()"}
    `, [policy.policy_id, policy]);
    return clone(policy);
  }

  async getPolicy() {
    return first(await this.pool.query(
      "SELECT raw_json FROM ai_usage_policy ORDER BY updated_at DESC LIMIT 1",
    )) || defaultPolicy();
  }

  async addAdminAuditEvent(event) {
    await this.pool.query(`
      INSERT INTO ai_usage_admin_audit_events
        (admin_audit_event_id, account_id, action_type, raw_json, created_at)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (admin_audit_event_id) DO NOTHING
    `, [event.admin_audit_event_id, event.account_id, event.action_type, event, event.created_at]);
    return clone(event);
  }

  async listAdminAuditEvents() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM ai_usage_admin_audit_events ORDER BY created_at, admin_audit_event_id",
    ));
  }

  async importLegacyState(state, migrationId = "ai-usage-sqlite-v1") {
    const client = typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      const alreadyApplied = await client.query(
        "SELECT 1 FROM ai_usage_migrations WHERE migration_id=$1",
        [migrationId],
      );
      if (alreadyApplied.rowCount) {
        await client.query("ROLLBACK");
        return { imported: false, reason: "already_applied" };
      }
      const occupied = await client.query(`
        SELECT
          (SELECT count(*) FROM ai_usage_credit_accounts) +
          (SELECT count(*) FROM ai_usage_ledger_entries) +
          (SELECT count(*) FROM ai_usage_events) +
          (SELECT count(*) FROM ai_usage_admin_audit_events) AS count
      `);
      if (Number(occupied.rows[0]?.count || 0) > 0) {
        throw new Error("AI-Usage-PostgreSQL-Ziel ist belegt, aber der Migrationsmarker fehlt.");
      }
      const repository = new PostgresAiUsageRepository(client);
      for (const item of state.creditAccounts || []) await repository.saveCreditAccount(item);
      for (const item of state.ledgerEntries || []) await repository.addLedgerEntry(item);
      for (const item of state.usageEvents || []) await repository.addUsageEvent(item);
      for (const item of state.adminAuditEvents || []) await repository.addAdminAuditEvent(item);
      if (state.policy) await repository.savePolicy(state.policy);
      await client.query(
        "INSERT INTO ai_usage_migrations (migration_id) VALUES ($1)",
        [migrationId],
      );
      await client.query("COMMIT");
      return {
        imported: true,
        counts: {
          creditAccounts: (state.creditAccounts || []).length,
          ledgerEntries: (state.ledgerEntries || []).length,
          usageEvents: (state.usageEvents || []).length,
          adminAuditEvents: (state.adminAuditEvents || []).length,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      if (client !== this.pool) client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

function first(result) {
  return result.rows[0] ? clone(result.rows[0].raw_json) : null;
}

function rows(result) {
  return result.rows.map((row) => clone(row.raw_json));
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

module.exports = { PostgresAiUsageRepository };
