const crypto = require("node:crypto");
const { RecoveryToolError } = require("../errors");
const { createDiscoveryBuildPackage } = require("./hardware-discovery-package");

class RecoveryService {
  constructor(options) {
    this.repository = options.repository;
    this.deviceManagementBaseUrl = options.deviceManagementBaseUrl;
    this.registerRecoveredDevices = options.registerRecoveredDevices !== false;
    this.sourceReader = options.sourceReader;
    this.hardwareLabAi = options.hardwareLabAi;
    this.buildDeployClient = options.buildDeployClient;
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

  createHardwareLabSession(input = {}) {
    const now = new Date().toISOString();
    const accountId = requiredText(input.account_id, "hardware_lab_account_required", "Fuer das KI-gefuehrte Hardware-Labor ist die angemeldete Identity User-ID erforderlich.");
    if (["demo", "unknown", "anonymous"].includes(accountId.toLowerCase())) {
      throw new RecoveryToolError("hardware_lab_identity_fallback_forbidden", "Eine Demo- oder Fallback-ID ist fuer das Hardware-Labor nicht erlaubt.", 400);
    }
    const boardName = requiredText(input.board_name, "board_name_required", "Bitte einen Board-Namen angeben.");
    const sources = normalizeSourceUrls(input.source_urls || input.sources);
    if (sources.length === 0) {
      throw new RecoveryToolError("hardware_sources_required", "Mindestens eine Herstellerseite oder Datenblatt-URL ist erforderlich.", 400);
    }
    const session = {
      recovery_session_id: createId("hardware_lab"),
      recovery_type: "ai_guided_hardware_lab",
      status: "source_submitted",
      account_id: accountId,
      device_id: "",
      serial_number: "",
      hardware_profile_id: "hardware.community.pending_board_profile",
      hardware_profile_source: "hardware_lab_source_intake",
      created_at: now,
      detected_at: "",
      updated_at: now,
      candidate_profile: {
        board_name: boardName,
        manufacturer: String(input.manufacturer || "").trim(),
        board_origin: "customer_purchased_community_board",
        notes: String(input.notes || "").trim(),
        source_evidence: sources.map((source_url) => ({ source_url, review_status: "pending_ai_analysis" })),
      },
      discovery: {
        mandatory: true,
        verification_status: "discovery_pending",
        firmware_build: { status: "not_started" },
        examination: { status: "not_started" },
        required_phases: [
          "chip_and_memory",
          "boot_flash_and_recovery",
          "safe_bus_and_peripheral_scan",
          "runtime_and_connectivity",
          "source_comparison",
        ],
        safety_rule: "Only pins and buses allowed by the source-derived safety profile may be actively driven.",
      },
      capabilities: [],
      guided_questions: [],
      actions: [{
        type: "hardware_lab_source_submitted",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
        source_count: sources.length,
      }],
      gernetix_verification_request: null,
      device_management_registration: null,
    };
    return this.repository.saveSession(session);
  }

  async analyzeHardwareLabSources(sessionId, input = {}) {
    const session = this.requireHardwareLabSession(sessionId);
    if (!this.sourceReader || !this.hardwareLabAi) throw new RecoveryToolError("hardware_lab_ai_not_configured", "Die KI-Quellenanalyse ist nicht konfiguriert.", 503);
    const now = new Date().toISOString();
    this.repository.saveSession({
      ...session,
      status: "ai_source_analysis_running",
      updated_at: now,
      actions: session.actions.concat({ type: "ai_source_analysis_started", occurred_at: now, actor: input.actor || "recovery-tool" }),
    });
    try {
      const sourceUrls = session.candidate_profile.source_evidence.map((item) => item.source_url);
      const sources = await this.sourceReader.readAll(sourceUrls);
      const analysis = await this.hardwareLabAi.analyze({
        account_id: session.account_id,
        board_name: session.candidate_profile.board_name,
        manufacturer: session.candidate_profile.manufacturer,
        notes: session.candidate_profile.notes,
        sources,
      });
      const completedAt = new Date().toISOString();
      const next = {
        ...session,
        status: "ai_profile_ready",
        updated_at: completedAt,
        candidate_profile: {
          ...session.candidate_profile,
          ...analysis.profile,
          board_origin: "customer_purchased_community_board",
          source_evidence: session.candidate_profile.source_evidence.map((item) => ({ ...item, review_status: "analyzed" })),
        },
        source_read_results: sources.map(redactSourceReadResult),
        ai_analysis: {
          status: "completed",
          completed_at: completedAt,
          provider: analysis.provider,
          model: analysis.model,
          response_id: analysis.response_id,
          usage: analysis.usage,
          profile: analysis.profile,
        },
        actions: session.actions.concat({
          type: "ai_source_analysis_completed",
          occurred_at: completedAt,
          actor: input.actor || "recovery-tool",
          model: analysis.model,
          source_count: sources.length,
        }),
      };
      return this.repository.saveSession(next);
    } catch (error) {
      const failedAt = new Date().toISOString();
      this.repository.saveSession({
        ...session,
        status: "ai_source_analysis_failed",
        updated_at: failedAt,
        ai_analysis: { status: "failed", failed_at: failedAt, error_code: error.code || "hardware_lab_ai_failed" },
        actions: session.actions.concat({ type: "ai_source_analysis_failed", occurred_at: failedAt, actor: input.actor || "recovery-tool", error_code: error.code || "hardware_lab_ai_failed" }),
      });
      throw error;
    }
  }

  async requestDiscoveryFirmwareBuild(sessionId, input = {}) {
    const session = this.requireHardwareLabSession(sessionId);
    if (!session.ai_analysis?.profile) throw new RecoveryToolError("hardware_ai_analysis_required", "Bitte zuerst die Herstellerquellen mit der KI analysieren.", 409);
    if (!this.buildDeployClient) throw new RecoveryToolError("hardware_discovery_build_not_configured", "Build-&-Deploy ist fuer das Hardware-Labor nicht konfiguriert.", 503);
    const now = new Date().toISOString();
    if (session.discovery.examination.status === "passed") {
      throw new RecoveryToolError("hardware_already_examined", "Die verpflichtende Hardware-Untersuchung wurde bereits abgeschlossen.", 409);
    }
    const buildRequest = createDiscoveryBuildPackage(session);
    const requested = {
      ...session,
      status: "discovery_build_requested",
      updated_at: now,
      discovery: {
        ...session.discovery,
        firmware_build: {
          status: "requested",
          requested_at: now,
          requested_chip_family: String(input.chip_family || "auto_detect").trim(),
          source_profile_revision: String(input.source_profile_revision || "draft-1").trim(),
          build_contract: "gernetix_hardware_lab_discovery_v1",
          build_job_id: buildRequest.job_id,
          discovery_mode: buildRequest.manifest.discovery_mode,
          active_pin_tests_enabled: false,
        },
      },
      actions: session.actions.concat({
        type: "discovery_firmware_build_requested",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
      }),
    };
    this.repository.saveSession(requested);
    try {
      const accepted = await this.buildDeployClient.submit(buildRequest);
      const acceptedAt = new Date().toISOString();
      return this.repository.saveSession({
        ...requested,
        status: "discovery_build_running",
        updated_at: acceptedAt,
        discovery: {
          ...requested.discovery,
          firmware_build: { ...requested.discovery.firmware_build, status: accepted.status || "accepted", accepted_at: acceptedAt },
        },
        actions: requested.actions.concat({ type: "discovery_firmware_build_accepted", occurred_at: acceptedAt, actor: "build-deploy-server", build_job_id: buildRequest.job_id }),
      });
    } catch (error) {
      const failedAt = new Date().toISOString();
      this.repository.saveSession({
        ...requested,
        status: "discovery_build_failed",
        updated_at: failedAt,
        discovery: { ...requested.discovery, firmware_build: { ...requested.discovery.firmware_build, status: "failed", failure_code: error.code || "build_submission_failed" } },
      });
      throw error;
    }
  }

  async synchronizeDiscoveryFirmwareBuild(sessionId) {
    const session = this.requireHardwareLabSession(sessionId);
    const buildJobId = session.discovery?.firmware_build?.build_job_id;
    if (!buildJobId) throw new RecoveryToolError("discovery_build_request_required", "Es wurde noch kein Discovery-Build angefordert.", 409);
    const job = await this.buildDeployClient.get(buildJobId);
    if (job.status === "succeeded") {
      const primary = job.result?.build?.primary_firmware;
      if (!primary?.sha256 || !primary?.file_name) throw new RecoveryToolError("discovery_build_artifact_missing", "Der erfolgreiche Discovery-Build enthaelt kein primaeres Firmware-Artefakt.", 502);
      const now = new Date().toISOString();
      return this.repository.saveSession({
        ...session,
        status: "discovery_firmware_ready",
        updated_at: now,
        discovery: {
          ...session.discovery,
          firmware_build: {
            ...session.discovery.firmware_build,
            status: "success",
            build_id: job.result.build.build_id || primary.sha256,
            firmware_sha256: primary.sha256,
            artifact_file_name: primary.file_name,
            artifact_url: this.buildDeployClient.artifactUrl(buildJobId, primary.file_name),
            completed_at: job.finished_at || now,
          },
        },
        actions: session.actions.concat({ type: "discovery_firmware_build_success", occurred_at: now, actor: "build-deploy-server", build_job_id: buildJobId }),
      });
    }
    if (["failed", "cancelled", "replaced"].includes(job.status)) {
      const now = new Date().toISOString();
      return this.repository.saveSession({
        ...session,
        status: "discovery_build_failed",
        updated_at: now,
        discovery: { ...session.discovery, firmware_build: { ...session.discovery.firmware_build, status: job.status, failure_code: job.error?.code || job.status } },
      });
    }
    return this.repository.saveSession({
      ...session,
      status: "discovery_build_running",
      updated_at: new Date().toISOString(),
      discovery: { ...session.discovery, firmware_build: { ...session.discovery.firmware_build, status: job.status, progress: job.progress || [] } },
    });
  }

  recordDiscoveryFirmwareBuild(sessionId, input = {}) {
    const session = this.requireHardwareLabSession(sessionId);
    if (!["requested", "accepted", "queued", "running"].includes(session.discovery.firmware_build.status)) {
      throw new RecoveryToolError(
        "discovery_build_request_required",
        "Ein Discovery-Build-Ergebnis wird nur fuer einen zuvor angeforderten Build akzeptiert.",
        409,
      );
    }
    const now = new Date().toISOString();
    const status = input.status === "success" ? "success" : "failed";
    if (status === "success") {
      requiredText(input.build_id, "discovery_build_id_required", "Ein erfolgreicher Discovery-Build benoetigt eine Build-ID.");
      validateSha256(input.firmware_sha256);
    }
    const next = {
      ...session,
      status: status === "success" ? "discovery_firmware_ready" : "discovery_build_failed",
      updated_at: now,
      discovery: {
        ...session.discovery,
        firmware_build: {
          ...session.discovery.firmware_build,
          status,
          build_id: String(input.build_id || "").trim(),
          firmware_sha256: String(input.firmware_sha256 || "").trim().toLowerCase(),
          completed_at: now,
          failure_code: status === "failed" ? String(input.failure_code || "build_failed").trim() : "",
        },
      },
      actions: session.actions.concat({
        type: `discovery_firmware_build_${status}`,
        occurred_at: now,
        actor: input.actor || "build-deploy-server",
      }),
    };
    return this.repository.saveSession(next);
  }

  recordHardwareExamination(sessionId, input = {}) {
    const session = this.requireHardwareLabSession(sessionId);
    if (session.discovery.firmware_build.status !== "success") {
      throw new RecoveryToolError(
        "successful_discovery_build_required",
        "Die reale Hardware darf erst nach einem erfolgreichen Discovery-Firmware-Build bestaetigt werden.",
        409,
      );
    }
    const reportBuildId = requiredText(input.firmware_build_id, "hardware_report_build_id_required", "Der Hardware-Pruefbericht benoetigt die ausgefuehrte Build-ID.");
    if (reportBuildId !== session.discovery.firmware_build.build_id) {
      throw new RecoveryToolError("hardware_report_build_mismatch", "Der Hardware-Pruefbericht gehoert nicht zum freigegebenen Discovery-Build.", 409);
    }
    const reportFirmwareSha256 = String(input.firmware_sha256 || "").trim().toLowerCase();
    validateSha256(reportFirmwareSha256);
    if (reportFirmwareSha256 !== session.discovery.firmware_build.firmware_sha256) {
      throw new RecoveryToolError("hardware_report_firmware_mismatch", "Die ausgefuehrte Discovery-Firmware stimmt nicht mit dem freigegebenen Build ueberein.", 409);
    }
    const completedPhases = normalizeCapabilities(input.completed_phases);
    const missingPhases = session.discovery.required_phases.filter((phase) => !completedPhases.includes(phase));
    if (missingPhases.length > 0) {
      throw new RecoveryToolError(
        "hardware_examination_incomplete",
        "Der Hardware-Pruefbericht deckt noch nicht alle Pflichtphasen ab.",
        400,
        { missing_phases: missingPhases },
      );
    }
    if (input.safe_detection_complete !== true || input.result !== "passed") {
      throw new RecoveryToolError(
        "hardware_examination_not_passed",
        "Nur eine vollstaendige und bestandene sichere Hardware-Untersuchung kann das Boardprofil abschliessen.",
        400,
      );
    }
    const now = new Date().toISOString();
    const next = {
      ...session,
      status: "hardware_examined",
      updated_at: now,
      detection: normalizeDetection(input.detection || {}),
      capabilities: normalizeCapabilities(input.capabilities),
      discovery: {
        ...session.discovery,
        verification_status: "hardware_examined",
        examination: {
          status: "passed",
          examined_at: now,
          firmware_build_id: session.discovery.firmware_build.build_id,
          firmware_sha256: reportFirmwareSha256,
          completed_phases: completedPhases,
          safe_detection_complete: true,
          report_id: requiredText(input.report_id, "hardware_report_id_required", "Der Hardware-Pruefbericht benoetigt eine Report-ID."),
          findings: normalizeFindings(input.findings),
          source_conflicts: normalizeFindings(input.source_conflicts),
        },
      },
      actions: session.actions.concat({
        type: "mandatory_hardware_examination_passed",
        occurred_at: now,
        actor: input.actor || "hardware-lab-discovery-firmware",
      }),
    };
    return this.repository.saveSession(next);
  }

  requestGerNetiXVerification(sessionId, input = {}) {
    const session = this.requireHardwareLabSession(sessionId);
    if (session.discovery.examination.status !== "passed") {
      throw new RecoveryToolError(
        "hardware_examination_required",
        "Eine GerNetiX-Pruefanfrage ist erst nach der verpflichtenden realen Hardware-Untersuchung moeglich.",
        409,
      );
    }
    if (input.consent_to_share_profile !== true) {
      throw new RecoveryToolError(
        "verification_consent_required",
        "Bitte der Uebermittlung des Hardwareprofils und Pruefberichts an GerNetiX ausdruecklich zustimmen.",
        400,
      );
    }
    const now = new Date().toISOString();
    const request = {
      verification_request_id: createId("hardware_verification"),
      status: "submitted",
      submitted_at: now,
      account_id: session.account_id,
      board_origin: "customer_purchased_community_board",
      follow_up_required: true,
      consent_to_share_profile: true,
      consent_recorded_at: now,
      customer_message: String(input.customer_message || "").trim(),
      shared_scope: ["candidate_profile", "source_evidence", "hardware_examination_report"],
      shipping_details_collected: false,
    };
    const next = {
      ...session,
      status: "gernetix_verification_requested",
      updated_at: now,
      gernetix_verification_request: request,
      actions: session.actions.concat({
        type: "gernetix_hardware_verification_requested",
        occurred_at: now,
        actor: input.actor || "recovery-tool",
        verification_request_id: request.verification_request_id,
      }),
    };
    return this.repository.saveSession(next);
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

  requireHardwareLabSession(sessionId) {
    const session = this.requireSession(sessionId);
    if (session.recovery_type !== "ai_guided_hardware_lab") {
      throw new RecoveryToolError("hardware_lab_session_required", "Dieser Vorgang ist keine Hardware-Labor-Session.", 409);
    }
    return session;
  }
}

function requiredText(value, code, message) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new RecoveryToolError(code, message, 400);
  return normalized;
}

function normalizeSourceUrls(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/\r?\n|,/);
  const urls = [];
  for (const item of values) {
    const text = String(item || "").trim();
    if (!text) continue;
    let parsed;
    try {
      parsed = new URL(text);
    } catch {
      throw new RecoveryToolError("invalid_hardware_source_url", `Ungueltige Hardware-Quelle: ${text}`, 400);
    }
    if (!new Set(["https:", "http:"]).has(parsed.protocol)) {
      throw new RecoveryToolError("invalid_hardware_source_protocol", "Hardware-Quellen muessen HTTP- oder HTTPS-URLs sein.", 400);
    }
    urls.push(parsed.toString());
  }
  return Array.from(new Set(urls)).slice(0, 8);
}

function validateSha256(value) {
  if (!/^[a-f0-9]{64}$/i.test(String(value || "").trim())) {
    throw new RecoveryToolError("invalid_firmware_sha256", "Der Discovery-Build benoetigt eine gueltige SHA-256-Pruefsumme.", 400);
  }
}

function normalizeFindings(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).map((finding) => {
    if (finding && typeof finding === "object") {
      return {
        property: String(finding.property || "").trim(),
        observed_value: String(finding.observed_value || "").trim(),
        source_value: String(finding.source_value || "").trim(),
        status: String(finding.status || "observed").trim(),
      };
    }
    return { property: String(finding), observed_value: "", source_value: "", status: "observed" };
  }).filter((finding) => finding.property);
}

function redactSourceReadResult(source) {
  return {
    source_url: source.source_url,
    final_url: source.final_url,
    content_type: source.content_type,
    kind: source.kind,
    byte_length: source.byte_length,
    truncated: source.truncated === true,
  };
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
