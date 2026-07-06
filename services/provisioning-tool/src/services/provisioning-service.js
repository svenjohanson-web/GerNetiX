const crypto = require("node:crypto");
const { ProvisioningError } = require("../errors");

class ProvisioningService {
  constructor(options) {
    this.repository = options.repository;
    this.deviceIdFactory = options.deviceIdFactory;
    this.credentialGenerator = options.credentialGenerator;
    this.flashPlanner = options.flashPlanner;
    this.deviceManagementBaseUrl = options.deviceManagementBaseUrl;
    this.registerDeviceOnComplete = options.registerDeviceOnComplete !== false;
  }

  createSession(input = {}) {
    validateInput(input);
    const deviceId = this.deviceIdFactory.createDeviceId(input.serial_number);
    if (this.repository.hasActiveCredential(deviceId)) {
      throw new ProvisioningError(
        "active_credential_exists",
        "Fuer dieses Device existiert bereits ein aktives Credential.",
        409,
      );
    }

    const credential = this.credentialGenerator.createCredential(deviceId);
    const manifest = createManifest({
      input,
      deviceId,
      credential,
      deviceManagementBaseUrl: this.deviceManagementBaseUrl,
    });
    const flashPlan = this.flashPlanner.createPlan(input, manifest);
    const now = new Date().toISOString();
    const session = {
      session_id: createId("prov"),
      status: "prepared",
      created_at: now,
      completed_at: null,
      device: {
        device_id: deviceId,
        serial_number: normalizeRequired(input.serial_number),
        hardware_profile_id: normalizeRequired(input.hardware_profile_id),
        authenticity_status: "gernetix_verified_pending_proof",
        lifecycle_state: "provisioning",
      },
      manufacturer_registration: {
        device_id: deviceId,
        provisioning_batch_id: normalizeRequired(input.provisioning_batch_id),
        provisioned_at: now,
        provisioned_by: normalizeRequired(input.provisioned_by),
        firmware_version: normalizeRequired(input.firmware_version),
        quality_check_state: "pending",
        support_entitlement_basis: "gernetix_manufacturer_registration",
        device_management_target: `${this.deviceManagementBaseUrl.replace(/\/$/, "")}/devices/register`,
      },
      credential: redactCredential(credential),
      manifest,
      flash_plan: flashPlan,
      audit_events: [
        {
          type: "provisioning_prepared",
          occurred_at: now,
          actor: normalizeRequired(input.provisioned_by),
        },
      ],
    };

    this.repository.saveSession(session);

    return {
      ...summarizeSession(session),
      one_time_device_secret: credential.one_time_device_secret,
    };
  }

  getSession(sessionId) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    return summarizeSession(session);
  }

  getManifest(sessionId) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    return session.manifest;
  }

  async completeSession(sessionId, input = {}) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    if (session.status === "completed") return summarizeSession(session);

    const now = new Date().toISOString();
    session.status = "completed";
    session.completed_at = now;
    session.manufacturer_registration.quality_check_state = input.quality_check_state || "passed";
    session.device.lifecycle_state = "provisioned_by_gernetix";
    session.audit_events.push({
      type: "provisioning_completed",
      occurred_at: now,
      actor: input.completed_by || session.manufacturer_registration.provisioned_by,
      quality_check_state: session.manufacturer_registration.quality_check_state,
    });
    if (this.registerDeviceOnComplete) {
      session.device_management_registration = await this.registerDeviceManagementDevice(session, input);
      session.audit_events.push({
        type: "device_management_registered",
        occurred_at: new Date().toISOString(),
        target: session.manufacturer_registration.device_management_target,
      });
    }
    return summarizeSession(this.repository.updateSession(sessionId, session));
  }

  async registerDeviceManagementDevice(session, input = {}) {
    const response = await fetch(`${this.deviceManagementBaseUrl.replace(/\/$/, "")}/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: session.device.device_id,
        serial_number: session.device.serial_number,
        hardware_profile_id: session.device.hardware_profile_id,
        gernetix_verified: true,
        lifecycle_state: "provisioned_by_gernetix",
        firmware_version: session.manufacturer_registration.firmware_version,
        provisioning_batch_id: session.manufacturer_registration.provisioning_batch_id,
        provisioned_at: session.manufacturer_registration.provisioned_at,
        provisioned_by: session.manufacturer_registration.provisioned_by,
        quality_check_state: session.manufacturer_registration.quality_check_state,
        connectivity_status: input.connectivity_status || "unknown",
        ota_status: input.ota_status || "ready",
        credential: {
          credential_id: session.credential.credential_id,
          credential_type: session.credential.credential_type,
          key_reference: session.credential.key_reference,
        },
        one_time_device_secret: input.one_time_device_secret || "",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ProvisioningError("device_management_registration_failed", "Device Management Registrierung fehlgeschlagen.", response.status, payload);
    }
    return payload;
  }
}

function createManifest({ input, deviceId, credential, deviceManagementBaseUrl }) {
  return {
    schema_version: 1,
    device_id: deviceId,
    serial_number: normalizeRequired(input.serial_number),
    hardware_profile_id: normalizeRequired(input.hardware_profile_id),
    firmware: {
      version: normalizeRequired(input.firmware_version),
      basis: "gernetix-runtime-basissoftware",
      ota_preserved: true,
    },
    service_endpoints: {
      device_management: input.service_endpoints && input.service_endpoints.device_management
        ? input.service_endpoints.device_management
        : deviceManagementBaseUrl,
      build_deploy: input.service_endpoints && input.service_endpoints.build_deploy
        ? input.service_endpoints.build_deploy
        : "",
    },
    credential: {
      credential_id: credential.credential_id,
      credential_type: credential.credential_type,
      key_reference: credential.key_reference,
      secret_sha256: credential.secret_sha256,
    },
    capabilities: Array.isArray(input.capabilities) ? input.capabilities.slice().sort() : [],
    provisioning: {
      batch_id: normalizeRequired(input.provisioning_batch_id),
      provisioned_by: normalizeRequired(input.provisioned_by),
    },
  };
}

function summarizeSession(session) {
  return {
    session_id: session.session_id,
    status: session.status,
    created_at: session.created_at,
    completed_at: session.completed_at,
    device: session.device,
    manufacturer_registration: session.manufacturer_registration,
    credential: session.credential,
    manifest_sha256: hashJson(session.manifest),
    flash_plan: session.flash_plan,
    device_management_registration: session.device_management_registration,
    audit_events: session.audit_events,
  };
}

function redactCredential(credential) {
  return {
    credential_id: credential.credential_id,
    credential_type: credential.credential_type,
    key_reference: credential.key_reference,
    status: credential.status,
    created_at: credential.created_at,
    secret_sha256: credential.secret_sha256,
  };
}

function validateInput(input) {
  for (const field of ["serial_number", "hardware_profile_id", "provisioning_batch_id", "firmware_version", "provisioned_by"]) {
    if (!normalizeRequired(input[field])) {
      throw new ProvisioningError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
    }
  }
}

function normalizeRequired(value) {
  return String(value || "").trim();
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { ProvisioningService };
