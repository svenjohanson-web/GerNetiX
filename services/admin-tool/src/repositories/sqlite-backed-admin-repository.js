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
        systemEvents: [],
        userActionEvents: [],
        linkTargets: [],
        linkOccurrences: [],
        linkChecks: [],
      },
      collectionMap: {
        devices: "devices",
        feedback: "feedback",
        aiUsageEvents: "ai_usage_events",
        consents: "consents",
        auditEvents: "audit_events",
        adminActions: "admin_actions",
        systemEvents: "system_events",
        userActionEvents: "user_action_events",
        linkTargets: "link_targets",
        linkOccurrences: "link_occurrences",
        linkChecks: "link_checks",
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

  addSystemEvent(input) {
    const result = super.addSystemEvent(input);
    this.persist();
    return result;
  }

  addUserActionEvent(input) {
    const result = super.addUserActionEvent(input);
    this.persist();
    return result;
  }

  replaceLinkInventory(sourceService, inventory) {
    const result = super.replaceLinkInventory(sourceService, inventory);
    this.persist();
    return result;
  }

  addLinkChecks(checks) {
    const result = super.addLinkChecks(checks);
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
      systemEvents: this.systemEvents,
      userActionEvents: this.userActionEvents,
      linkTargets: Array.from(this.linkTargets.values()),
      linkOccurrences: Array.from(this.linkOccurrences.values()),
      linkChecks: this.linkChecks,
    };
    this.store.save(state);
    this.store.replaceCollection?.("devices", state.devices, "device_id");
    this.store.replaceCollection?.("feedback", state.feedback, "feedback_id");
    this.store.replaceCollection?.("ai_usage_events", state.aiUsageEvents, "event_id");
    this.store.replaceCollection?.("consents", state.consents, "consent_id");
    this.store.replaceCollection?.("audit_events", state.auditEvents, "audit_event_id");
    this.store.replaceCollection?.("admin_actions", state.adminActions, "action_id");
    this.store.replaceCollection?.("system_events", state.systemEvents, "event_id");
    this.store.replaceCollection?.("user_action_events", state.userActionEvents, "event_id");
    this.store.replaceCollection?.("link_targets", state.linkTargets, "reference_id");
    this.store.replaceCollection?.("link_occurrences", state.linkOccurrences, "occurrence_id");
    this.store.replaceCollection?.("link_checks", state.linkChecks, "check_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("admin_tool_devices", state.devices, deviceColumns());
      this.store.replaceTable("admin_tool_feedback", state.feedback, feedbackColumns());
      this.store.replaceTable("admin_tool_ai_usage_events", state.aiUsageEvents, aiUsageColumns());
      this.store.replaceTable("admin_tool_consents", state.consents, columns(["consent_id", "account_id", "granted_by_account_id", "granted_to_role", "purpose", "scope", "valid_from", "valid_until", "revoked_at", "created_at"]));
      this.store.replaceTable("admin_tool_audit_events", state.auditEvents, auditColumns());
      this.store.replaceTable("admin_tool_admin_actions", state.adminActions, actionColumns());
      this.store.replaceTable("admin_tool_system_events", state.systemEvents, systemEventColumns());
      this.store.replaceTable("admin_tool_user_action_events", state.userActionEvents, userActionEventColumns());
      this.store.replaceTable("admin_tool_link_targets", state.linkTargets, linkTargetColumns());
      this.store.replaceTable("admin_tool_link_occurrences", state.linkOccurrences, linkOccurrenceColumns());
      this.store.replaceTable("admin_tool_link_checks", state.linkChecks, linkCheckColumns());
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
    `CREATE TABLE IF NOT EXISTS admin_tool_system_events (event_id TEXT PRIMARY KEY, occurred_at TEXT, severity TEXT, source_service TEXT, target_service TEXT, category TEXT, event_type TEXT, message TEXT, impact TEXT, account_id TEXT, route TEXT, correlation_id TEXT, details_json TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_user_action_events (event_id TEXT PRIMARY KEY, occurred_at TEXT, action_type TEXT, action_id TEXT, span_type TEXT, span_id TEXT, parent_span_id TEXT, parent_action_id TEXT, phase TEXT, reason_code TEXT, route_id TEXT, release_id TEXT, duration_bucket TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_link_targets (reference_id TEXT PRIMARY KEY, target_url TEXT, link_type TEXT, owner_domain TEXT, access_scope TEXT, source_service TEXT, active INTEGER, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_link_occurrences (occurrence_id TEXT PRIMARY KEY, reference_id TEXT, source_service TEXT, source_location TEXT, source_route TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS admin_tool_link_checks (check_id TEXT PRIMARY KEY, reference_id TEXT, checked_at TEXT, status TEXT, http_status INTEGER, access_profile TEXT, final_url TEXT, error_code TEXT, raw_json TEXT NOT NULL);`,
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

function systemEventColumns() {
  return { ...columns(["event_id", "occurred_at", "severity", "source_service", "target_service", "category", "event_type", "message", "impact", "account_id", "route", "correlation_id"]), details_json: jsonColumn("details"), raw_json: jsonColumn((row) => row) };
}

function userActionEventColumns() {
  return { ...columns(["event_id", "occurred_at", "action_type", "action_id", "span_type", "span_id", "parent_span_id", "parent_action_id", "phase", "reason_code", "route_id", "release_id", "duration_bucket"]), raw_json: jsonColumn((row) => row) };
}

function linkTargetColumns() {
  return { ...columns(["reference_id", "target_url", "link_type", "owner_domain", "access_scope", "source_service", "active", "updated_at"]), raw_json: jsonColumn((row) => row) };
}

function linkOccurrenceColumns() {
  return { ...columns(["occurrence_id", "reference_id", "source_service", "source_location", "source_route"]), raw_json: jsonColumn((row) => row) };
}

function linkCheckColumns() {
  return { ...columns(["check_id", "reference_id", "checked_at", "status", "http_status", "access_profile", "final_url", "error_code"]), raw_json: jsonColumn((row) => row) };
}

module.exports = { SqliteBackedAdminRepository };
