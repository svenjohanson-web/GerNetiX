const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryAiUsageRepository, defaultPolicy } = require("./in-memory-ai-usage-repository");

class SqliteBackedAiUsageRepository extends InMemoryAiUsageRepository {
  constructor(store) {
    super({ policy: defaultPolicy(), ...store.load() });
    this.store = store;
    this.store.ensureSchema?.(aiUsageSchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedAiUsageRepository(new SqliteStateStore(sqlitePath, "ai-usage-server", {
      defaultState: {
        creditAccounts: [],
        ledgerEntries: [],
        usageEvents: [],
        adminAuditEvents: [],
        policy: defaultPolicy(),
      },
      collectionMap: {
        creditAccounts: "credit_accounts",
        ledgerEntries: "ledger_entries",
        usageEvents: "usage_events",
        adminAuditEvents: "admin_audit_events",
      },
    }));
  }

  saveCreditAccount(account) {
    const result = super.saveCreditAccount(account);
    this.persist();
    return result;
  }

  addLedgerEntry(entry) {
    const result = super.addLedgerEntry(entry);
    this.persist();
    return result;
  }

  addUsageEvent(event) {
    const result = super.addUsageEvent(event);
    this.persist();
    return result;
  }

  updateUsageEvent(eventId, patch) {
    const result = super.updateUsageEvent(eventId, patch);
    this.persist();
    return result;
  }

  savePolicy(policy) {
    const result = super.savePolicy(policy);
    this.persist();
    return result;
  }

  addAdminAuditEvent(event) {
    const result = super.addAdminAuditEvent(event);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      creditAccounts: Array.from(this.creditAccounts.values()),
      ledgerEntries: this.ledgerEntries,
      usageEvents: this.usageEvents,
      adminAuditEvents: this.adminAuditEvents,
      policy: this.policy,
    };
    this.store.save(state);
    this.store.replaceCollection?.("credit_accounts", state.creditAccounts, "account_id");
    this.store.replaceCollection?.("ledger_entries", state.ledgerEntries, "ledger_entry_id");
    this.store.replaceCollection?.("usage_events", state.usageEvents, "event_id");
    this.store.replaceCollection?.("admin_audit_events", state.adminAuditEvents, "admin_audit_event_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("ai_usage_credit_accounts", state.creditAccounts, columns([
        "account_id", "plan_id", "total_granted_credits", "consumed_credits", "held_credits", "blocked_until", "created_at", "updated_at",
      ]));
      this.store.replaceTable("ai_usage_ledger_entries", state.ledgerEntries, columns([
        "ledger_entry_id", "account_id", "amount_credits", "reason", "reference_id", "created_at",
      ]));
      this.store.replaceTable("ai_usage_events", state.usageEvents, usageEventColumns());
      this.store.replaceTable("ai_usage_admin_audit_events", state.adminAuditEvents, adminAuditColumns());
      this.store.replaceTable("ai_usage_policy", [state.policy], policyColumns());
    }
  }
}

function aiUsageSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS ai_usage_credit_accounts (account_id TEXT PRIMARY KEY, plan_id TEXT, total_granted_credits REAL, consumed_credits REAL, held_credits REAL, blocked_until TEXT, created_at TEXT, updated_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS ai_usage_ledger_entries (ledger_entry_id TEXT PRIMARY KEY, account_id TEXT, amount_credits REAL, reason TEXT, reference_id TEXT, created_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS ai_usage_events (event_id TEXT PRIMARY KEY, account_id TEXT, user_id TEXT, project_id TEXT, feature TEXT, model TEXT, status TEXT, rejection_reason TEXT, input_tokens INTEGER, output_tokens INTEGER, calculated_credits REAL, estimated_provider_cost REAL, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_usage_admin_audit_events (admin_audit_event_id TEXT PRIMARY KEY, actor_id TEXT, action_type TEXT, account_id TEXT, reason TEXT, created_at TEXT, payload_json TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS ai_usage_policy (policy_id TEXT PRIMARY KEY, global_kill_switch INTEGER, daily_credit_limit REAL, monthly_credit_limit REAL, max_prompt_tokens INTEGER, max_response_tokens INTEGER, budget_warning_threshold_percent REAL, allowed_models_json TEXT, premium_models_json TEXT, model_pricing_json TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function columns(names) {
  return Object.fromEntries(names.map((name) => [name, name]));
}

function usageEventColumns() {
  return {
    ...columns(["event_id", "account_id", "user_id", "project_id", "feature", "model", "status", "rejection_reason", "input_tokens", "output_tokens", "calculated_credits", "estimated_provider_cost", "created_at", "updated_at"]),
    raw_json: jsonColumn((row) => row),
  };
}

function adminAuditColumns() {
  return {
    ...columns(["admin_audit_event_id", "actor_id", "action_type", "account_id", "reason", "created_at"]),
    payload_json: jsonColumn("payload"),
    raw_json: jsonColumn((row) => row),
  };
}

function policyColumns() {
  return {
    policy_id: "policy_id",
    global_kill_switch: (row) => row.global_kill_switch ? 1 : 0,
    daily_credit_limit: "daily_credit_limit",
    monthly_credit_limit: "monthly_credit_limit",
    max_prompt_tokens: "max_prompt_tokens",
    max_response_tokens: "max_response_tokens",
    budget_warning_threshold_percent: "budget_warning_threshold_percent",
    allowed_models_json: jsonColumn("allowed_models"),
    premium_models_json: jsonColumn("premium_models"),
    model_pricing_json: jsonColumn("model_pricing"),
    raw_json: jsonColumn((row) => row),
  };
}

module.exports = { SqliteBackedAiUsageRepository };
