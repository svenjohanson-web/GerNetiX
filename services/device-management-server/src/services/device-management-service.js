const crypto = require("node:crypto");
const { DeviceManagementError } = require("../errors");
const {
  applyProfileCapabilities,
  normalizeBasissoftwareProfile,
  profileChangeRequiresUsb,
} = require("../../../shared");

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

    if (input.credential) {
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

  pushRecipients(deviceId) {
    this.requireDevice(deviceId);
    return { device_id: deviceId, account_ids: this.repository.findAccountIdsByDeviceId(deviceId) };
  }

  createChallenge(deviceId) {
    this.requireDevice(deviceId);
    const challenge = {
      challenge_id: createId("challenge"),
      device_id: deviceId,
      challenge: crypto.randomBytes(32).toString("base64url"),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      used_at: null,
    };
    challenge.canonical = challengeCanonical(challenge);
    return this.repository.saveChallenge(challenge);
  }

  verifyChallenge(deviceId, input = {}) {
    const device = this.requireDevice(deviceId);
    const challenge = this.repository.findChallenge(input.challenge_id);
    const credential = this.repository.findCredential(deviceId);
    if (!challenge || challenge.device_id !== deviceId || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now()) {
      throw new DeviceManagementError("invalid_challenge", "Challenge ist ungueltig oder bereits verwendet.", 400);
    }
    if (!credential || !credential.public_key_pem || credential.status !== "active") {
      throw new DeviceManagementError("credential_missing", "Fuer dieses Device ist kein pruefbares Credential hinterlegt.", 400);
    }

    let verified = false;
    try {
      verified = crypto.verify(
        "sha256",
        Buffer.from(challenge.canonical || challengeCanonical(challenge)),
        { key: credential.public_key_pem, dsaEncoding: "ieee-p1363" },
        Buffer.from(String(input.signature || ""), "base64url"),
      );
    } catch {
      verified = false;
    }
    this.repository.markChallengeUsed(challenge.challenge_id);

    const next = {
      ...device,
      authenticity_status: verified ? "gernetix_verified" : "community_unverified",
      last_authenticity_proof: {
        proof_type: "ECDSA_P256_SHA256",
        credential_id: credential.credential_id,
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

  createProvisioningToken(input = {}) {
    const now = new Date();
    const token = crypto.randomBytes(32).toString("base64url");
    const record = {
      provisioning_token_id: createId("provisioning_token"),
      account_id: required(input.account_id, "account_id"),
      provisioning_binding: required(input.provisioning_binding, "provisioning_binding"),
      token_hash_sha256: sha256(token),
      status: "issued",
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      consumed_at: null,
    };
    this.repository.saveProvisioningToken(record);
    this.repository.addAuditEvent({
      audit_event_id: createId("audit"),
      account_id: record.account_id,
      accessed_by_user_id: record.account_id,
      accessed_by_role: "account_owner",
      accessed_data_model_id: "ProvisioningToken",
      purpose: "usb_wifi_provisioning",
      access_decision: "issued",
      rejection_reason: "",
    });
    return {
      provisioning_token: token,
      provisioning_token_id: record.provisioning_token_id,
      expires_at: record.expires_at,
      provisioning_binding: record.provisioning_binding,
    };
  }

  consumeProvisioningToken(input = {}) {
    const token = required(input.provisioning_token, "provisioning_token");
    const record = this.repository.findProvisioningTokenByHash(sha256(token));
    const binding = required(input.provisioning_binding, "provisioning_binding");
    if (!record || record.status !== "issued" || Date.parse(record.expires_at) <= Date.now() || record.provisioning_binding !== binding) {
      throw new DeviceManagementError("invalid_provisioning_token", "Der Provisionierungs-Token ist ungueltig, abgelaufen oder bereits verwendet.", 403);
    }
    const consumed = { ...record, status: "consumed", consumed_at: new Date().toISOString() };
    this.repository.saveProvisioningToken(consumed);
    this.repository.addAuditEvent({
      audit_event_id: createId("audit"),
      account_id: consumed.account_id,
      accessed_by_user_id: consumed.account_id,
      accessed_by_role: "account_owner",
      accessed_data_model_id: "ProvisioningToken",
      purpose: "usb_wifi_provisioning",
      access_decision: "consumed",
      rejection_reason: "",
    });
    return {
      account_id: consumed.account_id,
      provisioning_token_id: consumed.provisioning_token_id,
      consumed_at: consumed.consumed_at,
    };
  }

  updateAccountDeviceBasissoftwareProfile(accountId, accountDeviceId, input = {}) {
    const accountDevice = this.repository.findAccountDevice(accountId, accountDeviceId);
    if (!accountDevice) throw new DeviceManagementError("account_device_not_found", "AccountDevice wurde nicht gefunden.", 404);
    const requested = normalizeBasissoftwareProfile(input.basissoftware_profile || input.profile || input.profile_id);
    if (!requested) throw new DeviceManagementError("invalid_basissoftware_profile", "Unbekanntes Basissoftware-Profil.", 400);
    const current = accountDevice.instance_configuration?.basissoftware_profile || null;
    const requiresUsbReflash = profileChangeRequiresUsb(current, requested);
    const changedAt = new Date().toISOString();
    const basissoftwareProfile = {
      ...requested,
      change_state: requiresUsbReflash ? "usb_reflash_required" : "selected",
      changed_at: changedAt,
    };
    const updated = {
      ...accountDevice,
      technical_capability_ids: applyProfileCapabilities(accountDevice.technical_capability_ids, requested),
      ota_status: requested.class === "low" ? "unsupported" : requiresUsbReflash ? "profile_change_pending" : accountDevice.ota_status,
      instance_configuration: {
        ...(accountDevice.instance_configuration || {}),
        basissoftware_profile: basissoftwareProfile,
      },
    };
    this.repository.saveAccountDevice(updated);
    return {
      account_device: updated,
      requires_usb_reflash: requiresUsbReflash,
      message: requiresUsbReflash
        ? "Das Profil wurde gespeichert. Fuer die neue Speicheraufteilung ist ein einmaliger USB-Flash erforderlich."
        : "Das Profil wurde gespeichert.",
    };
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
    const purchaseContextId = input.purchase_context_id || input.order_id || createId("purchase_context");
    const purchaseContext = {
      purchase_context_id: purchaseContextId,
      account_id: accountId,
      source_order_id: input.order_id || input.source_order_id || "",
      purchased_offer_ids: parseCapabilities(input.purchased_offer_ids || []),
      hardware_item_ids: parseCapabilities(input.hardware_item_ids || []),
      capability_ids: parseCapabilities(input.capability_ids || []),
      support_basis: input.support_basis || "component_or_community_context",
      provisioning_profile_ids: parseCapabilities(input.provisioning_profile_ids || []),
      claimable_hardware_units: normalizeClaimableHardwareUnits(input.claimable_hardware_units || [], {
        accountId,
        purchaseContextId,
        capabilityIds: parseCapabilities(input.capability_ids || []),
      }),
      registered_at: now,
    };
    this.repository.savePurchaseContext(accountId, purchaseContext);
    return purchaseContext;
  }

  listPurchaseContexts(accountId) {
    return this.repository.listPurchaseContexts(accountId);
  }

  listClaimableHardwareUnits(accountId) {
    return this.repository.listPurchaseContexts(accountId)
      .flatMap((context) => (context.claimable_hardware_units || []).map((unit) => sanitizeClaimableHardwareUnit(unit, context)));
  }

  claimHardwareUnit(accountId, input = {}) {
    const claimCode = required(input.claim_code || input.claimCode, "claim_code");
    const claimCodeHash = sha256(claimCode);
    for (const context of this.repository.listPurchaseContexts(accountId)) {
      const units = context.claimable_hardware_units || [];
      const unit = units.find((item) => item.claim_code_hash_sha256 === claimCodeHash);
      if (!unit) continue;
      if (unit.target_account_id && unit.target_account_id !== accountId) {
        throw new DeviceManagementError("claim_code_not_for_account", "Dieser Claim-Code gehoert nicht zu diesem Account.", 403);
      }
      if (unit.claim_state === "claimed") {
        throw new DeviceManagementError("hardware_unit_already_claimed", "Diese Hardware-Einheit ist bereits inventarisiert.", 409);
      }
      const now = new Date().toISOString();
      const displayName = String(input.display_name || input.displayName || "GerNetiX Flashbox").trim().slice(0, 120) || "GerNetiX Flashbox";
      const registered = this.registerDevice({
        device_id: input.device_id || createDeviceId(unit.serial_number),
        serial_number: unit.serial_number,
        hardware_profile_id: unit.hardware_item_id,
        authenticity_status: "gernetix_verified",
        gernetix_verified: true,
        lifecycle_state: "gernetix_flashbox_claimed",
        connectivity_status: input.connectivity_status || "unknown",
        ota_status: input.ota_status || "ready",
        app_version: input.app_version || unit.firmware_version || "",
        runtime_version: input.runtime_version || "",
        purchase_context_id: context.purchase_context_id,
        instance_configuration: {
          role: unit.hardware_class || "flashbox",
          hardware_unit_id: unit.unit_id,
          supported_target_families: unit.supported_target_families || ["esp32", "esp32-s3", "esp32-c3", "esp32-c6"],
          self_update_policy: "a_b_verified_rollback",
        },
      });
      const accountDevice = this.repository.saveAccountDevice({
        account_device_id: createId("account_device"),
        account_id: accountId,
        device_id: registered.device_id,
        display_name: displayName,
        hardware_profile_id: unit.hardware_item_id,
        hardware_class: unit.hardware_class || "flashbox",
        technical_capability_ids: unit.capability_ids || flashboxCapabilities(),
        board_short_name: "",
        node_name: "",
        instance_configuration: {
          role: unit.hardware_class || "flashbox",
          hardware_unit_id: unit.unit_id,
          purchase_claim: {
            claimed_at: now,
            purchase_context_id: context.purchase_context_id,
          },
        },
        purchase_context_id: context.purchase_context_id,
        authenticity_status: "gernetix_verified",
        connectivity_status: registered.connectivity_status,
        ota_status: registered.ota_status,
        ownership_status: "claimed_purchase_unit",
        paired_at: now,
      });
      const updatedContext = {
        ...context,
        claimable_hardware_units: units.map((item) => item.unit_id === unit.unit_id ? {
          ...item,
          claim_state: "claimed",
          claimed_at: now,
          claimed_account_device_id: accountDevice.account_device_id,
          claimed_device_id: accountDevice.device_id,
        } : item),
      };
      this.repository.savePurchaseContext(accountId, updatedContext);
      this.repository.addAuditEvent({
        audit_event_id: createId("audit"),
        account_id: accountId,
        accessed_by_user_id: accountId,
        accessed_by_role: "account_owner",
        accessed_data_model_id: "HardwareUnitClaim",
        purpose: "flashbox_inventory_claim",
        access_decision: "claimed",
        rejection_reason: "",
      });
      return {
        hardware_unit: sanitizeClaimableHardwareUnit(updatedContext.claimable_hardware_units.find((item) => item.unit_id === unit.unit_id), updatedContext),
        account_device: accountDevice,
        device: registered,
      };
    }
    throw new DeviceManagementError("claim_code_not_found", "Claim-Code wurde fuer diesen Account nicht gefunden.", 404);
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
        expires_at: credential.expires_at || null,
        revoked_at: credential.revoked_at || null,
        public_key_fingerprint_sha256: credential.public_key_fingerprint_sha256,
        certificate_fingerprint_sha256: credential.certificate_fingerprint_sha256 || "",
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
  const publicKeyPem = required(source.public_key_pem, "credential.public_key_pem");
  let publicKey;
  try {
    publicKey = crypto.createPublicKey(publicKeyPem);
  } catch {
    throw new DeviceManagementError("invalid_device_public_key", "Device Public Key ist ungueltig.", 400);
  }
  if (publicKey.asymmetricKeyType !== "ec" || publicKey.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new DeviceManagementError("unsupported_device_public_key", "Device Public Key muss ECDSA P-256 verwenden.", 400);
  }
  const normalizedPublicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const publicKeyFingerprint = crypto.createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex");
  let certificateFingerprint = "";
  let certificateExpiresAt = null;
  if (source.certificate_pem) {
    try {
      const certificate = new crypto.X509Certificate(source.certificate_pem);
      const certificatePublicKey = certificate.publicKey.export({ type: "spki", format: "der" });
      const registeredPublicKey = publicKey.export({ type: "spki", format: "der" });
      if (!certificatePublicKey.equals(registeredPublicKey)) throw new Error("public-key-mismatch");
      const commonName = certificate.subject.split(/\n|,/).map((part) => part.trim()).find((part) => part.startsWith("CN="));
      if (commonName !== `CN=${deviceId}`) throw new Error("subject-mismatch");
      certificateFingerprint = certificate.fingerprint256.replaceAll(":", "").toLowerCase();
      certificateExpiresAt = new Date(certificate.validTo).toISOString();
    } catch {
      throw new DeviceManagementError("invalid_device_certificate", "Device Client-Zertifikat ist ungueltig oder passt nicht zu Device-ID und Public Key.", 400);
    }
  }
  return {
    device_id: deviceId,
    credential_id: source.credential_id || createId("cred"),
    credential_type: "ECDSA_P256_X509",
    key_reference: source.key_reference || `device-key://${deviceId}/active`,
    algorithm: "ECDSA_P256_SHA256",
    status: source.status || "active",
    created_at: source.created_at || new Date().toISOString(),
    expires_at: certificateExpiresAt || source.expires_at || null,
    revoked_at: source.revoked_at || null,
    replaced_by: source.replaced_by || null,
    public_key_pem: normalizedPublicKeyPem,
    public_key_fingerprint_sha256: publicKeyFingerprint,
    certificate_pem: source.certificate_pem || "",
    certificate_fingerprint_sha256: certificateFingerprint,
  };
}

function challengeCanonical(challenge) {
  return ["gernetix-device-auth-v1", challenge.challenge_id, challenge.device_id, challenge.challenge].join("\n");
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

function normalizeClaimableHardwareUnits(units, context) {
  if (!Array.isArray(units)) return [];
  return units.map((unit) => {
    const claimCodeHash = unit.claim_code_hash_sha256 || (unit.claim_code ? sha256(unit.claim_code) : "");
    return {
      unit_id: required(unit.unit_id, "claimable_hardware_units.unit_id"),
      hardware_item_id: required(unit.hardware_item_id, "claimable_hardware_units.hardware_item_id"),
      hardware_class: unit.hardware_class || "hardware_unit",
      offer_id: unit.offer_id || "",
      serial_number: required(unit.serial_number, "claimable_hardware_units.serial_number"),
      claim_code_hash_sha256: required(claimCodeHash, "claimable_hardware_units.claim_code_hash_sha256"),
      claim_state: unit.claim_state === "claimed" ? "claimed" : "unclaimed",
      target_account_id: unit.target_account_id || context.accountId,
      purchase_context_id: unit.purchase_context_id || context.purchaseContextId,
      capability_ids: parseCapabilities(unit.capability_ids || context.capabilityIds || []),
      supported_target_families: parseCapabilities(unit.supported_target_families || []),
      claimed_at: unit.claimed_at || "",
      claimed_account_device_id: unit.claimed_account_device_id || "",
      claimed_device_id: unit.claimed_device_id || "",
    };
  });
}

function sanitizeClaimableHardwareUnit(unit, context) {
  return {
    unit_id: unit.unit_id,
    hardware_item_id: unit.hardware_item_id,
    hardware_class: unit.hardware_class,
    offer_id: unit.offer_id || "",
    serial_number: unit.serial_number,
    claim_state: unit.claim_state || "unclaimed",
    purchase_context_id: unit.purchase_context_id || context.purchase_context_id,
    claimed_at: unit.claimed_at || "",
    claimed_account_device_id: unit.claimed_account_device_id || "",
    claimed_device_id: unit.claimed_device_id || "",
  };
}

function flashboxCapabilities() {
  return [
    "capability.processor_esp32",
    "capability.wifi",
    "capability.ota",
    "capability.display_output",
    "capability.touchscreen_input",
    "capability.usb_otg_host",
    "capability.flash_firmware",
    "capability.flashbox_target_flash",
    "capability.flashbox_self_update",
    "capability.flashbox_manifest_download",
  ];
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new DeviceManagementError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

module.exports = { DeviceManagementService };
