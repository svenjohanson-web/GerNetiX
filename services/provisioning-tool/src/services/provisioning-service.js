const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ProvisioningError } = require("../errors");

class ProvisioningService {
  constructor(options) {
    this.repository = options.repository;
    this.deviceIdFactory = options.deviceIdFactory;
    this.credentialGenerator = options.credentialGenerator;
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
  }

  async createSession(input = {}) {
    validateInput(input);
    const processorBoard = await this.resolveProcessorBoard(input);
    const firmwareArtifact = this.resolveFirmwareArtifact(processorBoard.factory_firmware_artifact || this.firmwareArtifact);
    input = {
      ...input,
      processor_board_id: processorBoard.hardware_item_id,
      hardware_profile_id: processorBoard.hardware_profile_id || input.hardware_profile_id,
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
        hardware_profile_id: normalizeRequired(input.hardware_profile_id),
        processor_board_id: processorBoard.hardware_item_id,
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

function createUsbFlashPackage({ manifest, credential, flashPlan, generatedProvisioningHeaderPath, firmwareArtifact }) {
  const factoryPayload = {
    ...manifest,
    one_time_device_secret: credential.one_time_device_secret,
  };
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
        contains_secret: true,
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
    contains_secret: true,
    written_at: new Date().toISOString(),
  };
}

function createProvisioningHeader(payloadJson) {
  return [
    "#pragma once",
    "",
    "// Generated by GerNetiX Provisioning Tool for one USB factory flash.",
    "// This file contains a one-time device secret and must not be committed.",
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

function createManifest({ input, deviceId, credential, deviceManagementBaseUrl, firmwareArtifact, processorBoard }) {
  return {
    schema_version: 1,
    device_id: deviceId,
    serial_number: normalizeRequired(input.serial_number),
    hardware_profile_id: normalizeRequired(input.hardware_profile_id),
    processor_board: {
      hardware_item_id: processorBoard.hardware_item_id,
      title: processorBoard.title || "",
      basissoftware_profile_id: processorBoard.basissoftware_profile_id || "",
    },
    firmware: {
      version: normalizeRequired(input.firmware_version),
      basis: "gernetix-runtime-basissoftware",
      ota_preserved: true,
      artifact: summarizeFirmwareArtifact(firmwareArtifact),
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
