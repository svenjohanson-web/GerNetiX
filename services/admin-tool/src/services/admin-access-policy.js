const ROLE_CAPABILITIES = {
  administrator: [
    "admin_device_management",
    "admin_ai_usage_monitoring",
    "admin_ai_cost_controls",
    "admin_learning",
  ],
  support: [
    "support_registered_board_check",
    "admin_device_management",
  ],
};

class AdminAccessPolicy {
  constructor(options) {
    this.repository = options.repository;
  }

  decideCustomerDataAccess({ actor, accountId, dataModelId, purpose, legalBasis, securityReason }) {
    const role = actor.role || "support";
    const hasCapability = hasAnyCapability(actor, [
      "admin_device_management",
      "support_registered_board_check",
      "admin_learning",
    ]);
    if (!hasCapability) {
      return this.audit({
        actor,
        accountId,
        dataModelId,
        purpose,
        decision: "denied",
        reason: "missing_capability",
      });
    }

    if (legalBasis || securityReason) {
      return this.audit({
        actor,
        accountId,
        dataModelId,
        purpose,
        decision: "full",
        reason: legalBasis ? "documented_legal_basis" : "security_reason",
      });
    }

    const consent = this.repository.findValidConsent({ accountId, role, purpose });
    if (consent) {
      return this.audit({
        actor,
        accountId,
        dataModelId,
        purpose,
        decision: "full",
        reason: "valid_consent",
        consentId: consent.consent_id,
      });
    }

    return this.audit({
      actor,
      accountId,
      dataModelId,
      purpose,
      decision: "masked",
      reason: "missing_consent_or_legal_basis",
    });
  }

  decideAdminCapability({ actor, capability, purpose, dataModelId, accountId = null }) {
    const decision = hasCapability(actor, capability) ? "full" : "denied";
    return this.audit({
      actor,
      accountId,
      dataModelId,
      purpose,
      decision,
      reason: decision === "full" ? "capability_granted" : "missing_capability",
    });
  }

  audit({ actor, accountId, dataModelId, purpose, decision, reason, consentId = null }) {
    const event = this.repository.addAuditEvent({
      actor_id: actor.actor_id || "unknown_actor",
      actor_role: actor.role || "unknown_role",
      account_id: accountId,
      accessed_data_model_id: dataModelId,
      purpose: purpose || "unspecified",
      consent_id: consentId,
      access_decision: decision,
      reason,
    });
    return { decision, reason, audit_event_id: event.audit_event_id };
  }
}

function resolveCapabilities(actor) {
  return new Set([
    ...(ROLE_CAPABILITIES[actor.role] || []),
    ...(Array.isArray(actor.capabilities) ? actor.capabilities : []),
  ]);
}

function hasCapability(actor, capability) {
  return resolveCapabilities(actor).has(capability);
}

function hasAnyCapability(actor, capabilities) {
  return capabilities.some((capability) => hasCapability(actor, capability));
}

module.exports = { AdminAccessPolicy };
