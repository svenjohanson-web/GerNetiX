const crypto = require("node:crypto");
const { RecoveryToolError } = require("../errors");

class RecoveryService {
  constructor(options) {
    this.repository = options.repository;
    this.deviceManagementBaseUrl = options.deviceManagementBaseUrl;
    this.registerRecoveredDevices = options.registerRecoveredDevices !== false;
  }

  createSession(input = {}) {
    const now = new Date().toISOString();
    const detection = normalizeDetection(input.detection || input);
    const hardwareProfile = inferHardwareProfile(input.hardware_profile_id, detection);
    const session = {
      recovery_session_id: createId("recovery"),
      status: "detected",
      account_id: input.account_id || "",
      device_id: input.device_id || createDeviceId(detection.serial_number || detection.usb_path || now),
      serial_number: detection.serial_number,
      hardware_profile_id: hardwareProfile.hardware_profile_id,
      hardware_profile_source: hardwareProfile.source,
      detected_at: now,
      updated_at: now,
      detection,
      recovery_state: {
        connectivity: input.connectivity_status || "unknown",
        credential: "missing_or_unknown",
        pairing: "not_repaired",
        firmware: input.firmware_version || "",
      },
      capabilities: inferCapabilities(detection, input.capabilities),
      guided_questions: createGuidedQuestions(detection),
      actions: [{
        type: "device_detected",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
      }],
      device_management_registration: null,
    };
    return this.repository.saveSession(session);
  }

  listSessions(query = {}) {
    return { items: this.repository.listSessions(query) };
  }

  getSession(sessionId) {
    return this.requireSession(sessionId);
  }

  answerCapabilities(sessionId, input = {}) {
    const session = this.requireSession(sessionId);
    const now = new Date().toISOString();
    const capabilities = mergeCapabilities(session.capabilities, normalizeCapabilities(input.capabilities));
    const answeredQuestions = normalizeAnswers(input.answers);
    const next = {
      ...session,
      status: "capabilities_confirmed",
      updated_at: now,
      capabilities,
      guided_answers: answeredQuestions,
      actions: session.actions.concat({
        type: "capabilities_confirmed",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
        capability_ids: capabilities,
      }),
    };
    return this.repository.saveSession(next);
  }

  async registerCommunityDevice(sessionId, input = {}) {
    const session = this.requireSession(sessionId);
    if (!this.registerRecoveredDevices) {
      return this.markRegistered(session, {
        device_id: session.device_id,
        registration_mode: "dry_run",
        authenticity_status: "community_unverified",
      }, input);
    }

    const response = await fetch(`${this.deviceManagementBaseUrl.replace(/\/$/, "")}/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: session.device_id,
        serial_number: input.serial_number || session.serial_number,
        hardware_profile_id: input.hardware_profile_id || session.hardware_profile_id,
        authenticity_status: input.authenticity_status || "community_unverified",
        lifecycle_state: input.lifecycle_state || "recovered_by_customer",
        runtime_version: input.runtime_version || "",
        firmware_version: input.firmware_version || session.recovery_state.firmware,
        connectivity_status: input.connectivity_status || session.recovery_state.connectivity,
        ota_status: input.ota_status || "unknown",
        credential: input.credential,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new RecoveryToolError("device_management_registration_failed", "Device Management Registrierung fehlgeschlagen.", response.status, payload);
    }
    return this.markRegistered(session, payload, input);
  }

  renewCredentials(sessionId, input = {}) {
    const session = this.requireSession(sessionId);
    const now = new Date().toISOString();
    const publicKeyPem = String(input.public_key_pem || "").trim();
    const certificatePem = String(input.certificate_pem || "").trim();
    if (!publicKeyPem || !certificatePem) {
      throw new RecoveryToolError(
        "asymmetric_credential_required",
        "Recovery benoetigt einen auf dem Board erzeugten Public Key und ein ausgestelltes Clientzertifikat.",
        400,
      );
    }
    const credential = {
      credential_id: createId("cred"),
      credential_type: "ECDSA_P256_X509",
      algorithm: "ECDSA_P256_SHA256",
      key_reference: `device-key://${session.device_id}/recovery-${Date.now()}`,
      public_key_pem: publicKeyPem,
      certificate_pem: certificatePem,
      public_key_fingerprint_sha256: crypto.createHash("sha256").update(publicKeyPem).digest("hex"),
      issued_at: now,
    };
    const next = {
      ...session,
      status: "credentials_renewed",
      updated_at: now,
      recovery_state: { ...session.recovery_state, credential: "renewed" },
      credential: redactCredential(credential),
      actions: session.actions.concat({
        type: "credentials_renewed",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
        credential_id: credential.credential_id,
      }),
    };
    this.repository.saveSession(next);
    return next;
  }

  resetConnectivity(sessionId, input = {}) {
    const session = this.requireSession(sessionId);
    const now = new Date().toISOString();
    const next = {
      ...session,
      status: "connectivity_repair_prepared",
      updated_at: now,
      recovery_state: {
        ...session.recovery_state,
        connectivity: input.connectivity_status || "ap_mode_ready",
      },
      connectivity_repair: {
        mode: input.mode || "device_webserver",
        ssid_scan_required: input.ssid_scan_required !== false,
        store_wifi_password_centrally: false,
        recovery_url_hint: input.recovery_url_hint || "http://192.168.4.1",
      },
      actions: session.actions.concat({
        type: "connectivity_repair_prepared",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
      }),
    };
    return this.repository.saveSession(next);
  }

  markRegistered(session, registration, input = {}) {
    const now = new Date().toISOString();
    const next = {
      ...session,
      status: "registered_with_device_management",
      updated_at: now,
      recovery_state: {
        ...session.recovery_state,
        credential: input.credential ? "registered_with_public_key" : session.recovery_state.credential,
      },
      device_management_registration: registration,
      actions: session.actions.concat({
        type: "device_management_registered",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
      }),
    };
    return this.repository.saveSession(next);
  }

  requireSession(sessionId) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new RecoveryToolError("recovery_session_not_found", "Recovery Session wurde nicht gefunden.", 404);
    return session;
  }
}

function normalizeDetection(input = {}) {
  return {
    usb_path: input.usb_path || input.port || "",
    serial_number: input.serial_number || input.serial || createSerial(input.usb_path || input.port || "unknown"),
    vendor_id: input.vendor_id || "",
    product_id: input.product_id || "",
    chip_family: input.chip_family || inferChipFamily(input),
    bootloader_detected: input.bootloader_detected !== false,
  };
}

function inferHardwareProfile(explicitProfile, detection) {
  if (explicitProfile) return { hardware_profile_id: explicitProfile, source: "user_or_scan" };
  if (detection.chip_family === "esp32") {
    return { hardware_profile_id: "hardware.processor_board.generic_esp_wroom32", source: "usb_detection" };
  }
  return { hardware_profile_id: "hardware.community.unknown_board", source: "community_discovery" };
}

function inferCapabilities(detection, explicitCapabilities) {
  const capabilities = normalizeCapabilities(explicitCapabilities);
  if (detection.chip_family === "esp32") {
    capabilities.push("capability.processor_esp32", "capability.wifi", "capability.ota");
  }
  if (detection.bootloader_detected) capabilities.push("capability.flash_firmware");
  return Array.from(new Set(capabilities));
}

function createGuidedQuestions(detection) {
  return [
    { question_id: "wifi_available", capability_id: "capability.wifi", prompt: "Kann das Board WLAN nutzen?", default_answer: detection.chip_family === "esp32" },
    { question_id: "ota_supported", capability_id: "capability.ota", prompt: "Soll OTA nach der Wiederherstellung aktiviert werden?", default_answer: detection.chip_family === "esp32" },
    { question_id: "usb_flashable", capability_id: "capability.flash_firmware", prompt: "Ist Flashen ueber USB moeglich?", default_answer: detection.bootloader_detected },
  ];
}

function normalizeCapabilities(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeAnswers(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([key, answer]) => [key, Boolean(answer)]));
}

function mergeCapabilities(current, next) {
  return Array.from(new Set([...(current || []), ...next]));
}

function inferChipFamily(input = {}) {
  const text = `${input.vendor_id || ""}:${input.product_id || ""}:${input.usb_path || input.port || ""}`.toLowerCase();
  if (text.includes("esp32") || text.includes("10c4") || text.includes("1a86")) return "esp32";
  return "unknown";
}

function createSerial(seed) {
  return `REC-${crypto.createHash("sha256").update(String(seed)).digest("hex").slice(0, 10).toUpperCase()}`;
}

function createDeviceId(seed) {
  return `device_${crypto.createHash("sha256").update(String(seed).toUpperCase()).digest("hex").slice(0, 16)}`;
}

function redactCredential(credential) {
  return {
    credential_id: credential.credential_id,
    credential_type: credential.credential_type,
    key_reference: credential.key_reference,
    algorithm: credential.algorithm,
    public_key_fingerprint_sha256: credential.public_key_fingerprint_sha256,
    issued_at: credential.issued_at,
  };
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { RecoveryService };
