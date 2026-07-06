const { AdminToolError } = require("../errors");

class AdminService {
  constructor(options) {
    this.repository = options.repository;
    this.accessPolicy = options.accessPolicy;
    this.serviceClients = options.serviceClients || null;
  }

  async overview() {
    if (this.serviceClients) {
      const [devices, feedback, aiUsage] = await Promise.all([
        this.remoteDevices(),
        this.remoteFeedback(),
        this.remoteAiDashboard(),
      ]);
      return {
        devices: {
          total: devices.length,
          gernetix_verified: devices.filter((device) => device.authenticity_status === "gernetix_verified").length,
          community_unverified: devices.filter((device) => device.authenticity_status === "community_unverified").length,
          online: devices.filter((device) => device.connectivity_status === "online").length,
        },
        feedback: {
          total: feedback.length,
          new: feedback.length,
        },
        ai_usage: aiUsage.summary,
        audit_events: {
          total: this.repository.listAuditEvents().length,
        },
      };
    }
    const devices = this.repository.listDevices();
    const feedback = this.repository.listFeedback();
    const aiUsage = this.repository.listAiUsageEvents();
    return {
      devices: {
        total: devices.length,
        gernetix_verified: devices.filter((device) => device.authenticity_status === "gernetix_verified").length,
        community_unverified: devices.filter((device) => device.authenticity_status === "community_unverified").length,
        online: devices.filter((device) => device.connectivity_status === "online").length,
      },
      feedback: {
        total: feedback.length,
        new: feedback.filter((item) => item.status === "new").length,
      },
      ai_usage: summarizeAiUsage(aiUsage),
      audit_events: {
        total: this.repository.listAuditEvents().length,
      },
    };
  }

  async listDevices() {
    if (this.serviceClients) {
      return (await this.remoteDevices()).map((device) => ({
        device_id: device.device_id,
        display_name: device.serial_number || device.device_id,
        hardware_profile_id: device.hardware_profile_id,
        authenticity_status: device.authenticity_status,
        lifecycle_state: device.lifecycle_state,
        connectivity_status: device.connectivity_status,
        ota_status: device.ota_status,
        support_entitlement_status: device.support_entitlement?.entitlement_status || "unknown",
      }));
    }
    return this.repository.listDevices().map((device) => ({
      device_id: device.device_id,
      display_name: device.display_name,
      hardware_profile_id: device.hardware_profile_id,
      authenticity_status: device.authenticity_status,
      lifecycle_state: device.lifecycle_state,
      connectivity_status: device.connectivity_status,
      ota_status: device.ota_status,
      support_entitlement_status: device.support_entitlement.status,
    }));
  }

  async getDevice(deviceId, context) {
    if (this.serviceClients) {
      const query = new URLSearchParams({
        actor_id: context.actor.actor_id,
        role: context.actor.role,
        purpose: context.purpose,
        legal_basis: context.legal_basis,
        security_reason: context.security_reason,
      });
      return this.httpJson(this.serviceClients.deviceManagementBaseUrl, `/api/device-management/admin/devices/${encodeURIComponent(deviceId)}?${query}`);
    }
    const device = this.repository.findDevice(deviceId);
    if (!device) throw new AdminToolError("device_not_found", "Device wurde nicht gefunden.", 404);
    const access = this.accessPolicy.decideCustomerDataAccess({
      actor: context.actor,
      accountId: device.account_id,
      dataModelId: "data_model.account_device",
      purpose: context.purpose,
      legalBasis: context.legal_basis,
      securityReason: context.security_reason,
    });

    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "Zugriff auf Device-Daten wurde abgelehnt.", 403, access);
    }

    return {
      access,
      device: access.decision === "full" ? redactSecrets(device) : maskDevice(device),
    };
  }

  createConsent(input) {
    validateRequired(input, ["account_id", "granted_to_role", "purpose", "valid_until"]);
    return this.repository.createConsent(input);
  }

  revokeConsent(consentId) {
    const consent = this.repository.revokeConsent(consentId);
    if (!consent) throw new AdminToolError("consent_not_found", "Consent wurde nicht gefunden.", 404);
    return consent;
  }

  listAuditEvents(filter = {}) {
    return this.repository.listAuditEvents(filter);
  }

  async listLearningFeedback(context) {
    if (this.serviceClients) {
      const feedback = await this.remoteFeedback();
      return feedback.map((item) => {
        const access = this.accessPolicy.decideCustomerDataAccess({
          actor: context.actor,
          accountId: item.user_id || item.account_id || null,
          dataModelId: "data_model.learning_feedback",
          purpose: context.purpose,
          legalBasis: context.legal_basis,
          securityReason: context.security_reason,
        });
        return {
          access,
          feedback: access.decision === "full" ? item : maskProjectFeedback(item),
        };
      });
    }
    return this.repository.listFeedback().map((feedback) => {
      const access = this.accessPolicy.decideCustomerDataAccess({
        actor: context.actor,
        accountId: feedback.account_id,
        dataModelId: "data_model.learning_feedback",
        purpose: context.purpose,
        legalBasis: context.legal_basis,
        securityReason: context.security_reason,
      });
      return {
        access,
        feedback: access.decision === "full" ? feedback : maskFeedback(feedback),
      };
    });
  }

  async aiUsageSummary(context) {
    const access = this.accessPolicy.decideAdminCapability({
      actor: context.actor,
      capability: "admin_ai_usage_monitoring",
      purpose: "ai_usage_monitoring",
      dataModelId: "data_model.ai_usage_event",
    });
    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "KI Usage Monitoring ist nicht erlaubt.", 403, access);
    }
    if (this.serviceClients) {
      const dashboard = await this.remoteAiDashboard();
      return { access, summary: dashboard.summary };
    }
    return { access, summary: summarizeAiUsage(this.repository.listAiUsageEvents()) };
  }

  async recordAiCostControlAction(input, context) {
    const access = this.accessPolicy.decideAdminCapability({
      actor: context.actor,
      capability: "admin_ai_cost_controls",
      purpose: "ai_cost_control",
      dataModelId: "data_model.ai_admin_action_audit_event",
      accountId: input.account_id || null,
    });
    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "KI Kostensteuerung ist nicht erlaubt.", 403, access);
    }
    validateRequired(input, ["action_type", "reason"]);
    if (this.serviceClients) {
      const action = await this.httpJson(this.serviceClients.aiUsageBaseUrl, "/api/ai-usage/admin/cost-controls", {
        method: "POST",
        body: {
          actor_id: context.actor.actor_id,
          action_type: mapAiActionType(input.action_type),
          account_id: input.account_id || null,
          reason: input.reason,
          payload: input.payload || {},
        },
      });
      return action.audit_event || action;
    }
    return this.repository.addAdminAction({
      actor_id: context.actor.actor_id,
      actor_role: context.actor.role,
      action_type: input.action_type,
      account_id: input.account_id || null,
      reason: input.reason,
      payload: input.payload || {},
    });
  }

  async remoteDevices() {
    const response = await this.httpJson(this.serviceClients.deviceManagementBaseUrl, "/api/device-management/admin/devices");
    return response.items || [];
  }

  async remoteFeedback() {
    const response = await this.httpJson(this.serviceClients.projectServerBaseUrl, "/api/learning-feedback");
    return response.items || [];
  }

  async remoteAiDashboard() {
    return this.httpJson(this.serviceClients.aiUsageBaseUrl, "/api/ai-usage/admin/dashboard");
  }

  async httpJson(baseUrl, pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AdminToolError(payload.error || "remote_service_error", payload.message || "Remote Service Fehler.", response.status, payload.details || {});
    }
    return payload;
  }
}

function summarizeAiUsage(events) {
  return {
    total_events: events.length,
    successful: events.filter((event) => event.status === "success").length,
    rejected: events.filter((event) => event.status === "rejected").length,
    credits: events.reduce((sum, event) => sum + Number(event.calculated_credits || 0), 0),
    tokens: events.reduce((sum, event) => sum + Number(event.input_tokens || 0) + Number(event.output_tokens || 0), 0),
    estimated_provider_cost: Number(events.reduce((sum, event) => sum + Number(event.estimated_provider_cost || 0), 0).toFixed(4)),
  };
}

function maskDevice(device) {
  return {
    device_id: device.device_id,
    display_name: maskText(device.display_name),
    hardware_profile_id: device.hardware_profile_id,
    authenticity_status: device.authenticity_status,
    lifecycle_state: device.lifecycle_state,
    connectivity_status: device.connectivity_status,
    ota_status: device.ota_status,
    support_entitlement: {
      status: device.support_entitlement.status,
      source: device.support_entitlement.source,
    },
  };
}

function redactSecrets(device) {
  return {
    ...device,
    credential_history: device.credential_history.map((credential) => ({
      credential_id: credential.credential_id,
      credential_type: credential.credential_type,
      key_reference: credential.key_reference,
      status: credential.status,
    })),
  };
}

function maskFeedback(feedback) {
  return {
    feedback_id: feedback.feedback_id,
    project_id: feedback.project_id,
    step_id: feedback.step_id,
    rating: feedback.rating,
    status: feedback.status,
    feedback_text: feedback.feedback_text,
    account_id: "masked",
    contact_email: "masked",
  };
}

function maskProjectFeedback(feedback) {
  return {
    feedback_id: feedback.feedback_id,
    project_id: feedback.project_id,
    learning_step_id: feedback.learning_step_id,
    category: feedback.category,
    message: feedback.message,
    user_id: "masked",
    contact_email: "masked",
  };
}

function mapAiActionType(actionType) {
  if (actionType === "temporary_ai_block") return "block_account";
  return actionType;
}

function maskText(value) {
  return value ? "masked" : "";
}

function validateRequired(input, fields) {
  for (const field of fields) {
    if (!String(input[field] || "").trim()) {
      throw new AdminToolError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
    }
  }
}

module.exports = { AdminService };
