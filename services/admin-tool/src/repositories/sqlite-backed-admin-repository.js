const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryAdminRepository } = require("./in-memory-admin-repository");

class SqliteBackedAdminRepository extends InMemoryAdminRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    this.store.ensureSchema?.(adminSchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedAdminRepository(new SqliteStateStore(sqlitePath, "admin-tool", {
      defaultState: {
        devices: [],
        feedback: [],
        aiUsageEvents: [],
        consents: [],
        auditEvents: [],
        adminActions: [],
      },
      collectionMap: {
        devices: "devices",
        feedback: "feedback",
        aiUsageEvents: "ai_usage_events",
        consents: "consents",
        auditEvents: "audit_events",
        adminActions: "admin_actions",
      },
    }));
  }

  createConsent(input) {
    const result = super.createConsent(input);
    this.persist();
    return result;
  }

  revokeConsent(consentId) {
    const result = super.revokeConsent(consentId);
    this.persist();
    return result;
  }

  addAuditEvent(event) {
    const result = super.addAuditEvent(event);
    this.persist();
    return result;
  }

  addAdminAction(action) {
    const result = super.addAdminAction(action);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      devices: Array.from(this.devices.values()),
      feedback: this.feedback,
      aiUsageEvents: this.aiUsageEvents,
      consents: Array.from(this.consents.values()),
      auditEvents: this.auditEvents,
      adminActions: this.adminActions,
    };
    this.store.save(state);
    this.store.replaceCollection?.("devices", state.devices, "device_id");
    this.store.replaceCollection?.("feedback", state.feedback, "feedback_id");
    this.store.replaceCollection?.("ai_usage_events", state.aiUsageEvents, "event_id");
    this.store.replaceCollection?.("consents", state.consents, "consent_id");
    this.store.replaceCollection?.("audit_events", state.auditEvents, "audit_event_id");
    this.store.replaceCollection?.("admin_actions", state.adminActions, "action_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("admin_tool_devices", state.devices, deviceColumns());
      this.store.replaceTable("admin_tool_feedback", state.feedback, feedbackColumns());
      this.store.replaceTable("admin_tool_ai_usage_events", state.aiUsageEvents, aiUsageColumns());
      this.store.replaceTable("admin_tool_consents", state.consents, columns(["consent_id", "account_id", "granted_by_account_id", "granted_to_role", "purpose", "scope", "valid_from", "valid_until", "revoked_at", "created_at"]));
      this.store.replaceTable("admin_tool_audit_events", state.auditEvents, auditColumns());
      this.store.replaceTable("admin_tool_admin_actions", state.adminActions, actionColumns());
    }
  }
}

function adminSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS admin_tool_devices (device_id TEXT PRIMARY KEY, serial_number TEXT, account_id TEXT, display_name TEXT, hardware_profile_id TEXT, authenticity_status TEXT, lifecycle_state TEXT, pairing_status TEXT, connectivity_status TEXT, ota_status TEXT, last_seen_ip TEXT, ota_hostname TEXT, credential_history_json TEXT, support_entitlement_json TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_feedback (feedback_id TEXT PRIMARY KEY, account_id TEXT, project_id TEXT, step_id TEXT, rating INTEGER, status TEXT, feedback_text TEXT, contact_email TEXT, contact_consent_valid_until TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_ai_usage_events (event_id TEXT PRIMARY KEY, account_id TEXT, occurred_at TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER, calculated_credits REAL, estimated_provider_cost REAL, status TEXT, rejection_reason TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_consents (consent_id TEXT PRIMARY KEY, account_id TEXT, granted_by_account_id TEXT, granted_to_role TEXT, purpose TEXT, scope TEXT, valid_from TEXT, valid_until TEXT, revoked_at TEXT, created_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_audit_events (audit_event_id TEXT PRIMARY KEY, occurred_at TEXT, account_id TEXT, actor_id TEXT, actor_role TEXT, accessed_data_model_id TEXT, purpose TEXT, access_decision TEXT, reason TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_admin_actions (action_id TEXT PRIMARY KEY, occurred_at TEXT, actor_id TEXT, actor_role TEXT, action_type TEXT, account_id TEXT, reason TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function columns(names) {
  return Object.fromEntries(names.map((name) => [name, name]));
}

function deviceColumns() {
  return { ...columns(["device_id", "serial_number", "account_id", "display_name", "hardware_profile_id", "authenticity_status", "lifecycle_state", "pairing_status", "connectivity_status", "ota_status", "last_seen_ip", "ota_hostname"]), credential_history_json: jsonColumn("credential_history"), support_entitlement_json: jsonColumn("support_entitlement"), raw_json: jsonColumn((row) => row) };
}

function feedbackColumns() {
  return { ...columns(["feedback_id", "account_id", "project_id", "step_id", "rating", "status", "feedback_text", "contact_email", "contact_consent_valid_until"]), raw_json: jsonColumn((row) => row) };
}

function aiUsageColumns() {
  return { ...columns(["event_id", "account_id", "occurred_at", "model", "input_tokens", "output_tokens", "calculated_credits", "estimated_provider_cost", "status", "rejection_reason"]), raw_json: jsonColumn((row) => row) };
}

function auditColumns() {
  return { ...columns(["audit_event_id", "occurred_at", "account_id", "actor_id", "actor_role", "accessed_data_model_id", "purpose", "access_decision", "reason"]), raw_json: jsonColumn((row) => row) };
}

function actionColumns() {
  return { ...columns(["action_id", "occurred_at", "actor_id", "actor_role", "action_type", "account_id", "reason"]), raw_json: jsonColumn((row) => row) };
}

module.exports = { SqliteBackedAdminRepository };
