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
      check("command_authorization", Boolean(this.authorizationSigner?.sign), "HMAC-Signierung für OTA-Aufträge ist nicht konfiguriert."),
      check("device_confirmation", Boolean(this.acknowledgementStore?.record), "Rückmeldung und Abschlussbestätigung des Boards sind nicht angebunden."),
    ];
    return { ready: checks.every((item) => item.ok), checks, blockers: checks.filter((item) => !item.ok) };
  }

  deployStatus(deployId) { return this.acknowledgementStore?.get?.(deployId) || null; }

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
    const canonical = `${deployId}\n${sequence}\n${deploy.device_id}\n${firmwareUrl}\n${deviceFirmwareSha256}`;
    const authorization = await this.authorizationSigner.sign({ deviceId: deploy.device_id, canonical });
    const topic = `gernetix/devices/${deploy.device_id}/ota`;
    const command = {
      deploy_id: deployId,
      sequence,
      firmware_url: firmwareUrl,
      sha256: deviceFirmwareSha256,
      authorization,
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
}

function check(id, ok, message) {
  return { id, ok, message: ok ? "bereit" : message };
}

module.exports = { DeployJobOrchestrator };
