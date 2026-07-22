const { BuildDeployError } = require("../errors");

class DeployJobOrchestrator {
  constructor(options = {}) {
    this.publicBaseUrl = String(options.publicBaseUrl || "").replace(/\/$/, "");
    this.mqttPublisher = options.mqttPublisher || null;
    this.authorizationSigner = options.authorizationSigner || null;
    this.acknowledgementStore = options.acknowledgementStore || null;
  }

  preflight() {
    const checks = [
      check("public_firmware_url", /^https:\/\//.test(this.publicBaseUrl), "Öffentliche HTTPS-Adresse für Firmware-Downloads fehlt."),
      check("mqtt_publish", Boolean(this.mqttPublisher?.publish), "MQTT-Publisher ist nicht konfiguriert."),
      check("command_signature", Boolean(this.authorizationSigner?.sign) && this.authorizationSigner?.isConfigured?.() !== false, "ECDSA-Signierung für OTA-Aufträge ist nicht konfiguriert."),
      check("device_confirmation", Boolean(this.acknowledgementStore?.record), "Rückmeldung und Abschlussbestätigung des Boards sind nicht angebunden."),
    ];
    return { ready: checks.every((item) => item.ok), checks, blockers: checks.filter((item) => !item.ok) };
  }

  deployStatus(deployId) { return this.acknowledgementStore?.get?.(deployId) || null; }
  flashboxStatus(flashboxJobId) { return this.acknowledgementStore?.get?.(flashboxJobId) || null; }

  flashboxPreflight() {
    const checks = [
      check("public_firmware_url", /^https:\/\//.test(this.publicBaseUrl), "Öffentliche HTTPS-Adresse für Firmware-Downloads fehlt."),
      check("mqtt_publish", Boolean(this.mqttPublisher?.publish), "MQTT-Publisher ist nicht konfiguriert."),
      check("command_signature", Boolean(this.authorizationSigner?.sign) && this.authorizationSigner?.isConfigured?.() !== false, "ECDSA-Signierung für FlashBox-Aufträge ist nicht konfiguriert."),
    ];
    return { ready: checks.every((item) => item.ok), checks, blockers: checks.filter((item) => !item.ok) };
  }

  async maybeCreateDeploy(job, buildResult) {
    const deploy = job.deploy || {};
    if (job.mode === "build_and_usb_flash") {
      return {
        requested: false,
        status: "not_requested",
        transport: "usb",
        log: "USB-Flash wurde lokal ueber PlatformIO ausgefuehrt; kein OTA-/MQTT-Deploy angefordert.",
      };
    }
    if (!deploy.requested) {
      return { requested: false, status: "not_requested", log: "No deploy requested." };
    }

    if (job.mode === "prebuild") {
      throw new BuildDeployError("prebuild_cannot_deploy", "Ein Prebuild darf kein OTA-Deployment ausloesen.");
    }
    if (!deploy.device_id || deploy.device_id !== job.device_id) {
      throw new BuildDeployError("invalid_deploy_device", "Deploy-Auftrag braucht eine konkrete passende device_id.");
    }
    if (deploy.authorized !== true) {
      throw new BuildDeployError("deploy_not_authorized", "Deploy-Auftrag wurde nicht als berechtigt markiert.", 403);
    }

    const preflight = this.preflight();
    if (!preflight.ready) {
      throw new BuildDeployError("ota_pipeline_not_ready", "Die OTA-Wirkkette ist nicht vollständig konfiguriert.", 409, {
        blockers: preflight.blockers,
      });
    }

    const firmware = buildResult.primary_firmware || buildResult.artifacts["firmware.bin"] || buildResult.artifacts["firmware.hex"];
    if (!firmware) {
      throw new BuildDeployError("missing_primary_firmware_artifact", "Deploy-Auftrag braucht ein Firmware-Artefakt.", 422);
    }

    const deployId = `deploy_${job.job_id}`;
    const sequence = Date.now();
    const firmwareUrl = /^https:\/\//.test(firmware.download_url)
      ? firmware.download_url
      : `${this.publicBaseUrl}${firmware.download_url.startsWith("/") ? "" : "/"}${firmware.download_url}`;
    const deviceFirmwareSha256 = firmware.esp_image_sha256 || firmware.sha256;
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
    const signingKeyId = this.authorizationSigner.keyId || "test-key";
    const canonical = [
      "gernetix-ota-command-v1",
      signingKeyId,
      deployId,
      sequence,
      deploy.device_id,
      firmwareUrl,
      deviceFirmwareSha256,
      expiresAt,
    ].join("\n");
    const signature = await this.authorizationSigner.sign({ canonical });
    const topic = `gernetix/devices/${deploy.device_id}/ota`;
    const command = {
      schema_version: "gernetix-ota-command-v1",
      deploy_id: deployId,
      sequence,
      firmware_url: firmwareUrl,
      sha256: deviceFirmwareSha256,
      expires_at: expiresAt,
      signing_key_id: signingKeyId,
      signature,
    };
    await this.acknowledgementStore.record({
      deploy_id: deployId,
      device_id: deploy.device_id,
      status: "publishing",
      published_at: new Date().toISOString(),
    });
    await this.mqttPublisher.publish(topic, JSON.stringify(command), { qos: 1, retain: true });
    const currentAcknowledgement = this.acknowledgementStore.get?.(deployId);
    if (!currentAcknowledgement || currentAcknowledgement.status === "publishing") {
      await this.acknowledgementStore.record({
        deploy_id: deployId,
        device_id: deploy.device_id,
        status: "published",
        published_at: new Date().toISOString(),
      });
    }

    return {
      requested: true,
      status: "published",
      deploy_id: deployId,
      sequence,
      topic,
      firmware_url: firmwareUrl,
      firmware_sha256: deviceFirmwareSha256,
      artifact_sha256: firmware.sha256,
      firmware_size_bytes: firmware.size_bytes,
      log: "Signierter OTA-Auftrag wurde über MQTT veröffentlicht; Gerätebestätigung steht aus.",
    };
  }

  async maybeCreateFlashboxDelivery(job, buildResult) {
    const flashbox = job.flashbox || {};
    if (!flashbox.requested) return null;
    if (job.mode === "prebuild") {
      throw new BuildDeployError("prebuild_cannot_flashbox", "Ein Prebuild darf keinen FlashBox-Auftrag auslösen.");
    }
    if (!flashbox.flashbox_device_id || !flashbox.target_device_id || flashbox.target_device_id !== job.device_id) {
      throw new BuildDeployError("invalid_flashbox_target", "FlashBox-Auftrag braucht eine konkrete, zum BuildJob passende Zielgeräte-ID.");
    }
    if (flashbox.flashbox_device_id === flashbox.target_device_id) {
      throw new BuildDeployError("flashbox_cannot_be_target", "Die FlashBox darf nicht ihr eigenes Zielgerät sein.");
    }

    const preflight = this.flashboxPreflight();
    if (!preflight.ready) {
      throw new BuildDeployError("flashbox_pipeline_not_ready", "Der zertifikatsgebundene FlashBox-Kanal ist nicht vollständig konfiguriert.", 409, {
        blockers: preflight.blockers,
      });
    }

    const firmware = buildResult.primary_firmware || buildResult.artifacts["firmware.bin"] || buildResult.artifacts["firmware.hex"];
    if (!firmware) {
      throw new BuildDeployError("missing_primary_firmware_artifact", "FlashBox-Auftrag braucht ein Firmware-Artefakt.", 422);
    }

    const flashboxJobId = `flashbox_${job.job_id}`;
    const sequence = Date.now();
    const firmwareUrl = /^https:\/\//.test(firmware.download_url)
      ? firmware.download_url
      : `${this.publicBaseUrl}${firmware.download_url.startsWith("/") ? "" : "/"}${firmware.download_url}`;
    const artifactSha256 = firmware.sha256;
    const deviceFirmwareSha256 = firmware.esp_image_sha256 || artifactSha256;
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
    const signingKeyId = this.authorizationSigner.keyId || "test-key";
    const manifestType = flashbox.manifest_type || "project_firmware_flash";
    const canonical = [
      "gernetix-flashbox-command-v1",
      signingKeyId,
      flashboxJobId,
      sequence,
      flashbox.flashbox_device_id,
      flashbox.target_device_id,
      manifestType,
      firmwareUrl,
      artifactSha256,
      deviceFirmwareSha256,
      expiresAt,
    ].join("\n");
    const signature = await this.authorizationSigner.sign({ canonical });
    const topic = `gernetix/devices/${flashbox.flashbox_device_id}/flashbox/jobs`;
    const command = {
      schema_version: "gernetix-flashbox-command-v1",
      flashbox_job_id: flashboxJobId,
      sequence,
      target_device_id: flashbox.target_device_id,
      target_hardware_profile_id: flashbox.target_hardware_profile_id || "",
      manifest_type: manifestType,
      firmware_url: firmwareUrl,
      artifact_sha256: artifactSha256,
      firmware_sha256: deviceFirmwareSha256,
      expires_at: expiresAt,
      signing_key_id: signingKeyId,
      signature,
    };
    // Retained delivery lets an offline, certificate-authenticated FlashBox receive its current job.
    // The signed sequence and expiry are mandatory replay guards in the device firmware.
    await this.mqttPublisher.publish(topic, JSON.stringify(command), { qos: 1, retain: true });

    return {
      requested: true,
      status: "published_waiting_flashbox",
      transport: "flashbox_certificate_authenticated_mqtt_job",
      flashbox_job_id: flashboxJobId,
      sequence,
      flashbox_device_id: flashbox.flashbox_device_id,
      target_device_id: flashbox.target_device_id,
      topic,
      manifest_type: manifestType,
      firmware_url: firmwareUrl,
      artifact_sha256: artifactSha256,
      firmware_sha256: deviceFirmwareSha256,
      firmware_size_bytes: firmware.size_bytes,
      log: "Signierter FlashBox-Auftrag wurde auf dem ausschließlich für die inventarisierte FlashBox lesbaren MQTT-Topic veröffentlicht.",
    };
  }
}

function check(id, ok, message) {
  return { id, ok, message: ok ? "bereit" : message };
}

module.exports = { DeployJobOrchestrator };
