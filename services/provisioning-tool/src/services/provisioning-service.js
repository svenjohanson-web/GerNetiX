const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const { ProvisioningError } = require("../errors");

const execFileAsync = promisify(execFile);

class ProvisioningService {
  constructor(options) {
    this.repository = options.repository;
    this.deviceIdFactory = options.deviceIdFactory;
    this.credentialGenerator = options.credentialGenerator;
    this.certificateIssuer = options.certificateIssuer || null;
    this.otaTrust = options.otaTrust || {};
    this.flashPlanner = options.flashPlanner;
    this.firmwareArtifactStore = options.firmwareArtifactStore;
    this.hardwareCatalog = options.hardwareCatalog;
    this.deviceManagementBaseUrl = options.deviceManagementBaseUrl;
    this.registerDeviceOnComplete = options.registerDeviceOnComplete !== false;
    this.allowFirmwareArtifactAdminWrite = options.allowFirmwareArtifactAdminWrite === true;
    this.generatedProvisioningHeaderPath = options.generatedProvisioningHeaderPath;
    this.firmwareArtifact = options.firmwareArtifact || null;
    this.usbFlashRunner = options.usbFlashRunner;
    this.flashJobs = new Map();
    this.fetchImpl = options.fetchImpl || fetch;
    this.wifiSsidProvider = options.wifiSsidProvider || currentWifiSsid;
  }

  async createSession(input = {}) {
    validateInput(input);
    const target = await this.resolveProvisioningTarget(input);
    const processorBoard = target.hardware_class === "processor_board" ? target.item : null;
    const flashbox = target.hardware_class === "flashbox" ? target.item : null;
    const firmwareArtifact = this.resolveFirmwareArtifact(
      target.hardware_class === "flashbox"
        ? target.item.factory_firmware_artifact
        : target.item.factory_firmware_artifact || this.firmwareArtifact,
    );
    input = {
      ...input,
      hardware_class: target.hardware_class,
      processor_board_id: processorBoard?.hardware_item_id || "",
      flashbox_id: flashbox?.hardware_item_id || "",
      hardware_profile_id: target.item.hardware_profile_id || input.hardware_profile_id,
    };
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
      firmwareArtifact,
      processorBoard,
      flashbox,
      otaTrust: this.otaTrust,
    });
    const flashPlan = this.flashPlanner.createPlan(input, manifest);
    const usbFlashPackage = createUsbFlashPackage({
      manifest,
      credential,
      flashPlan,
      generatedProvisioningHeaderPath: this.generatedProvisioningHeaderPath,
      firmwareArtifact,
    });
    if (shouldWriteFactoryHeader(input)) {
      usbFlashPackage.written_file = writeFactoryProvisioningHeader(
        usbFlashPackage,
        this.generatedProvisioningHeaderPath,
      );
    }
    const now = new Date().toISOString();
    const session = {
      session_id: createId("prov"),
      status: "prepared",
      created_at: now,
      completed_at: null,
      device: {
        device_id: deviceId,
        serial_number: normalizeRequired(input.serial_number),
        hardware_class: target.hardware_class,
        hardware_profile_id: normalizeRequired(input.hardware_profile_id),
        processor_board_id: processorBoard?.hardware_item_id || "",
        flashbox_id: flashbox?.hardware_item_id || "",
        authenticity_status: "gernetix_verified_pending_proof",
        lifecycle_state: "provisioning",
        inventory_policy: flashbox?.inventory_policy || "",
        purchase_policy: flashbox?.purchase_policy || "",
        factory_claim_mode: flashbox ? "wlan_visible_challenge" : "",
        device_key_policy: flashbox ? "device_private_key_non_exportable" : "",
        release_trust_anchor_id: flashbox ? "gernetix_flashbox_release_key.v1" : "",
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
        public_key_registration: flashbox ? "factory_public_key_required" : "device_public_key_required",
        private_key_policy: flashbox ? "generated_or_injected_non_exportable_on_device" : "generated_on_device",
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
      usb_flash_package: usbFlashPackage,
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

  resetActiveCredential(input = {}) {
    const serialNumber = normalizeRequired(input.serial_number);
    if (!serialNumber) {
      throw new ProvisioningError("missing_required_field", "Pflichtfeld fehlt: serial_number", 400);
    }
    const actor = normalizeRequired(input.actor || input.reset_by || input.provisioned_by || "factory-user");
    const deviceId = this.deviceIdFactory.createDeviceId(serialNumber);
    const credentialId = this.repository.clearActiveCredential(deviceId);
    if (!credentialId) {
      throw new ProvisioningError("active_credential_not_found", "Fuer dieses Device existiert kein aktives Credential.", 404, {
        serial_number: serialNumber,
        device_id: deviceId,
      });
    }

    const now = new Date().toISOString();
    const sessions = typeof this.repository.findSessionsByDevice === "function"
      ? this.repository.findSessionsByDevice(deviceId)
      : [];
    const updatedSessions = sessions.map((session) => {
      const next = {
        ...session,
        status: session.status === "completed" ? session.status : "credential_reset",
        credential: {
          ...session.credential,
          status: "revoked_by_factory_reset",
          revoked_at: now,
          revoked_by: actor,
        },
        device: {
          ...session.device,
          lifecycle_state: session.status === "completed" ? session.device.lifecycle_state : "reset_for_reprovisioning",
        },
        audit_events: [
          ...(session.audit_events || []),
          {
            type: "active_credential_reset",
            occurred_at: now,
            actor,
            reason: input.reason || "factory_reprovisioning",
            credential_id: credentialId,
          },
        ],
      };
      return this.repository.updateSession(session.session_id, next);
    });

    return {
      status: "active_credential_reset",
      device_id: deviceId,
      serial_number: serialNumber,
      credential_id: credentialId,
      reset_at: now,
      reset_by: actor,
      affected_sessions: updatedSessions.map((session) => session.session_id),
    };
  }

  async listProcessorBoards() {
    return { items: await this.hardwareCatalog.listProcessorBoards() };
  }

  async listFlashboxes() {
    return { items: await this.hardwareCatalog.listFlashboxes() };
  }

  async getFirmwareArtifact(boardId = "") {
    const processorBoard = boardId ? await this.hardwareCatalog.getProcessorBoard(boardId) : null;
    return summarizeFirmwareArtifact(this.resolveFirmwareArtifact(processorBoard?.factory_firmware_artifact || this.firmwareArtifact));
  }

  getFlashMode() {
    return this.usbFlashRunner.mode({ artifact_ready: this.hasMaterializableArtifact() });
  }

  getFirmwareArtifactContent(artifactId) {
    return this.firmwareArtifactStore.readArtifactContent(artifactId);
  }

  async discoverDeviceProvisioningTargets(input = {}) {
    const currentSsid = await this.wifiSsidProvider().catch(() => "");
    const candidates = deviceStatusCandidateUrls(input.candidates || input.urls || []);
    const found = [];
    await runLimited(candidates, 32, async (url) => {
      const device = await this.probeDeviceStatus(url);
      if (device) found.push(device);
    });
    const unique = [];
    const seen = new Set();
    for (const item of found) {
      const key = item.device_id || item.serial_number || item.status_url;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return {
      searched_at: new Date().toISOString(),
      strategy: "http_status_scan",
      current_wifi_ssid: currentSsid,
      setup_ap_detected: isGerNetixSetupSsid(currentSsid),
      suggested_provisioning_url: isGerNetixSetupSsid(currentSsid) ? "http://192.168.4.1/provisioning" : "",
      candidate_count: candidates.length,
      items: unique,
    };
  }

  async probeDeviceStatus(statusUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 700);
    try {
      const response = await this.fetchImpl(statusUrl, { signal: controller.signal });
      if (!response.ok) return null;
      const status = await response.json();
      return normalizeDiscoveredProvisioningDevice(statusUrl, status);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  recordBrowserUsbFlashResult(sessionId, input = {}) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    const artifact = session.manifest?.firmware?.artifact || {};
    const result = {
      status: input.status === "flashed" ? "flashed" : "failed",
      runner: "web_serial",
      transport: "web_serial",
      port: input.port || "browser_selected_serial",
      chip_name: input.chip_name || "",
      firmware_artifact: artifact,
      stdout: input.stdout || "",
      stderr: input.stderr || "",
      error: input.error || "",
      flashed_at: new Date().toISOString(),
    };
    const now = new Date().toISOString();
    session.flash_plan = {
      ...session.flash_plan,
      status: flashPlanStatus(result),
      last_flash_result: result,
    };
    session.audit_events.push({
      type: "usb_flash_executed",
      occurred_at: now,
      actor: input.actor || session.manufacturer_registration.provisioned_by,
      result_status: result.status,
      port: result.port,
      runner: result.runner,
    });
    const updated = this.repository.updateSession(sessionId, session);
    return {
      ...summarizeSession(updated),
      usb_flash_result: result,
    };
  }

  async executeUsbFlash(sessionId, input = {}) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    if (!session.flash_plan || !session.flash_plan.requested) {
      throw new ProvisioningError("usb_flash_not_requested", "Fuer diese Provisioning Session wurde kein USB-Flash angefordert.", 409);
    }
    if (!this.usbFlashRunner) {
      throw new ProvisioningError("usb_flash_runner_missing", "Kein USB-Flash-Runner konfiguriert.", 500);
    }
    if (!this.generatedProvisioningHeaderPath || !fs.existsSync(this.generatedProvisioningHeaderPath)) {
      throw new ProvisioningError(
        "factory_header_missing",
        "Factory-Provisioning-Header fehlt. Erzeuge die Session mit flash.write_factory_header=true, bevor USB-Flash ausgefuehrt wird.",
        409,
        { expected_path: this.generatedProvisioningHeaderPath || "" },
      );
    }

    const runner = input.flash_runner || input.runner || "";
    let firmwareArtifact = session.manifest.firmware.artifact;
    if (runner === "platformio" || runner === "esptool") {
      if (!this.usbFlashRunner.isRealUsbFlashAllowed()) {
        throw new ProvisioningError(
          "real_usb_flash_disabled",
          "Echter USB-Flash ist serverseitig deaktiviert. Starte das Provisioning Tool mit ALLOW_REAL_USB_FLASH=true.",
          409,
        );
      }
      firmwareArtifact = this.firmwareArtifactStore.materialize(firmwareArtifact);
    }
    const result = await this.usbFlashRunner.run({
      port: input.port || session.flash_plan.port,
      runner,
      session,
      firmwareArtifact,
      cancelToken: input.cancelToken,
      onProgress: input.onProgress,
    });
    const now = new Date().toISOString();
    const nextFlashPlan = {
      ...session.flash_plan,
      status: flashPlanStatus(result),
      last_flash_result: result,
    };
    session.flash_plan = nextFlashPlan;
    session.audit_events.push({
      type: "usb_flash_executed",
      occurred_at: now,
      actor: input.actor || session.manufacturer_registration.provisioned_by,
      result_status: result.status,
      port: input.port || session.flash_plan.port || "",
    });
    const updated = this.repository.updateSession(sessionId, session);
    return {
      ...summarizeSession(updated),
      usb_flash_result: result,
    };
  }

  startUsbFlashJob(sessionId, input = {}) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    const now = new Date().toISOString();
    const runner = input.flash_runner || input.runner || this.usbFlashRunner?.runner || "mock";
    const job = {
      job_id: createId("flash"),
      session_id: sessionId,
      status: "running",
      runner,
      port: input.port || session.flash_plan?.port || "",
      percent: runner === "mock" ? 10 : 0,
      phase: "queued",
      message: runner === "mock" ? "Mock-Flash wird ausgefuehrt." : "USB-Flash-Job wurde gestartet.",
      started_at: now,
      updated_at: now,
      completed_at: null,
      logs: [],
      result: null,
      error: null,
      cancel: null,
    };
    this.flashJobs.set(job.job_id, job);

    Promise.resolve()
      .then(() => this.executeUsbFlash(sessionId, {
        ...input,
        cancelToken: {
          setCancel: (cancel) => {
            job.cancel = cancel;
          },
          isCanceled: () => job.status === "canceled",
        },
        onProgress: (event) => updateFlashJob(job, event),
      }))
      .then((result) => {
        if (job.status === "canceled") return;
        job.status = isSuccessfulFlashResult(result.usb_flash_result) ? "completed" : "failed";
        job.percent = job.status === "completed" ? 100 : job.percent;
        job.phase = job.status === "completed" ? "completed" : "failed";
        const failure = summarizeUsbFlashFailure(result.usb_flash_result);
        job.message = job.status === "completed"
          ? "USB-Flash wurde abgeschlossen."
          : failure.message;
        job.result = result;
        job.error = job.status === "failed" ? failure.error : null;
        job.completed_at = new Date().toISOString();
        job.updated_at = job.completed_at;
        appendFlashJobLog(job, {
          type: "result",
          line: `${result.usb_flash_result?.runner || runner}: ${result.usb_flash_result?.status || job.status}`,
        });
        appendUsbFlashResultLogs(job, result.usb_flash_result);
      })
      .catch((error) => {
        if (job.status === "canceled") return;
        job.status = "failed";
        job.phase = "failed";
        job.message = error.message || "USB-Flash ist fehlgeschlagen.";
        job.error = {
          code: error.code || "usb_flash_failed",
          message: error.message || String(error),
          details: error.details || null,
        };
        job.completed_at = new Date().toISOString();
        job.updated_at = job.completed_at;
        appendFlashJobLog(job, {
          type: "error",
          line: job.message,
        });
      });

    return summarizeFlashJob(job);
  }

  cancelUsbFlashJob(jobId) {
    const job = this.flashJobs.get(jobId);
    if (!job) throw new ProvisioningError("flash_job_not_found", "USB-Flash-Job wurde nicht gefunden.", 404);
    if (["completed", "failed", "canceled"].includes(job.status)) return summarizeFlashJob(job);
    job.status = "canceled";
    job.phase = "failed";
    job.message = "USB-Flash wurde abgebrochen.";
    job.error = {
      code: "usb_flash_canceled",
      message: job.message,
      details: null,
    };
    job.completed_at = new Date().toISOString();
    job.updated_at = job.completed_at;
    if (typeof job.cancel === "function") job.cancel();
    appendFlashJobLog(job, {
      type: "error",
      line: job.message,
    });
    return summarizeFlashJob(job);
  }

  getUsbFlashJob(jobId) {
    const job = this.flashJobs.get(jobId);
    if (!job) throw new ProvisioningError("flash_job_not_found", "USB-Flash-Job wurde nicht gefunden.", 404);
    return summarizeFlashJob(job);
  }

  async completeSession(sessionId, input = {}) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    if (session.status === "completed") return summarizeSession(session);
    if (!session.credential.public_key_pem || !session.credential.certificate_pem || session.credential.proof_of_possession !== "verified") {
      throw new ProvisioningError(
        "device_identity_not_ready",
        "Device-Identitaet, Client-Zertifikat und Besitznachweis muessen vor dem Abschluss vorliegen.",
        409,
      );
    }

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

  async persistDeviceProvisioning(sessionId, input = {}) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw new ProvisioningError("session_not_found", "Provisioning Session wurde nicht gefunden.", 404);
    if (!this.certificateIssuer?.isConfigured?.()) {
      throw new ProvisioningError(
        "device_ca_not_configured",
        "Die Device-CA ist nicht konfiguriert; ein mTLS-Clientzertifikat kann nicht ausgestellt werden.",
        409,
      );
    }

    const deviceUrl = normalizeDeviceProvisioningUrl(input.device_url || input.url || "http://192.168.4.1/provisioning");
    const payload = { ...session.manifest };
    const response = await this.fetchImpl(deviceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text().catch(() => "");
    if (!response.ok) {
      throw new ProvisioningError(
        "device_provisioning_write_failed",
        "Board hat das dauerhafte Speichern der Provisioning-Kennung abgelehnt.",
        response.status,
        { device_url: deviceUrl, response: responseText },
      );
    }
    const deviceResponse = parseJson(responseText);
    const publicKeyPem = normalizeDevicePublicKey(deviceResponse.public_key_pem || deviceResponse.publicKeyPem);
    const certificate = await this.certificateIssuer.issue({
      deviceId: session.device.device_id,
      publicKeyPem,
    });
    const certificateResponse = await this.fetchImpl(deviceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...session.manifest,
        mqtt_client_certificate_pem: certificate.certificate_pem,
      }),
    });
    if (!certificateResponse.ok) {
      throw new ProvisioningError(
        "device_certificate_write_failed",
        "Board hat das Speichern des mTLS-Clientzertifikats abgelehnt.",
        certificateResponse.status,
      );
    }
    const proof = await verifyDeviceProofOfPossession({
      fetchImpl: this.fetchImpl,
      deviceUrl,
      deviceId: session.device.device_id,
      publicKeyPem,
    });

    const now = new Date().toISOString();
    session.credential = {
      ...session.credential,
      public_key_pem: publicKeyPem,
      public_key_fingerprint_sha256: publicKeyFingerprint(publicKeyPem),
      certificate_pem: certificate.certificate_pem,
      certificate_serial_number: certificate.certificate_serial_number,
      certificate_fingerprint_sha256: certificate.certificate_fingerprint_sha256,
      expires_at: certificate.expires_at,
      proof_of_possession: proof.verification_state,
    };
    session.device.local_provisioning_state = "stored_on_board";
    session.device.local_provisioning_url = deviceUrl;
    session.device.local_provisioning_stored_at = now;
    session.audit_events.push({
      type: "device_provisioning_stored_on_board",
      occurred_at: now,
      actor: input.actor || session.manufacturer_registration.provisioned_by,
      device_url: deviceUrl,
    });
    const updated = this.repository.updateSession(sessionId, session);
    return {
      ...summarizeSession(updated),
      device_provisioning: {
        status: "stored_on_board",
        device_url: deviceUrl,
        stored_at: now,
        public_key_fingerprint_sha256: session.credential.public_key_fingerprint_sha256,
        certificate_fingerprint_sha256: session.credential.certificate_fingerprint_sha256,
        proof_of_possession: proof.verification_state,
      },
    };
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
          algorithm: session.credential.algorithm,
          public_key_pem: session.credential.public_key_pem,
          public_key_fingerprint_sha256: session.credential.public_key_fingerprint_sha256,
          certificate_pem: session.credential.certificate_pem,
          certificate_fingerprint_sha256: session.credential.certificate_fingerprint_sha256,
          expires_at: session.credential.expires_at,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ProvisioningError("device_management_registration_failed", "Device Management Registrierung fehlgeschlagen.", response.status, payload);
    }
    return payload;
  }

  async resolveProcessorBoard(input = {}) {
    const boardId = input.processor_board_id || input.hardware_profile_id;
    const processorBoard = boardId && this.hardwareCatalog
      ? await this.hardwareCatalog.getProcessorBoard(boardId)
      : null;
    if (!processorBoard) {
      throw new ProvisioningError(
        "processor_board_not_found",
        "ProcessorBoard wurde im Hardware-Katalog nicht gefunden.",
        404,
        { processor_board_id: boardId || "" },
      );
    }
    if (!processorBoard.factory_firmware_artifact) {
      throw new ProvisioningError(
        "processor_board_missing_factory_firmware",
        "ProcessorBoard hat keine Factory-Firmware-Artefaktreferenz im Hardware-Katalog.",
        409,
        { processor_board_id: processorBoard.hardware_item_id },
      );
    }
    return processorBoard;
  }

  async resolveProvisioningTarget(input = {}) {
    const hardwareClass = normalizeHardwareClass(input.hardware_class || input.hardware_type || input.provisioning_target_type || input.target_type);
    if (hardwareClass === "flashbox") {
      const flashboxId = normalizeRequired(input.flashbox_id || input.hardware_item_id || input.hardware_profile_id);
      const flashbox = flashboxId
        ? await this.hardwareCatalog.getFlashbox(flashboxId)
        : null;
      if (!flashbox) {
        throw new ProvisioningError(
          "flashbox_not_found",
          "Flashbox wurde im Hardware-Katalog nicht gefunden.",
          404,
          { flashbox_id: flashboxId || "" },
        );
      }
      if (flashbox.self_creation_allowed === true) {
        throw new ProvisioningError(
          "flashbox_self_creation_not_allowed",
          "Flashboxen duerfen nicht als selbst erzeugte GerNetiX-Flashbox provisioniert werden.",
          409,
          { flashbox_id: flashbox.hardware_item_id },
        );
      }
      if (!flashbox.factory_firmware_artifact) {
        throw new ProvisioningError(
          "flashbox_missing_factory_firmware",
          "Flashbox hat keine Factory-Firmware-Artefaktreferenz im Hardware-Katalog.",
          409,
          { flashbox_id: flashbox.hardware_item_id },
        );
      }
      return { hardware_class: "flashbox", item: flashbox };
    }
    return { hardware_class: "processor_board", item: await this.resolveProcessorBoard(input) };
  }

  listFirmwareArtifacts() {
    return { items: this.firmwareArtifactStore.listArtifacts() };
  }

  upsertFirmwareArtifact(input = {}) {
    return this.firmwareArtifactStore.upsertArtifact(input);
  }

  canWriteFirmwareArtifacts() {
    return this.allowFirmwareArtifactAdminWrite;
  }

  resolveFirmwareArtifact(artifact = {}) {
    const stored = artifact?.artifact_id ? this.firmwareArtifactStore.getArtifact(artifact.artifact_id) : null;
    return stored || artifact;
  }

  hasMaterializableArtifact() {
    const artifactId = this.firmwareArtifact?.artifact_id || "";
    if (artifactId && this.firmwareArtifactStore.getArtifact(artifactId)) return true;
    return this.firmwareArtifactStore.listArtifacts().length > 0;
  }
}

function updateFlashJob(job, event = {}) {
  if (event.percent !== undefined && event.percent !== null) {
    const percent = Number(event.percent);
    if (Number.isFinite(percent)) job.percent = Math.max(job.percent || 0, Math.min(100, Math.round(percent)));
  }
  if (event.phase) job.phase = event.phase;
  if (event.message || event.line) job.message = event.message || event.line;
  job.updated_at = new Date().toISOString();
  appendFlashJobLog(job, event);
}

function appendFlashJobLog(job, event = {}) {
  job.logs.push({
    at: new Date().toISOString(),
    type: event.type || "log",
    stream: event.stream || "",
    phase: event.phase || "",
    percent: event.percent ?? null,
    line: event.line || event.message || "",
  });
  if (job.logs.length > 80) job.logs.splice(0, job.logs.length - 80);
}

function summarizeFlashJob(job) {
  return {
    job_id: job.job_id,
    session_id: job.session_id,
    status: job.status,
    runner: job.runner,
    port: job.port,
    percent: job.percent,
    phase: job.phase,
    message: job.message,
    started_at: job.started_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
    logs: job.logs.slice(-80),
    result: job.result,
    error: job.error,
  };
}

function isSuccessfulFlashResult(result = {}) {
  return result.status === "mock_flash_completed" || result.status === "flashed";
}

function summarizeUsbFlashFailure(result = {}) {
  const exitText = result.exit_code !== undefined && result.exit_code !== null
    ? `Exit-Code ${result.exit_code}`
    : "";
  const signalText = result.signal ? `Signal ${result.signal}` : "";
  const statusText = result.status ? `Status ${result.status}` : "USB-Flash fehlgeschlagen";
  const stderrLine = lastMeaningfulLine(result.stderr);
  const stdoutLine = lastMeaningfulLine(result.stdout);
  const detail = stderrLine || stdoutLine || signalText || exitText || "Kein Detail-Log vom Flash-Prozess erhalten.";
  const prefix = [result.runner || "usb", result.port ? `auf ${result.port}` : "", exitText || signalText].filter(Boolean).join(" ");
  return {
    message: `${prefix ? `${prefix}: ` : ""}${statusText}: ${detail}`,
    error: {
      code: "usb_flash_failed",
      message: detail,
      status: result.status || "failed",
      runner: result.runner || "",
      port: result.port || "",
      exit_code: result.exit_code ?? null,
      signal: result.signal ?? null,
      stderr: result.stderr || "",
      stdout: result.stdout || "",
      command: result.command || "",
      args: result.args || [],
      firmware_artifact: result.firmware_artifact || null,
    },
  };
}

function appendUsbFlashResultLogs(job, result = {}) {
  for (const line of splitTailLines(result.stdout, 20)) {
    appendFlashJobLog(job, { type: "stdout", stream: "stdout", line });
  }
  for (const line of splitTailLines(result.stderr, 20)) {
    appendFlashJobLog(job, { type: "stderr", stream: "stderr", line });
  }
}

function splitTailLines(value, limit) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-limit);
}

function lastMeaningfulLine(value) {
  const lines = splitTailLines(value, 10);
  return lines.length ? lines[lines.length - 1] : "";
}

function createUsbFlashPackage({ manifest, flashPlan, generatedProvisioningHeaderPath, firmwareArtifact }) {
  const factoryPayload = { ...manifest };
  const payloadJson = JSON.stringify(factoryPayload);
  const headerPath = "basissoftware/esp32/include/basissoftware/generated_provisioning_payload.h";
  return {
    transport: "usb",
    status: flashPlan.requested ? "ready" : "available",
    firmware_basis: manifest.firmware.basis,
    firmware_artifact: summarizeFirmwareArtifact(firmwareArtifact),
    target_runtime: "server_firmware_artifact",
    write_target: generatedProvisioningHeaderPath || headerPath,
    generated_files: [
      {
        path: headerPath,
        role: "factory_provisioning_payload",
        contains_secret: false,
        content: createProvisioningHeader(payloadJson),
      },
    ],
    instructions: [
      "Serverseitiges Firmware-Artefakt aus SQLite/Artifact Store in ein temporaeres Staging-Verzeichnis materialisieren.",
      "Generated Header nur in dieses Staging-Verzeichnis schreiben, niemals direkt in die Projektquellen.",
      "Firmware ausschliesslich per USB flashen.",
      "Beim ersten Boot importiert die Basissoftware die Daten aus dem Flash-Image in NVS.",
      "Staging-Verzeichnis und Header nach dem Flash-Vorgang entfernen.",
    ],
  };
}

function flashPlanStatus(result = {}) {
  if (result.status === "mock_flash_completed") return "usb_flash_mocked";
  if (result.status === "flashed") return "usb_flashed";
  return "usb_flash_failed";
}

function shouldWriteFactoryHeader(input) {
  return Boolean(
    input.flash && input.flash.requested && (
      input.flash.write_factory_header === true ||
      input.flash.write_usb_package === true
    ),
  );
}

function writeFactoryProvisioningHeader(usbFlashPackage, targetPath) {
  if (!targetPath) {
    throw new ProvisioningError("missing_generated_header_path", "Kein Zielpfad fuer den Factory-Provisioning-Header konfiguriert.", 500);
  }
  const generatedFile = usbFlashPackage.generated_files.find((item) => item.role === "factory_provisioning_payload");
  if (!generatedFile) {
    throw new ProvisioningError("missing_generated_header", "USB-Flash-Paket enthaelt keinen Factory-Provisioning-Header.", 500);
  }
  const resolvedPath = path.resolve(targetPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, generatedFile.content, { encoding: "utf8", flag: "w" });
  return {
    path: resolvedPath,
    role: generatedFile.role,
    contains_secret: false,
    written_at: new Date().toISOString(),
  };
}

function createProvisioningHeader(payloadJson) {
  return [
    "#pragma once",
    "",
    "// Generated by GerNetiX Provisioning Tool for one USB factory flash.",
    "// This file contains public factory metadata only; the device private key is generated on-board.",
    `constexpr char GERNETIX_FACTORY_PROVISIONING_PAYLOAD[] = "${escapeCString(payloadJson)}";`,
    "",
  ].join("\n");
}

function escapeCString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function createManifest({ input, deviceId, credential, deviceManagementBaseUrl, firmwareArtifact, processorBoard, flashbox, otaTrust }) {
  const mqttBroker = normalizeMqttBrokerEndpoint(
    input.service_endpoints && input.service_endpoints.mqtt_broker,
    input.mqtt_mode,
  );
  const hardwareClass = normalizeHardwareClass(input.hardware_class);
  return {
    schema_version: 2,
    device_id: deviceId,
    serial_number: normalizeRequired(input.serial_number),
    hardware_class: hardwareClass,
    hardware_profile_id: normalizeRequired(input.hardware_profile_id),
    processor_board: processorBoard ? {
      hardware_item_id: processorBoard.hardware_item_id,
      title: processorBoard.title || "",
      basissoftware_profile_id: processorBoard.basissoftware_profile_id || "",
    } : null,
    flashbox: flashbox ? {
      hardware_item_id: flashbox.hardware_item_id,
      title: flashbox.title || "",
      purchase_policy: flashbox.purchase_policy || "gernetix_purchase_only",
      inventory_policy: flashbox.inventory_policy || "claim_required",
      self_creation_allowed: false,
      supported_target_families: Array.isArray(flashbox.supported_target_families) ? flashbox.supported_target_families : [],
      claim_modes: ["wlan_visible_challenge", "manual_purchase_code_fallback"],
      copy_protection: {
        device_key_policy: "device_private_key_non_exportable",
        proof: "challenge_signature",
        claim_primary_path: "wlan_visible_flashbox",
        fallback_path: "manual_purchase_code",
        release_public_key_id: "gernetix_flashbox_release_key.v1",
      },
    } : null,
    firmware: {
      version: normalizeRequired(input.firmware_version),
      basis: hardwareClass === "flashbox" ? "gernetix-flashbox-firmware" : "gernetix-runtime-basissoftware",
      ota_preserved: hardwareClass !== "flashbox",
      artifact: summarizeFirmwareArtifact(firmwareArtifact),
    },
    service_endpoints: {
      device_management: input.service_endpoints && input.service_endpoints.device_management
        ? input.service_endpoints.device_management
        : deviceManagementBaseUrl,
      build_deploy: input.service_endpoints && input.service_endpoints.build_deploy
        ? input.service_endpoints.build_deploy
        : "",
      mqtt_broker: mqttBroker,
    },
    credential: {
      credential_id: credential.credential_id,
      credential_type: credential.credential_type,
      key_reference: credential.key_reference,
      algorithm: credential.algorithm,
    },
    trust: {
      ota_signing_key_id: otaTrust?.key_id || "",
      ota_signing_algorithm: otaTrust?.algorithm || "ECDSA_P256_SHA256",
      ota_signing_public_key_pem: otaTrust?.public_key_pem || "",
    },
    capabilities: Array.isArray(input.capabilities) ? input.capabilities.slice().sort() : [],
    provisioning: {
      batch_id: normalizeRequired(input.provisioning_batch_id),
      provisioned_by: normalizeRequired(input.provisioned_by),
    },
  };
}

function normalizeMqttBrokerEndpoint(value, mode) {
  const endpoint = String(value || "").trim();
  if (!endpoint) return "";
  if (mode === "local" || endpoint.startsWith("mqtt://")) {
    const match = endpoint.match(/^mqtt:\/\/([^/:]+)(?::(\d+))?$/);
    const port = Number(match && (match[2] || 1883));
    if (!match || !isPrivateIpv4(match[1]) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ProvisioningError("invalid_mqtt_broker", "Ein lokaler MQTT-Broker muss eine private IPv4-Adresse und einen gueltigen Port verwenden.", 400);
    }
    return `mqtt://${match[1]}:${port}`;
  }
  if (mode && mode !== "vps") {
    throw new ProvisioningError("invalid_mqtt_mode", "MQTT-Modus muss vps oder local sein.", 400);
  }
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "mqtts:" || !parsed.hostname || parsed.username || parsed.password || parsed.pathname !== "") throw new Error("invalid");
    if (parsed.port && (Number(parsed.port) < 1 || Number(parsed.port) > 65535)) throw new Error("invalid");
  } catch {
    throw new ProvisioningError("invalid_mqtt_broker", "Der VPS-Broker muss eine gueltige mqtts://-Adresse verwenden.", 400);
  }
  return endpoint;
}

function isPrivateIpv4(value) {
  const octets = String(value).split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

function summarizeFirmwareArtifact(artifact) {
  if (!artifact) {
    return {
      artifact_id: "",
      source: "",
      uri: "",
      version: "",
      sha256: "",
    };
  }
  return {
    artifact_id: artifact.artifact_id || "",
    source: artifact.source || "",
    uri: artifact.uri || "",
    version: artifact.version || "",
    sha256: artifact.sha256 || "",
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
    algorithm: credential.algorithm,
    public_key_fingerprint_sha256: credential.public_key_fingerprint_sha256 || "",
    certificate_fingerprint_sha256: credential.certificate_fingerprint_sha256 || "",
    expires_at: credential.expires_at || null,
    proof_of_possession: credential.proof_of_possession || "pending",
  };
}

function parseJson(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

function normalizeDevicePublicKey(value) {
  try {
    const key = crypto.createPublicKey(String(value || ""));
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error("curve");
    return key.export({ type: "spki", format: "pem" }).toString();
  } catch {
    throw new ProvisioningError("invalid_device_public_key", "Board hat keinen gueltigen ECDSA-P-256 Public Key geliefert.", 422);
  }
}

function publicKeyFingerprint(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  return crypto.createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
}

async function verifyDeviceProofOfPossession({ fetchImpl, deviceUrl, deviceId, publicKeyPem }) {
  const challengeId = createId("factory_challenge");
  const challenge = crypto.randomBytes(32).toString("base64url");
  const canonical = ["gernetix-device-auth-v1", challengeId, deviceId, challenge].join("\n");
  const challengeUrl = new URL(deviceUrl);
  challengeUrl.pathname = "/auth/challenge";
  challengeUrl.search = "";
  const response = await fetchImpl(challengeUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_id: challengeId, device_id: deviceId, challenge, canonical }),
  });
  const payload = parseJson(await response.text().catch(() => ""));
  let verified = false;
  try {
    verified = response.ok && crypto.verify(
      "sha256", Buffer.from(canonical),
      { key: publicKeyPem, dsaEncoding: "ieee-p1363" },
      Buffer.from(String(payload.signature || ""), "base64url"),
    );
  } catch {
    verified = false;
  }
  if (!verified) throw new ProvisioningError("device_key_proof_failed", "Board konnte den Besitz des privaten Device-Schluessels nicht nachweisen.", 422);
  return { verification_state: "verified", challenge_id: challengeId };
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

function normalizeHardwareClass(value) {
  const text = normalizeRequired(value).toLowerCase().replace(/-/g, "_");
  if (["flashbox", "gernetix_flashbox"].includes(text)) return "flashbox";
  return "processor_board";
}

function deviceStatusCandidateUrls(explicit = []) {
  const candidates = new Set();
  for (const item of explicit) {
    if (normalizeRequired(item)) candidates.add(statusUrl(item));
  }
  for (const host of ["gernetix-esp32", "gernetix-esp32.local", "192.168.4.1"]) {
    candidates.add(statusUrl(host));
  }
  for (const baseAddress of localIpv4NetworkBases()) {
    for (let host = 1; host <= 254; host += 1) {
      candidates.add(`http://${baseAddress}.${host}/status`);
    }
  }
  return Array.from(candidates);
}

async function currentWifiSsid() {
  if (process.platform !== "win32") return "";
  const { stdout } = await execFileAsync("cmd.exe", ["/c", "netsh wlan show interfaces"], {
    windowsHide: true,
    timeout: 5000,
    maxBuffer: 128 * 1024,
  });
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*SSID\s*:\s*(.+?)\s*$/i);
    if (match && !/^\d+\s*$/i.test(match[1])) return match[1].trim();
  }
  return "";
}

function isGerNetixSetupSsid(value) {
  return normalizeRequired(value).toLowerCase().startsWith("gernetix-");
}

function statusUrl(value) {
  const trimmed = normalizeRequired(value).replace(/\/$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withScheme.endsWith("/status") ? withScheme : `${withScheme}/status`;
}

function provisioningUrlFromStatusUrl(value) {
  const parsed = new URL(value);
  parsed.pathname = "/provisioning";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function localIpv4NetworkBases() {
  const bases = new Set();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (!/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(entry.address)) continue;
      const parts = entry.address.split(".");
      if (parts.length === 4) bases.add(parts.slice(0, 3).join("."));
    }
  }
  return Array.from(bases);
}

function normalizeDiscoveredProvisioningDevice(statusUrlValue, status = {}) {
  const deviceName = normalizeRequired(status.device || status.hostname);
  const displayName = normalizeRequired(status.displayName || status.display_name);
  const isGerNetix = deviceName.toLowerCase().startsWith("gernetix")
    || displayName.toLowerCase().startsWith("gernetix")
    || normalizeRequired(status.runtime).toLowerCase().includes("gernetix")
    || Boolean(status.deviceId || status.serialNumber || status.device_id || status.serial_number);
  if (!isGerNetix) return null;
  return {
    status_url: statusUrlValue,
    provisioning_url: provisioningUrlFromStatusUrl(statusUrlValue),
    device_id: status.deviceId || status.device_id || "",
    serial_number: status.serialNumber || status.serial_number || "",
    display_name: displayName || status.serialNumber || status.deviceId || deviceName || statusUrlValue,
    hostname: status.hostname || deviceName || "",
    provisioning_state: status.provisioningState || status.provisioning_state || "",
    runtime: status.runtime || "",
    runtime_version: status.runtimeVersion || status.runtime_version || "",
    wifi_mode: status.wifiMode || status.wifi_mode || "",
  };
}

async function runLimited(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function normalizeDeviceProvisioningUrl(value) {
  let parsed;
  try {
    parsed = new URL(normalizeRequired(value));
  } catch {
    throw new ProvisioningError("invalid_device_provisioning_url", "Device-Provisioning-URL ist ungueltig.", 400);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ProvisioningError("invalid_device_provisioning_url", "Device-Provisioning-URL muss http oder https verwenden.", 400);
  }
  if (parsed.pathname === "/" || parsed.pathname === "") {
    parsed.pathname = "/provisioning";
  }
  return parsed.toString();
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { ProvisioningService };
