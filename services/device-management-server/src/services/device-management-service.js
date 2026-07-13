const crypto = require("node:crypto");
const { DeviceManagementError } = require("../errors");

class DeviceManagementService {
  constructor(options) {
    this.repository = options.repository;
  }

  registerDevice(input = {}) {
    const deviceId = input.device_id || createDeviceId(input.serial_number);
    const now = new Date().toISOString();
    const authenticity = input.authenticity_status || (input.gernetix_verified ? "gernetix_verified" : "community_unverified");
    const device = {
      device_id: deviceId,
      serial_number: required(input.serial_number, "serial_number"),
      hardware_profile_id: required(input.hardware_profile_id, "hardware_profile_id"),
      authenticity_status: authenticity,
      lifecycle_state: input.lifecycle_state || (authenticity === "gernetix_verified" ? "provisioned_by_gernetix" : "registered_by_customer"),
      runtime_version: input.runtime_version || "",
      app_version: input.app_version || input.firmware_version || "",
      service_endpoints: input.service_endpoints || {},
      board_short_name: input.board_short_name || "",
      node_name: input.node_name || "",
      instance_configuration: input.instance_configuration || {},
      purchase_context_id: input.purchase_context_id || "",
      connectivity_status: input.connectivity_status || "unknown",
      ota_status: input.ota_status || "unknown",
      last_seen_at: now,
      manufacturer_registration: authenticity === "gernetix_verified" ? {
        provisioning_batch_id: input.provisioning_batch_id || "",
        provisioned_at: input.provisioned_at || now,
        provisioned_by: input.provisioned_by || "",
        firmware_version: input.firmware_version || input.app_version || "",
        quality_check_state: input.quality_check_state || "pending",
      } : null,
    };
    this.repository.saveDevice(device);

    if (input.credential || input.device_secret || input.one_time_device_secret) {
      this.repository.saveCredential(deviceId, normalizeCredential(deviceId, input));
    }

    return this.summarizeDevice(device);
  }

  heartbeat(deviceId, input = {}) {
    const device = this.requireDevice(deviceId);
    const next = {
      ...device,
      runtime_version: input.runtime_version || device.runtime_version,
      app_version: input.app_version || device.app_version,
      connectivity_status: input.connectivity_status || device.connectivity_status,
      ota_status: input.ota_status || device.ota_status,
      last_update_status: input.last_update_status || device.last_update_status || "",
      last_seen_at: new Date().toISOString(),
    };
    this.repository.saveDevice(next);
    this.syncAccountDeviceStatus(next);
    return this.summarizeDevice(next);
  }

  getStatus(deviceId) {
    return this.summarizeDevice(this.requireDevice(deviceId));
  }

  createChallenge(deviceId) {
    this.requireDevice(deviceId);
    const challenge = {
      challenge_id: createId("challenge"),
      device_id: deviceId,
      challenge: crypto.randomBytes(32).toString("base64url"),
      created_at: new Date().toISOString(),
      used_at: null,
    };
    return this.repository.saveChallenge(challenge);
  }

  verifyChallenge(deviceId, input = {}) {
    const device = this.requireDevice(deviceId);
    const challenge = this.repository.findChallenge(input.challenge_id);
    const credential = this.repository.findCredential(deviceId);
    if (!challenge || challenge.device_id !== deviceId || challenge.used_at) {
      throw new DeviceManagementError("invalid_challenge", "Challenge ist ungueltig oder bereits verwendet.", 400);
    }
    if (!credential || !credential.secret) {
      throw new DeviceManagementError("credential_missing", "Fuer dieses Device ist kein pruefbares Credential hinterlegt.", 400);
    }

    const expected = crypto.createHmac("sha256", credential.secret).update(challenge.challenge).digest("hex");
    const verified = safeEqual(expected, String(input.hmac || ""));
    this.repository.markChallengeUsed(challenge.challenge_id);

    const next = {
      ...device,
      authenticity_status: verified ? "gernetix_verified" : "community_unverified",
      last_authenticity_proof: {
        proof_type: "HMAC_SHA256",
        verification_state: verified ? "verified" : "failed",
        verified_at: new Date().toISOString(),
      },
    };
    this.repository.saveDevice(next);
    return {
      device_id: deviceId,
      verification_state: verified ? "verified" : "failed",
      authenticity_status: next.authenticity_status,
    };
  }

  createPairingSession(input = {}) {
    this.requireDevice(required(input.device_id, "device_id"));
    const now = new Date();
    const session = {
      pairing_session_id: createId("pairing"),
      account_id: required(input.account_id, "account_id"),
      device_id: input.device_id,
      pairing_channel: input.pairing_channel || "ide_pairing_code",
      pairing_code: createPairingCode(),
      status: "pending",
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      completed_at: null,
    };
    return this.repository.savePairingSession(session);
  }

  getPairingSession(sessionId) {
    const session = this.repository.findPairingSession(sessionId);
    if (!session) throw new DeviceManagementError("pairing_session_not_found", "Pairing Session wurde nicht gefunden.", 404);
    return session;
  }

  completePairing(sessionId, input = {}) {
    const session = this.getPairingSession(sessionId);
    if (session.status !== "pending") {
      throw new DeviceManagementError("pairing_not_pending", "Pairing Session ist nicht mehr offen.", 409);
    }
    if (input.pairing_code && input.pairing_code !== session.pairing_code) {
      throw new DeviceManagementError("invalid_pairing_code", "Pairing Code ist ungueltig.", 403);
    }
    const device = this.requireDevice(session.device_id);
    const accountDevice = {
      account_device_id: createId("account_device"),
      account_id: session.account_id,
      device_id: device.device_id,
      display_name: input.display_name || device.serial_number,
      hardware_profile_id: device.hardware_profile_id,
      technical_capability_ids: input.technical_capability_ids || inferCapabilities(device),
      board_short_name: input.board_short_name || device.board_short_name || "",
      node_name: input.node_name || device.node_name || "",
      instance_configuration: input.instance_configuration || device.instance_configuration || {},
      purchase_context_id: input.purchase_context_id || bestPurchaseContextId(this.repository, session.account_id, device),
      authenticity_status: device.authenticity_status,
      connectivity_status: device.connectivity_status,
      ota_status: device.ota_status,
      ownership_status: "paired_to_account",
      paired_at: new Date().toISOString(),
    };
    const completed = {
      ...session,
      status: "completed",
      completed_at: accountDevice.paired_at,
    };
    this.repository.savePairingSession(completed);
    this.repository.saveAccountDevice(accountDevice);
    return { pairing_session: completed, account_device: accountDevice };
  }

  cancelPairing(sessionId) {
    const session = this.getPairingSession(sessionId);
    const canceled = { ...session, status: "canceled" };
    this.repository.savePairingSession(canceled);
    return canceled;
  }

  listAccountDevices(accountId) {
    return this.repository.listAccountDevices(accountId);
  }

  addAccountDevice(accountId, input = {}) {
    const device = this.requireDevice(required(input.device_id, "device_id"));
    const accountDevice = {
      account_device_id: createId("account_device"),
      account_id: accountId,
      device_id: device.device_id,
      display_name: input.display_name || device.serial_number,
      hardware_profile_id: device.hardware_profile_id,
      technical_capability_ids: input.technical_capability_ids || inferCapabilities(device),
      board_short_name: input.board_short_name || device.board_short_name || "",
      node_name: input.node_name || device.node_name || "",
      instance_configuration: input.instance_configuration || device.instance_configuration || {},
      purchase_context_id: input.purchase_context_id || bestPurchaseContextId(this.repository, accountId, device),
      authenticity_status: device.authenticity_status,
      connectivity_status: device.connectivity_status,
      ota_status: device.ota_status,
      ownership_status: "registered_by_customer",
      paired_at: null,
    };
    return this.repository.saveAccountDevice(accountDevice);
  }

  removeAccountDevice(accountId, accountDeviceId) {
    const removed = this.repository.deleteAccountDevice(accountId, accountDeviceId);
    if (!removed) throw new DeviceManagementError("account_device_not_found", "AccountDevice wurde nicht gefunden.", 404);
    return {
      removed: true,
      account_id: accountId,
      account_device_id: accountDeviceId,
      device_id: removed.device_id,
      removed_at: new Date().toISOString(),
    };
  }

  otaTargets(accountId, query = {}) {
    const requiredCapabilities = parseCapabilities(query.requiredCapabilities || query.required_capabilities || "");
    return this.repository.listAccountDevices(accountId).map((device) => {
      const missing = requiredCapabilities.filter((capability) => !device.technical_capability_ids.includes(capability));
      const selectable = missing.length === 0 && device.connectivity_status === "online" && device.ota_status === "ready";
      return {
        ...device,
        selectable,
        rejection_reasons: selectable ? [] : [
          ...missing.map((capability) => `missing_${capability}`),
          ...(device.connectivity_status !== "online" ? ["device_offline"] : []),
          ...(device.ota_status !== "ready" ? ["ota_not_ready"] : []),
        ],
      };
    });
  }

  updateConnectivity(deviceId, input = {}) {
    const device = this.requireDevice(deviceId);
    const next = {
      ...device,
      connectivity_status: input.connectivity_status || device.connectivity_status,
      ota_status: input.ota_status || device.ota_status,
      ota_hostname: input.ota_hostname || device.ota_hostname || "",
      last_seen_ip: input.last_seen_ip || input.ip || device.last_seen_ip || "",
      ap_mode: input.ap_mode || false,
      last_seen_at: new Date().toISOString(),
    };
    this.repository.saveDevice(next);
    this.syncAccountDeviceStatus(next);
    return this.summarizeDevice(next);
  }

  syncAccountDeviceStatus(device) {
    for (const accountId of this.repository.accountDevices.keys()) {
      const accountDevice = this.repository.listAccountDevices(accountId).find((item) => item.device_id === device.device_id);
      if (!accountDevice) continue;
      this.repository.saveAccountDevice({
        ...accountDevice,
        connectivity_status: device.connectivity_status,
        ota_status: device.ota_status,
      });
    }
  }

  supportEntitlement(deviceId) {
    const device = this.requireDevice(deviceId);
    const accountId = findAccountId(this.repository, deviceId);
    const purchaseContext = accountId ? findPurchaseContextForDevice(this.repository, accountId, device) : null;
    const verified = device.authenticity_status === "gernetix_verified" && device.lifecycle_state !== "revoked";
    const eligible = verified && (!purchaseContext || purchaseContext.support_basis === "gernetix_purchase_context");
    return {
      device_id: deviceId,
      entitlement_status: eligible ? "eligible" : "not_eligible",
      source: eligible
        ? (purchaseContext ? "gernetix_purchase_context" : "gernetix_manufacturer_registration")
        : (purchaseContext ? "purchase_context_requires_authenticity" : "community_or_unverified_hardware"),
      purchase_context_id: purchaseContext ? purchaseContext.purchase_context_id : null,
      decision_reason: eligible
        ? "Device ist GerNetiX-verifiziert und besitzt eine nachvollziehbare GerNetiX Supportgrundlage."
        : "Kaufkontext allein reicht nicht aus; Supportanspruch benoetigt ein passendes, nicht widerrufenes und verifiziertes Device.",
    };
  }

  registerPurchaseContext(accountId, input = {}) {
    const now = new Date().toISOString();
    const purchaseContext = {
      purchase_context_id: input.purchase_context_id || input.order_id || createId("purchase_context"),
      account_id: accountId,
      source_order_id: input.order_id || input.source_order_id || "",
      purchased_offer_ids: parseCapabilities(input.purchased_offer_ids || []),
      hardware_item_ids: parseCapabilities(input.hardware_item_ids || []),
      capability_ids: parseCapabilities(input.capability_ids || []),
      support_basis: input.support_basis || "component_or_community_context",
      provisioning_profile_ids: parseCapabilities(input.provisioning_profile_ids || []),
      registered_at: now,
    };
    this.repository.savePurchaseContext(accountId, purchaseContext);
    return purchaseContext;
  }

  listPurchaseContexts(accountId) {
    return this.repository.listPurchaseContexts(accountId);
  }

  accountDeviceSupportEntitlement(accountId, accountDeviceId) {
    const accountDevice = this.repository.findAccountDevice(accountId, accountDeviceId);
    if (!accountDevice) throw new DeviceManagementError("account_device_not_found", "AccountDevice wurde nicht gefunden.", 404);
    return this.supportEntitlement(accountDevice.device_id);
  }

  adminListDevices(query = {}) {
    return this.repository.listDevices({ authenticity_status: query.authenticityStatus || query.authenticity_status })
      .map((device) => this.adminDeviceSummary(device));
  }

  adminDevice(deviceId, context = {}) {
    const device = this.requireDevice(deviceId);
    const access = this.auditCustomerAccess({
      accountId: context.account_id || findAccountId(this.repository, deviceId),
      actorId: context.actor_id || "admin",
      role: context.role || "administrator",
      purpose: context.purpose || "device_admin_status",
      dataModelId: "data_model.device",
      legalBasis: context.legal_basis,
      securityReason: context.security_reason,
    });
    return {
      access,
      device: access.decision === "full" ? this.adminDeviceSummary(device) : maskAdminDevice(device),
    };
  }

  adminCredentials(deviceId) {
    this.requireDevice(deviceId);
    const credential = this.repository.findCredential(deviceId);
    if (!credential) return { device_id: deviceId, credentials: [] };
    return {
      device_id: deviceId,
      credentials: [{
        credential_id: credential.credential_id,
        credential_type: credential.credential_type,
        key_reference: credential.key_reference,
        status: credential.status,
        created_at: credential.created_at,
      }],
    };
  }

  createConsent(input = {}) {
    const now = new Date().toISOString();
    return this.repository.createConsent({
      consent_id: createId("consent"),
      account_id: required(input.account_id, "account_id"),
      granted_by_account_id: input.granted_by_account_id || input.account_id,
      granted_to_role: input.granted_to_role || "support",
      purpose: required(input.purpose, "purpose"),
      scope: input.scope || "device_management",
      valid_from: input.valid_from || now,
      valid_until: required(input.valid_until, "valid_until"),
      revoked_at: null,
      created_at: now,
    });
  }

  getConsent(consentId) {
    const consent = this.repository.findConsent(consentId);
    if (!consent) throw new DeviceManagementError("consent_not_found", "Consent wurde nicht gefunden.", 404);
    return consent;
  }

  revokeConsent(consentId) {
    const consent = this.repository.revokeConsent(consentId);
    if (!consent) throw new DeviceManagementError("consent_not_found", "Consent wurde nicht gefunden.", 404);
    return consent;
  }

  auditEvents(filter = {}) {
    return this.repository.listAuditEvents(filter);
  }

  summarizeDevice(device) {
    return {
      device_id: device.device_id,
      serial_number: device.serial_number,
      hardware_profile_id: device.hardware_profile_id,
      authenticity_status: device.authenticity_status,
      lifecycle_state: device.lifecycle_state,
      purchase_context_id: device.purchase_context_id,
      runtime_version: device.runtime_version,
      app_version: device.app_version,
      board_short_name: device.board_short_name || "",
      node_name: device.node_name || "",
      instance_configuration: device.instance_configuration || {},
      connectivity_status: device.connectivity_status,
      ota_status: device.ota_status,
      last_seen_at: device.last_seen_at,
    };
  }

  adminDeviceSummary(device) {
    return {
      ...this.summarizeDevice(device),
      service_endpoints: device.service_endpoints,
      manufacturer_registration: device.manufacturer_registration,
      pairing_status: findPairingStatus(this.repository, device.device_id),
      support_entitlement: this.supportEntitlement(device.device_id),
    };
  }

  auditCustomerAccess({ accountId, actorId, role, purpose, dataModelId, legalBasis, securityReason }) {
    let decision = "masked";
    let reason = "missing_consent_or_legal_basis";
    let consentId = null;
    if (legalBasis || securityReason) {
      decision = "full";
      reason = legalBasis ? "documented_legal_basis" : "security_reason";
    } else if (accountId) {
      const consent = this.repository.findValidConsent({ accountId, role, purpose });
      if (consent) {
        decision = "full";
        reason = "valid_consent";
        consentId = consent.consent_id;
      }
    }
    const event = this.repository.addAuditEvent({
      audit_event_id: createId("audit"),
      account_id: accountId || null,
      accessed_by_user_id: actorId,
      accessed_by_role: role,
      accessed_data_model_id: dataModelId,
      purpose,
      consent_id: consentId,
      access_decision: decision,
      rejection_reason: decision === "masked" ? reason : "",
    });
    return { decision, reason, audit_event_id: event.audit_event_id };
  }

  requireDevice(deviceId) {
    const device = this.repository.findDevice(deviceId);
    if (!device) throw new DeviceManagementError("device_not_found", "Device wurde nicht gefunden.", 404);
    return device;
  }
}

function normalizeCredential(deviceId, input) {
  const source = input.credential || {};
  const secret = input.device_secret || input.one_time_device_secret || source.secret || source.one_time_device_secret || "";
  return {
    device_id: deviceId,
    credential_id: source.credential_id || createId("cred"),
    credential_type: source.credential_type || "HMAC_SHA256",
    key_reference: source.key_reference || `device-key://${deviceId}/active`,
    status: "active",
    created_at: new Date().toISOString(),
    secret,
  };
}

function maskAdminDevice(device) {
  return {
    device_id: device.device_id,
    hardware_profile_id: device.hardware_profile_id,
    authenticity_status: device.authenticity_status,
    lifecycle_state: device.lifecycle_state,
    connectivity_status: device.connectivity_status,
    ota_status: device.ota_status,
  };
}

function inferCapabilities(device) {
  const capabilities = ["flash_firmware"];
  if (device.connectivity_status !== "unsupported") capabilities.push("wifi");
  if (device.ota_status === "ready") capabilities.push("ota");
  return capabilities;
}

function bestPurchaseContextId(repository, accountId, device) {
  const purchaseContext = findPurchaseContextForDevice(repository, accountId, device);
  return purchaseContext ? purchaseContext.purchase_context_id : "";
}

function findPurchaseContextForDevice(repository, accountId, device) {
  const contexts = repository.listPurchaseContexts(accountId);
  return contexts.find((context) => (
    context.support_basis === "gernetix_purchase_context"
    && context.hardware_item_ids.includes(device.hardware_profile_id)
  )) || null;
}

function parseCapabilities(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function findPairingStatus(repository, deviceId) {
  for (const accountId of repository.accountDevices.keys()) {
    if (repository.listAccountDevices(accountId).some((item) => item.device_id === deviceId)) return "paired_to_account";
  }
  return "unpaired";
}

function findAccountId(repository, deviceId) {
  for (const accountId of repository.accountDevices.keys()) {
    if (repository.listAccountDevices(accountId).some((item) => item.device_id === deviceId)) return accountId;
  }
  return null;
}

function createDeviceId(serialNumber) {
  return `device_${crypto.createHash("sha256").update(required(serialNumber, "serial_number").toUpperCase()).digest("hex").slice(0, 16)}`;
}

function createPairingCode() {
  return String(crypto.randomInt(100000, 999999));
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new DeviceManagementError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = { DeviceManagementService };
