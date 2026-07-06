const { BuildDeployError } = require("../errors");

class DeployJobOrchestrator {
  async maybeCreateDeploy(job, buildResult) {
    const deploy = job.deploy || {};
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

    return {
      requested: true,
      status: "queued_for_mqtt",
      topic: `devices/${deploy.device_id}/deploy`,
      firmware_url: buildResult.artifacts["firmware.bin"].download_url,
      firmware_sha256: buildResult.artifacts["firmware.bin"].sha256,
      firmware_size_bytes: buildResult.artifacts["firmware.bin"].size_bytes,
      log: "MVP-Deploy wurde validiert; MQTT-Publish ist abstrahiert und noch nicht produktiv angebunden.",
    };
  }
}

module.exports = { DeployJobOrchestrator };
