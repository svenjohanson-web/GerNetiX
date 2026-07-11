const { BuildDeployError } = require("../errors");

class DeployJobOrchestrator {
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

    const firmware = buildResult.primary_firmware || buildResult.artifacts["firmware.bin"] || buildResult.artifacts["firmware.hex"];
    if (!firmware) {
      throw new BuildDeployError("missing_primary_firmware_artifact", "Deploy-Auftrag braucht ein Firmware-Artefakt.", 422);
    }

    return {
      requested: true,
      status: "queued_for_mqtt",
      topic: `gernetix/devices/${deploy.device_id}/ota`,
      firmware_url: firmware.download_url,
      firmware_sha256: firmware.sha256,
      firmware_size_bytes: firmware.size_bytes,
      log: "MVP-Deploy wurde fuer das gerätespezifische OTA-Topic validiert; MQTT-Publish und HMAC-Auftragsbildung sind noch nicht produktiv angebunden.",
    };
  }
}

module.exports = { DeployJobOrchestrator };
