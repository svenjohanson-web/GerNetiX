const crypto = require("node:crypto");

class InMemoryAdminRepository {
  constructor(seed = defaultSeed()) {
    this.devices = new Map(seed.devices.map((device) => [device.device_id, clone(device)]));
    this.feedback = seed.feedback.map(clone);
    this.aiUsageEvents = seed.aiUsageEvents.map(clone);
    this.consents = new Map(seed.consents.map((consent) => [consent.consent_id, clone(consent)]));
    this.auditEvents = seed.auditEvents.map(clone);
    this.adminActions = (seed.adminActions || []).map(clone);
  }

  listDevices() {
    return Array.from(this.devices.values()).map(clone);
  }

  findDevice(deviceId) {
    return clone(this.devices.get(deviceId));
  }

  listFeedback() {
    return this.feedback.map(clone);
  }

  listAiUsageEvents() {
    return this.aiUsageEvents.map(clone);
  }

  createConsent(input) {
    const now = new Date().toISOString();
    const consent = {
      consent_id: createId("consent"),
      account_id: input.account_id,
      granted_by_account_id: input.granted_by_account_id || input.account_id,
      granted_to_role: input.granted_to_role,
      purpose: input.purpose,
      scope: input.scope || "customer_data",
      valid_from: input.valid_from || now,
      valid_until: input.valid_until,
      revoked_at: null,
      created_at: now,
    };
    this.consents.set(consent.consent_id, clone(consent));
    return clone(consent);
  }

  revokeConsent(consentId) {
    const consent = this.consents.get(consentId);
    if (!consent) return null;
    consent.revoked_at = new Date().toISOString();
    this.consents.set(consentId, clone(consent));
    return clone(consent);
  }

  findValidConsent({ accountId, role, purpose, at = new Date() }) {
    for (const consent of this.consents.values()) {
      if (consent.account_id !== accountId) continue;
      if (consent.granted_to_role !== role && consent.granted_to_role !== "any_internal_role") continue;
      if (consent.purpose !== purpose) continue;
      if (consent.revoked_at) continue;
      if (new Date(consent.valid_from).getTime() > at.getTime()) continue;
      if (new Date(consent.valid_until).getTime() <= at.getTime()) continue;
      return clone(consent);
    }
    return null;
  }

  addAuditEvent(event) {
    const auditEvent = {
      audit_event_id: createId("audit"),
      occurred_at: new Date().toISOString(),
      ...event,
    };
    this.auditEvents.push(clone(auditEvent));
    return clone(auditEvent);
  }

  listAuditEvents(filter = {}) {
    return this.auditEvents
      .filter((event) => !filter.account_id || event.account_id === filter.account_id)
      .map(clone);
  }

  addAdminAction(action) {
    const event = {
      action_id: createId("admin_action"),
      occurred_at: new Date().toISOString(),
      ...action,
    };
    this.adminActions.push(clone(event));
    this.addAuditEvent({
      actor_id: action.actor_id,
      actor_role: action.actor_role,
      accessed_data_model_id: "data_model.ai_admin_action_audit_event",
      purpose: "ai_cost_control",
      account_id: action.account_id || null,
      access_decision: "full",
      reason: action.action_type,
    });
    return clone(event);
  }
}

function defaultSeed() {
  return {
    devices: [
      {
        device_id: "device_verified_1",
        serial_number: "GNX-ESP32-0001",
        account_id: "acct_1",
        display_name: "Sven ESP32 DevKit",
        hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
        authenticity_status: "gernetix_verified",
        lifecycle_state: "active",
        pairing_status: "paired_to_account",
        connectivity_status: "online",
        ota_status: "ready",
        last_seen_ip: "192.168.1.42",
        ota_hostname: "sven-esp32.local",
        credential_history: [
          {
            credential_id: "cred_verified_1",
            credential_type: "HMAC_SHA256",
            key_reference: "device-key://device_verified_1/cred_verified_1",
            status: "active",
          },
        ],
        support_entitlement: {
          status: "eligible",
          source: "gernetix_manufacturer_registration",
          decision_reason: "GerNetiX provisioniert und aktiv.",
        },
      },
      {
        device_id: "device_community_1",
        serial_number: "COMM-ESP32-123",
        account_id: "acct_2",
        display_name: "Keller Sensor ESP32",
        hardware_profile_id: "hardware.processor_board.esp32_unknown",
        authenticity_status: "community_unverified",
        lifecycle_state: "active",
        pairing_status: "paired_to_account",
        connectivity_status: "offline",
        ota_status: "unknown",
        last_seen_ip: "192.168.1.88",
        ota_hostname: "keller-sensor.local",
        credential_history: [],
        support_entitlement: {
          status: "not_eligible",
          source: "community_hardware",
          decision_reason: "Community-Hardware erzeugt keinen GerNetiX-Hardware-Supportanspruch.",
        },
      },
    ],
    feedback: [
      {
        feedback_id: "feedback_1",
        account_id: "acct_1",
        project_id: "project.esp32_ota_bootstrap_firmware",
        step_id: "stage.esp32_ota_bootstrap_firmware.2",
        rating: 4,
        status: "new",
        feedback_text: "WLAN-Schritt war hilfreich, aber die OTA-Erklaerung koennte kuerzer sein.",
        contact_email: "learner@example.test",
        contact_consent_valid_until: "2099-01-01T00:00:00.000Z",
      },
    ],
    aiUsageEvents: [
      {
        event_id: "ai_usage_1",
        account_id: "acct_1",
        occurred_at: new Date().toISOString(),
        provider_type: "external",
        provider_name: "OpenAI-kompatible API",
        provider_base_url: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        input_tokens: 1000,
        output_tokens: 300,
        calculated_credits: 13,
        estimated_provider_cost: 0.05,
        duration_ms: 1800,
        latency_ms: 420,
        status: "success",
      },
      {
        event_id: "ai_usage_2",
        account_id: "acct_2",
        occurred_at: new Date().toISOString(),
        provider_type: "external",
        provider_name: "OpenAI-kompatible API",
        provider_base_url: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        input_tokens: 800,
        output_tokens: 0,
        calculated_credits: 0,
        estimated_provider_cost: 0,
        duration_ms: 140,
        latency_ms: 140,
        status: "rejected",
        rejection_reason: "insufficient_credits",
      },
      {
        event_id: "ai_usage_3",
        account_id: "acct_1",
        occurred_at: new Date().toISOString(),
        provider_type: "local",
        provider_name: "Lokales Ollama",
        provider_base_url: "http://127.0.0.1:11434",
        model: "llama3.2:3b",
        input_tokens: 620,
        output_tokens: 180,
        calculated_credits: 0,
        estimated_provider_cost: 0,
        duration_ms: 3200,
        latency_ms: 260,
        eval_tokens_per_second: 24.6,
        status: "success",
      },
    ],
    consents: [],
    auditEvents: [],
  };
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryAdminRepository };
