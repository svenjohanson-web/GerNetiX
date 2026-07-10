const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryAiContextRepository, defaultPolicy, defaultSources, defaultPromptFoundations, defaultArchitectureComponents } = require("./in-memory-ai-context-repository");

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
        sources: defaultSources(),
        promptFoundations: defaultPromptFoundations(),
        architectureComponents: defaultArchitectureComponents(),
        policy: defaultPolicy(),
      },
      collectionMap: {
        grants: "grants",
        auditEvents: "audit_events",
        sources: "sources",
        promptFoundations: "prompt_foundations",
        architectureComponents: "architecture_components",
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

  saveSource(source) {
    const result = super.saveSource(source);
    this.persist();
    return result;
  }

  savePromptFoundation(promptFoundation) {
    const result = super.savePromptFoundation(promptFoundation);
    this.persist();
    return result;
  }

  saveArchitectureComponent(component) {
    const result = super.saveArchitectureComponent(component);
    this.persist();
    return result;
  }

  sqliteSummary() {
    return {
      available: true,
      db_path: this.store.dbPath,
      service_key: this.store.serviceKey,
      schema_version: this.store.schemaVersion(),
      tables: [
        sqliteTableSummary(this.store, "ai_context_policy", [
          "policy_id",
          "deny_without_grant",
          "require_explicit_source_scope",
          "allow_external_provider_customer_data",
          "default_max_context_items",
          "protected_source_types_json",
          "updated_at",
        ]),
        sqliteTableSummary(this.store, "ai_context_sources", [
          "source_id",
          "source_type",
          "source_scope",
          "title",
          "backing_service",
          "endpoint",
          "default_redaction_level",
          "default_provider_scope",
          "status",
          "updated_at",
        ], "source_type, source_scope"),
        sqliteTableSummary(this.store, "ai_context_prompt_foundations", [
          "foundation_id",
          "title",
          "route_task",
          "source_scope",
          "content_kind",
          "status",
          "updated_at",
        ], "route_task, foundation_id"),
        sqliteTableSummary(this.store, "ai_context_architecture_components", [
          "component_id",
          "name",
          "source_scope",
          "status",
          "updated_at",
        ], "name"),
        sqliteTableSummary(this.store, "ai_context_grants", [
          "grant_id",
          "account_id",
          "project_id",
          "source_type",
          "source_scope",
          "purpose",
          "allowed_provider_scope",
          "redaction_level",
          "max_context_items",
          "valid_from",
          "valid_until",
          "revoked_at",
          "created_at",
        ], "created_at DESC"),
        sqliteTableSummary(this.store, "ai_context_audit_events", [
          "audit_event_id",
          "occurred_at",
          "account_id",
          "project_id",
          "actor_id",
          "actor_role",
          "source_type",
          "source_scope",
          "purpose",
          "provider",
          "model",
          "grant_id",
          "access_decision",
          "rejection_reason",
          "redaction_level",
        ], "occurred_at DESC"),
      ],
      service_documents: this.store.listCollectionNames().map((collectionName) => ({
        collection_name: collectionName,
        row_count: this.store.loadCollection(collectionName).length,
      })),
    };
  }

  persist() {
    const state = {
      grants: Array.from(this.grants.values()),
      auditEvents: this.auditEvents,
      sources: Array.from(this.sources.values()),
      promptFoundations: Array.from(this.promptFoundations.values()),
      architectureComponents: Array.from(this.architectureComponents.values()),
      policy: this.policy,
    };
    this.store.save(state);
    this.store.replaceCollection?.("grants", state.grants, "grant_id");
    this.store.replaceCollection?.("audit_events", state.auditEvents, "audit_event_id");
    this.store.replaceCollection?.("sources", state.sources, "source_id");
    this.store.replaceCollection?.("prompt_foundations", state.promptFoundations, "foundation_id");
    this.store.replaceCollection?.("architecture_components", state.architectureComponents, "component_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("ai_context_grants", state.grants, grantColumns());
      this.store.replaceTable("ai_context_audit_events", state.auditEvents, auditColumns());
      this.store.replaceTable("ai_context_sources", state.sources, sourceColumns());
      this.store.replaceTable("ai_context_prompt_foundations", state.promptFoundations, promptFoundationColumns());
      this.store.replaceTable("ai_context_architecture_components", state.architectureComponents, architectureComponentColumns());
      this.store.replaceTable("ai_context_policy", [state.policy], policyColumns());
    }
  }
}

function sqliteTableSummary(store, tableName, columns, orderBy = "") {
  const count = store.db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";
  const rows = store.db.prepare(`SELECT ${columns.join(", ")} FROM ${tableName}${orderClause} LIMIT 10`).all();
  return {
    table_name: tableName,
    row_count: count,
    columns,
    preview_rows: rows,
  };
}

function aiContextSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS ai_context_grants (grant_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, project_id TEXT, granted_by_account_id TEXT, source_type TEXT NOT NULL, source_scope TEXT NOT NULL, purpose TEXT NOT NULL, allowed_provider_scope TEXT NOT NULL, redaction_level TEXT NOT NULL, max_context_items INTEGER, valid_from TEXT NOT NULL, valid_until TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_context_audit_events (audit_event_id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, account_id TEXT, project_id TEXT, actor_id TEXT, actor_role TEXT, source_type TEXT, source_scope TEXT, purpose TEXT, provider TEXT, model TEXT, grant_id TEXT, access_decision TEXT NOT NULL, rejection_reason TEXT, redaction_level TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_context_sources (source_id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_scope TEXT NOT NULL, title TEXT NOT NULL, summary TEXT, backing_service TEXT NOT NULL, endpoint TEXT NOT NULL, contains_json TEXT NOT NULL, default_redaction_level TEXT NOT NULL, default_provider_scope TEXT NOT NULL, allowed_purposes_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_context_prompt_foundations (foundation_id TEXT PRIMARY KEY, title TEXT NOT NULL, route_task TEXT NOT NULL, source_scope TEXT NOT NULL, content_kind TEXT NOT NULL, allowed_sources_json TEXT NOT NULL, blocked_sources_json TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_context_architecture_components (component_id TEXT PRIMARY KEY, name TEXT NOT NULL, source_scope TEXT NOT NULL, aliases_json TEXT NOT NULL, summary TEXT NOT NULL, properties_json TEXT NOT NULL, provided_interfaces_json TEXT NOT NULL, required_interfaces_json TEXT NOT NULL, decision_hints_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_context_policy (policy_id TEXT PRIMARY KEY, deny_without_grant INTEGER NOT NULL, require_explicit_source_scope INTEGER NOT NULL, allow_external_provider_customer_data INTEGER NOT NULL, default_max_context_items INTEGER NOT NULL, protected_source_types_json TEXT NOT NULL, updated_at TEXT NOT NULL, raw_json TEXT NOT NULL);`,
  ];
}

function sourceColumns() {
  return {
    ...columns([
      "source_id", "source_type", "source_scope", "title", "backing_service", "endpoint",
      "default_redaction_level", "default_provider_scope", "status", "created_at", "updated_at",
    ]),
    contains_json: jsonColumn("contains"),
    allowed_purposes_json: jsonColumn("allowed_purposes"),
    raw_json: jsonColumn((row) => row),
  };
}

function promptFoundationColumns() {
  return {
    ...columns([
      "foundation_id", "title", "route_task", "source_scope", "content_kind", "content", "status", "created_at", "updated_at",
    ]),
    allowed_sources_json: jsonColumn("allowed_sources"),
    blocked_sources_json: jsonColumn("blocked_sources"),
    raw_json: jsonColumn((row) => row),
  };
}

function architectureComponentColumns() {
  return {
    ...columns([
      "component_id", "name", "source_scope", "summary", "status", "created_at", "updated_at",
    ]),
    aliases_json: jsonColumn("aliases"),
    properties_json: jsonColumn("properties"),
    provided_interfaces_json: jsonColumn("provided_interfaces"),
    required_interfaces_json: jsonColumn("required_interfaces"),
    decision_hints_json: jsonColumn("decision_hints"),
    raw_json: jsonColumn((row) => row),
  };
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
