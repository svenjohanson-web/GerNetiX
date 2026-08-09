"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function normalizeDataLoggerConfiguration(input = {}) {
  return {
    schema_version: 1,
    enabled: input.enabled !== false,
    storage_scope: "project_private",
    configuration_state: "requires_sensor_configuration",
    user_configuration: Array.isArray(input.userConfiguration || input.user_configuration)
      ? (input.userConfiguration || input.user_configuration).map(String).slice(0, 8)
      : [],
  };
}

function createDeviceProfileService({
  provisioningFirmwareRoot,
  hardwareCatalogJson,
  getFirmwareBuildTarget,
  getFactoryFirmwareRelease,
  readJsonBody,
  projectServerUserId,
  deviceManagementJson,
  decorateUserIdeDevice,
  sendJson,
}) {
  function provisioningFirmwareRequest(searchParams) {
    const profile = String(searchParams.get("profile") || "").trim().toLowerCase();
    if (!new Set(["full", "medium", "low"]).has(profile)) {
      const error = new Error("Bitte zuerst ein Update- und Speicherprofil auswaehlen.");
      error.status = 400;
      error.code = "invalid_basissoftware_profile";
      throw error;
    }
    const hardwareProfileId = String(searchParams.get("hardware_profile_id") || "").trim();
    const flashSizeMb = Number.parseInt(String(searchParams.get("flash_size_mb") || ""), 10);
    if (!hardwareProfileId || ![4, 8, 16].includes(flashSizeMb)) {
      const error = new Error("Boardmodell und bestaetigte Flashgroesse werden fuer das Provisioning benoetigt.");
      error.status = 400;
      error.code = "provisioning_board_configuration_required";
      throw error;
    }
    return { profile, hardwareProfileId, flashSizeMb };
  }

  async function resolveProvisioningFirmwareArtifact({ profile, hardwareProfileId, flashSizeMb }) {
    let board;
    try {
      board = await hardwareCatalogJson(`/api/hardware-catalog/hardware-items/${encodeURIComponent(hardwareProfileId)}`);
    } catch (cause) {
      const error = new Error("Das ausgewaehlte Board konnte im Hardware-Katalog nicht fuer das Provisioning aufgeloest werden.");
      error.status = cause.status === 404 ? 404 : 502;
      error.code = "provisioning_hardware_catalog_unavailable";
      throw error;
    }
    const targetId = String(board.firmware_build_target_id || "");
    const target = getFirmwareBuildTarget(targetId);
    if (!target) {
      const error = new Error("Dieses Board besitzt noch kein exakt freigegebenes Firmware-Build-Target. Es wird deshalb nicht provisioniert.");
      error.status = 409;
      error.code = "provisioning_build_target_missing";
      throw error;
    }
    if (target.flash.size_mb !== flashSizeMb) {
      const error = new Error(`Das Board verlangt ${target.flash.size_mb} MB Flash; bestaetigt wurden ${flashSizeMb} MB.`);
      error.status = 409;
      error.code = "provisioning_flash_size_mismatch";
      throw error;
    }
    const release = getFactoryFirmwareRelease({ firmwareBuildTargetId: targetId, basissoftwareProfile: profile });
    if (!release) {
      const error = new Error(`Fuer ${target.title} ist das Profil ${profile.toUpperCase()} noch nicht als Factory-Release freigegeben.`);
      error.status = 409;
      error.code = "provisioning_firmware_variant_not_available";
      throw error;
    }
    const artifactPath = path.join(provisioningFirmwareRoot, release.relative_file_path);
    let sizeBytes = 0;
    let sha256 = "";
    if (fs.existsSync(artifactPath)) {
      const content = await fs.promises.readFile(artifactPath);
      sizeBytes = content.length;
      sha256 = crypto.createHash("sha256").update(content).digest("hex");
    }
    return {
      id: release.artifact_id,
      label: release.label,
      fileName: release.file_name,
      path: artifactPath,
      sizeBytes,
      sha256,
      sourcePath: release.source_path,
      sourceVersion: release.source_version,
      firmwareBuildTargetId: targetId,
      version: release.version || "",
      flashMode: release.flash_mode || "dio",
      flashFreq: release.flash_freq || "40m",
      flashSize: release.flash_size || "keep",
    };
  }

  async function handlePlatformDeviceBasissoftwareProfileUpdate(req, res, session, accountDeviceId) {
    try {
      const body = await readJsonBody(req);
      const accountId = projectServerUserId(session);
      const result = await deviceManagementJson(
        `/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}`,
        {
          method: "PUT",
          body: { basissoftware_profile: body.basissoftware_profile || body.profile || body.profile_id },
        },
      );
      sendJson(res, 200, {
        device: decorateUserIdeDevice(result.account_device),
        requires_usb_reflash: result.requires_usb_reflash,
        message: result.message,
      });
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: error.code || "basissoftware_profile_update_failed",
        message: error.message || "Basissoftware-Profil konnte nicht gespeichert werden.",
        details: error.payload || {},
      });
    }
  }

  async function handlePlatformDeviceVoiceAiPolicyUpdate(req, res, session, accountDeviceId) {
    try {
      const body = await readJsonBody(req);
      const accountId = projectServerUserId(session);
      const enabled = body.enabled === true;
      const result = await deviceManagementJson(
        `/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}/voice-ai-policy`,
        {
          method: "PUT",
          body: {
            enabled,
            consent_version: enabled ? "voice-ai-parent-v1" : "",
            age_band: body.age_band || "child_6_12",
            max_recording_seconds: 15,
            max_reply_seconds: 20,
          },
        },
      );
      sendJson(res, 200, {
        device: decorateUserIdeDevice(result.account_device),
        voice_ai_policy: result.voice_ai_policy,
        message: enabled
          ? "Voice AI ist fuer dieses Device freigegeben. Der Provider bleibt bis zur zentralen GerNetiX-Freigabe deaktiviert."
          : "Voice AI ist fuer dieses Device deaktiviert.",
      });
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: error.code || "voice_ai_policy_update_failed",
        message: error.message || "Voice-AI-Freigabe konnte nicht gespeichert werden.",
        details: error.payload || {},
      });
    }
  }

  return {
    provisioningFirmwareRequest,
    resolveProvisioningFirmwareArtifact,
    handlePlatformDeviceBasissoftwareProfileUpdate,
    handlePlatformDeviceVoiceAiPolicyUpdate,
  };
}

module.exports = { createDeviceProfileService, normalizeDataLoggerConfiguration };
