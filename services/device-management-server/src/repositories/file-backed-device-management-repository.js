const path = require("node:path");
const { JsonFileStore, jsonColumn } = require("../../../shared");
const { InMemoryDeviceManagementRepository } = require("./in-memory-device-management-repository");

class FileBackedDeviceManagementRepository extends InMemoryDeviceManagementRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    if (typeof this.store.ensureSchema === "function") {
      this.store.ensureSchema(deviceManagementSchema());
    }
  }

  static create(runtimeRoot) {
    return new FileBackedDeviceManagementRepository(new JsonFileStore(path.join(runtimeRoot, "device-management-state.json"), {
      defaultState: emptyState(),
    }));
  }

  saveDevice(device) {
    const result = super.saveDevice(device);
    this.persist();
    return result;
  }

  saveCredential(deviceId, credential) {
    const result = super.saveCredential(deviceId, credential);
    this.persist();
    return result;
  }

  saveChallenge(challenge) {
    const result = super.saveChallenge(challenge);
    this.persist();
    return result;
  }

  markChallengeUsed(challengeId) {
    super.markChallengeUsed(challengeId);
    this.persist();
  }

  savePairingSession(session) {
    const result = super.savePairingSession(session);
    this.persist();
    return result;
  }

  saveAccountDevice(accountDevice) {
    const result = super.saveAccountDevice(accountDevice);
    this.persist();
    return result;
  }

  savePurchaseContext(accountId, purchaseContext) {
    const result = super.savePurchaseContext(accountId, purchaseContext);
    this.persist();
    return result;
  }

  createConsent(consent) {
    const result = super.createConsent(consent);
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

  persist() {
    const state = {
      devices: Array.from(this.devices.values()),
      credentials: Array.from(this.credentials.values()),
      challenges: Array.from(this.challenges.values()),
      pairingSessions: Array.from(this.pairingSessions.values()),
      accountDevices: Array.from(this.accountDevices.values()).flat(),
      purchaseContexts: Array.from(this.purchaseContexts.values()).flat(),
      consents: Array.from(this.consents.values()),
      auditEvents: this.auditEvents,
    };
    this.store.save(state);
    if (typeof this.store.replaceCollection === "function") {
      this.store.replaceCollection("devices", state.devices, "device_id");
      this.store.replaceCollection("credentials", state.credentials, "device_id");
      this.store.replaceCollection("challenges", state.challenges, "challenge_id");
      this.store.replaceCollection("pairing_sessions", state.pairingSessions, "pairing_session_id");
      this.store.replaceCollection("account_devices", state.accountDevices, "account_device_id");
      this.store.replaceCollection("purchase_contexts", state.purchaseContexts, "purchase_context_id");
      this.store.replaceCollection("consents", state.consents, "consent_id");
      this.store.replaceCollection("audit_events", state.auditEvents, "audit_event_id");
    }
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("device_management_devices", state.devices, deviceColumns());
      this.store.replaceTable("device_management_credentials", state.credentials, credentialColumns());
      this.store.replaceTable("device_management_challenges", state.challenges, challengeColumns());
      this.store.replaceTable("device_management_pairing_sessions", state.pairingSessions, pairingSessionColumns());
      this.store.replaceTable("device_management_account_devices", state.accountDevices, accountDeviceColumns());
      this.store.replaceTable("device_management_purchase_contexts", state.purchaseContexts, purchaseContextColumns());
      this.store.replaceTable("device_management_consents", state.consents, consentColumns());
      this.store.replaceTable("device_management_audit_events", state.auditEvents, auditEventColumns());
    }
  }
}

function deviceManagementSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS device_management_devices (
      device_id TEXT PRIMARY KEY,
      serial_number TEXT,
      hardware_profile_id TEXT,
      authenticity_status TEXT,
      lifecycle_state TEXT,
      runtime_version TEXT,
      app_version TEXT,
      purchase_context_id TEXT,
      connectivity_status TEXT,
      ota_status TEXT,
      last_seen_at TEXT,
      service_endpoints_json TEXT,
      manufacturer_registration_json TEXT,
      last_authenticity_proof_json TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS device_management_credentials (
      device_id TEXT PRIMARY KEY,
      credential_id TEXT,
      credential_type TEXT,
      key_reference TEXT,
      status TEXT,
      created_at TEXT,
      secret TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS device_management_challenges (
      challenge_id TEXT PRIMARY KEY,
      device_id TEXT,
      challenge TEXT,
      created_at TEXT,
      used_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS device_management_pairing_sessions (
      pairing_session_id TEXT PRIMARY KEY,
      account_id TEXT,
      device_id TEXT,
      pairing_channel TEXT,
      pairing_code TEXT,
      status TEXT,
      created_at TEXT,
      expires_at TEXT,
      completed_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS device_management_account_devices (
      account_device_id TEXT PRIMARY KEY,
      account_id TEXT,
      device_id TEXT,
      display_name TEXT,
      hardware_profile_id TEXT,
      technical_capability_ids_json TEXT,
      purchase_context_id TEXT,
      authenticity_status TEXT,
      connectivity_status TEXT,
      ota_status TEXT,
      ownership_status TEXT,
      paired_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS device_management_purchase_contexts (
      purchase_context_id TEXT PRIMARY KEY,
      account_id TEXT,
      source_order_id TEXT,
      purchased_offer_ids_json TEXT,
      hardware_item_ids_json TEXT,
      capability_ids_json TEXT,
      support_basis TEXT,
      provisioning_profile_ids_json TEXT,
      registered_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS device_management_consents (
      consent_id TEXT PRIMARY KEY,
      account_id TEXT,
      granted_by_account_id TEXT,
      granted_to_role TEXT,
      purpose TEXT,
      scope TEXT,
      valid_from TEXT,
      valid_until TEXT,
      revoked_at TEXT,
      created_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS device_management_audit_events (
      audit_event_id TEXT PRIMARY KEY,
      occurred_at TEXT,
      account_id TEXT,
      accessed_by_user_id TEXT,
      accessed_by_role TEXT,
      accessed_data_model_id TEXT,
      purpose TEXT,
      consent_id TEXT,
      access_decision TEXT,
      rejection_reason TEXT,
      raw_json TEXT NOT NULL
    );`,
  ];
}

function deviceColumns() {
  return {
    device_id: "device_id",
    serial_number: "serial_number",
    hardware_profile_id: "hardware_profile_id",
    authenticity_status: "authenticity_status",
    lifecycle_state: "lifecycle_state",
    runtime_version: "runtime_version",
    app_version: "app_version",
    purchase_context_id: "purchase_context_id",
    connectivity_status: "connectivity_status",
    ota_status: "ota_status",
    last_seen_at: "last_seen_at",
    service_endpoints_json: jsonColumn("service_endpoints"),
    manufacturer_registration_json: jsonColumn("manufacturer_registration"),
    last_authenticity_proof_json: jsonColumn("last_authenticity_proof"),
    raw_json: jsonColumn((row) => row),
  };
}

function credentialColumns() {
  return {
    device_id: "device_id",
    credential_id: "credential_id",
    credential_type: "credential_type",
    key_reference: "key_reference",
    status: "status",
    created_at: "created_at",
    secret: "secret",
    raw_json: jsonColumn((row) => row),
  };
}

function challengeColumns() {
  return {
    challenge_id: "challenge_id",
    device_id: "device_id",
    challenge: "challenge",
    created_at: "created_at",
    used_at: "used_at",
    raw_json: jsonColumn((row) => row),
  };
}

function pairingSessionColumns() {
  return {
    pairing_session_id: "pairing_session_id",
    account_id: "account_id",
    device_id: "device_id",
    pairing_channel: "pairing_channel",
    pairing_code: "pairing_code",
    status: "status",
    created_at: "created_at",
    expires_at: "expires_at",
    completed_at: "completed_at",
    raw_json: jsonColumn((row) => row),
  };
}

function accountDeviceColumns() {
  return {
    account_device_id: "account_device_id",
    account_id: "account_id",
    device_id: "device_id",
    display_name: "display_name",
    hardware_profile_id: "hardware_profile_id",
    technical_capability_ids_json: jsonColumn("technical_capability_ids"),
    purchase_context_id: "purchase_context_id",
    authenticity_status: "authenticity_status",
    connectivity_status: "connectivity_status",
    ota_status: "ota_status",
    ownership_status: "ownership_status",
    paired_at: "paired_at",
    raw_json: jsonColumn((row) => row),
  };
}

function purchaseContextColumns() {
  return {
    purchase_context_id: "purchase_context_id",
    account_id: "account_id",
    source_order_id: "source_order_id",
    purchased_offer_ids_json: jsonColumn("purchased_offer_ids"),
    hardware_item_ids_json: jsonColumn("hardware_item_ids"),
    capability_ids_json: jsonColumn("capability_ids"),
    support_basis: "support_basis",
    provisioning_profile_ids_json: jsonColumn("provisioning_profile_ids"),
    registered_at: "registered_at",
    raw_json: jsonColumn((row) => row),
  };
}

function consentColumns() {
  return {
    consent_id: "consent_id",
    account_id: "account_id",
    granted_by_account_id: "granted_by_account_id",
    granted_to_role: "granted_to_role",
    purpose: "purpose",
    scope: "scope",
    valid_from: "valid_from",
    valid_until: "valid_until",
    revoked_at: "revoked_at",
    created_at: "created_at",
    raw_json: jsonColumn((row) => row),
  };
}

function auditEventColumns() {
  return {
    audit_event_id: "audit_event_id",
    occurred_at: "occurred_at",
    account_id: "account_id",
    accessed_by_user_id: "accessed_by_user_id",
    accessed_by_role: "accessed_by_role",
    accessed_data_model_id: "accessed_data_model_id",
    purpose: "purpose",
    consent_id: "consent_id",
    access_decision: "access_decision",
    rejection_reason: "rejection_reason",
    raw_json: jsonColumn((row) => row),
  };
}

function emptyState() {
  return {
    devices: [],
    credentials: [],
    challenges: [],
    pairingSessions: [],
    accountDevices: [],
    purchaseContexts: [],
    consents: [],
    auditEvents: [],
  };
}

module.exports = { FileBackedDeviceManagementRepository };
