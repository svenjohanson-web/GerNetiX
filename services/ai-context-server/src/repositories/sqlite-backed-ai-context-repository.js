const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryAiContextRepository, defaultPolicy } = require("./in-memory-ai-context-repository");

class SqliteBackedAiContextRepository extends InMemoryAiContextRepository {
  constructor(store) {
    super({ policy: defaultPolicy(), ...store.load() });
    this.store = store;
    this.store.ensureSchema?.(aiContextSchema());
    this.persist();
  }

  static create(sqlitePath) {
    return new SqliteBackedAiContextRepository(new SqliteStateStore(sqlitePath, "ai-context-server", {
      defaultState: {
        grants: [],
        auditEvents: [],
        policy: defaultPolicy(),
      },
      collectionMap: {
        grants: "grants",
        auditEvents: "audit_events",
      },
    }));
  }

  saveGrant(grant) {
    const result = super.saveGrant(grant);
    this.persist();
    return result;
  }

  revokeGrant(grantId, revokedAt) {
    const result = super.revokeGrant(grantId, revokedAt);
    this.persist();
    return result;
  }

  savePolicy(policy) {
    const result = super.savePolicy(policy);
    this.persist();
    return result;
  }

  addAuditEvent(event) {
    const result = super.addAuditEvent(event);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      grants: Array.from(this.grants.values()),
      auditEvents: this.auditEvents,
      policy: this.policy,
    };
    this.store.save(state);
    this.store.replaceCollection?.("grants", state.grants, "grant_id");
    this.store.replaceCollection?.("audit_events", state.auditEvents, "audit_event_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("ai_context_grants", state.grants, grantColumns());
      this.store.replaceTable("ai_context_audit_events", state.auditEvents, auditColumns());
      this.store.replaceTable("ai_context_policy", [state.policy], policyColumns());
    }
  }
}

function aiContextSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS ai_context_grants (grant_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, project_id TEXT, granted_by_account_id TEXT, source_type TEXT NOT NULL, source_scope TEXT NOT NULL, purpose TEXT NOT NULL, allowed_provider_scope TEXT NOT NULL, redaction_level TEXT NOT NULL, max_context_items INTEGER, valid_from TEXT NOT NULL, valid_until TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_context_audit_events (audit_event_id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, account_id TEXT, project_id TEXT, actor_id TEXT, actor_role TEXT, source_type TEXT, source_scope TEXT, purpose TEXT, provider TEXT, model TEXT, grant_id TEXT, access_decision TEXT NOT NULL, rejection_reason TEXT, redaction_level TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_context_policy (policy_id TEXT PRIMARY KEY, deny_without_grant INTEGER NOT NULL, require_explicit_source_scope INTEGER NOT NULL, allow_external_provider_customer_data INTEGER NOT NULL, default_max_context_items INTEGER NOT NULL, protected_source_types_json TEXT NOT NULL, updated_at TEXT NOT NULL, raw_json TEXT NOT NULL);`,
  ];
}

function grantColumns() {
  return {
    ...columns([
      "grant_id", "account_id", "project_id", "granted_by_account_id", "source_type", "source_scope", "purpose",
      "allowed_provider_scope", "redaction_level", "max_context_items", "valid_from", "valid_until", "revoked_at", "created_at",
    ]),
    raw_json: jsonColumn((row) => row),
  };
}

function auditColumns() {
  return {
    ...columns([
      "audit_event_id", "occurred_at", "account_id", "project_id", "actor_id", "actor_role", "source_type", "source_scope",
      "purpose", "provider", "model", "grant_id", "access_decision", "rejection_reason", "redaction_level",
    ]),
    raw_json: jsonColumn((row) => row),
  };
}

function policyColumns() {
  return {
    policy_id: "policy_id",
    deny_without_grant: (row) => row.deny_without_grant ? 1 : 0,
    require_explicit_source_scope: (row) => row.require_explicit_source_scope ? 1 : 0,
    allow_external_provider_customer_data: (row) => row.allow_external_provider_customer_data ? 1 : 0,
    default_max_context_items: "default_max_context_items",
    protected_source_types_json: jsonColumn("protected_source_types"),
    updated_at: "updated_at",
    raw_json: jsonColumn((row) => row),
  };
}

function columns(names) {
  return Object.fromEntries(names.map((name) => [name, name]));
}

module.exports = { SqliteBackedAiContextRepository };
