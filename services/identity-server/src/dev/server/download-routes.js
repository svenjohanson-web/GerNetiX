"use strict";

const fs = require("node:fs");
const path = require("node:path");

function registerDownloadRoutes({
  registry, requireSession, sendJson, currentFlashboxInitialFirmware, publicFlashboxFirmwareMetadata,
  servePublicFlashboxFirmware, usbSerialHelperDownloads, serveUsbSerialHelperDownload,
  provisioningFirmwareRequest, resolveProvisioningFirmwareArtifact,
}) {
  registry.register({
    method: "GET",
    path: "/api/public/flashbox/initial-firmware",
    async handler({ res }) {
      const release = await currentFlashboxInitialFirmware();
      if (!release) { sendJson(res, 404, { error: "flashbox_initial_firmware_not_published", message: "Es ist noch kein Flashbox-Initialimage freigegeben." }); return; }
      sendJson(res, 200, publicFlashboxFirmwareMetadata(release));
    },
  });
  registry.register({
    method: "GET",
    path: "/api/public/flashbox/initial-firmware/content",
    async handler({ res }) {
      const release = await currentFlashboxInitialFirmware();
      if (!release) { sendJson(res, 404, { error: "flashbox_initial_firmware_not_published", message: "Es ist noch kein Flashbox-Initialimage freigegeben." }); return; }
      await servePublicFlashboxFirmware(res, release);
    },
  });
  registry.register({
    method: "GET",
    path: "/api/platform/downloads",
    async handler({ req, res }) {
      if (await requireSession(req, res)) sendJson(res, 200, { downloads: await usbSerialHelperDownloads() });
    },
  });
  registry.register({
    method: "GET",
    pattern: /^\/downloads\/usb-serial-helper\//,
    async handler({ req, res, url }) {
      if (await requireSession(req, res)) await serveUsbSerialHelperDownload(res, path.basename(url.pathname));
    },
  });
  registry.register({
    method: "GET",
    path: "/api/platform/provisioning-firmware",
    async handler({ req, res, url }) {
      if (!await requireSession(req, res)) return;
      const request = provisioningFirmwareRequest(url.searchParams);
      const artifact = await resolveProvisioningFirmwareArtifact(request);
      if (!fs.existsSync(artifact.path)) {
        sendJson(res, 503, { error: "provisioning_firmware_unavailable", message: `Die Factory-Basissoftware fuer ${artifact.label} ist auf diesem Server noch nicht bereitgestellt.` });
        return;
      }
      sendJson(res, 200, {
        artifact_id: artifact.id, profile: request.profile, hardware_profile_id: request.hardwareProfileId,
        firmware_build_target_id: artifact.firmwareBuildTargetId, version: artifact.version,
        flash_size_mb: request.flashSizeMb, flash_mode: artifact.flashMode, flash_freq: artifact.flashFreq,
        flash_size: artifact.flashSize, flash_offset: 0,
        content_url: `/api/platform/provisioning-firmware/content?profile=${encodeURIComponent(request.profile)}&hardware_profile_id=${encodeURIComponent(request.hardwareProfileId)}&flash_size_mb=${request.flashSizeMb}`,
      });
    },
  });
  registry.register({
    method: "GET",
    path: "/api/platform/provisioning-firmware/content",
    async handler({ req, res, url }) {
      if (!await requireSession(req, res)) return;
      const request = provisioningFirmwareRequest(url.searchParams);
      const artifact = await resolveProvisioningFirmwareArtifact(request);
      if (!fs.existsSync(artifact.path)) {
        sendJson(res, 503, { error: "provisioning_firmware_unavailable", message: `Die Factory-Basissoftware fuer ${artifact.label} ist auf diesem Server noch nicht bereitgestellt.` });
        return;
      }
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename=${artifact.fileName}`, "Cache-Control": "no-store" });
      fs.createReadStream(artifact.path).pipe(res);
    },
  });
}

module.exports = { registerDownloadRoutes };
