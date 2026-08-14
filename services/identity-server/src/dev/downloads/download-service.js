"use strict";

const fs = require("node:fs");
const path = require("node:path");

function createDownloadService({ readJsonBody, sendDevJson, projectServerJson, getUserIdeState, usbSerialHelperDistDir, usbSerialHelperManifest, getPlatformDownloadRepository, sendJson }) {
async function handleDevLessonPreviewMigration(req, res) {
  const body = await readJsonBody(req);
  const slug = String(body.slug || "").trim();
  const projectId = String(body.project_id || body.projectId || `project_${slug}`).trim();
  const manifest = body.view_manifest || body.viewManifest;

  if (!slug || !projectId || !manifest || typeof manifest !== "object") {
    sendDevJson(res, 400, {
      error: "invalid_lesson_preview_payload",
      message: "slug, project_id und view_manifest werden benoetigt.",
    });
    return;
  }

  const normalizedManifest = {
    schema_version: manifest.schema_version || 1,
    title: String(manifest.title || ""),
    summary: String(manifest.summary || ""),
    primary_source_path: String(manifest.primary_source_path || manifest.primarySourcePath || "model/lesson.json"),
    hide_source_editor: manifest.hide_source_editor !== false,
    mode: manifest.mode || "guided_ide",
    views: Array.isArray(manifest.views) ? manifest.views : [],
  };

  getUserIdeState().lessonManifestOverrides.set(slug, normalizedManifest);

  let projectServerUpdated = false;
  let projectServerError = "";
  try {
    await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      internalAuth: {
        scopes: ["project.write"],
        delegation: { project_ids: [projectId], role: "admin", capabilities: ["admin_learning_content"] },
      },
      body: {
        view_manifest: normalizedManifest,
        build_config: null,
      },
    });
    projectServerUpdated = true;
  } catch (error) {
    projectServerError = error.message || String(error);
  }

  sendDevJson(res, 200, {
    ok: true,
    slug,
    project_id: projectId,
    view_count: normalizedManifest.views.length,
    project_server_updated: projectServerUpdated,
    project_server_error: projectServerError,
    preview_url: `/app/ide/?project=${encodeURIComponent(projectId)}`,
  });
}

async function usbSerialHelperDownloads() {
  const platformDownloadRepository = getPlatformDownloadRepository();
  const files = fs.existsSync(usbSerialHelperDistDir) ? fs.readdirSync(usbSerialHelperDistDir) : [];
  const published = platformDownloadRepository
    ? await platformDownloadRepository.listCurrent("serial-service", { visibility: "authenticated" })
    : [];
  const definitions = [
    {
      platform: "macos",
      architecture: "arm64",
      label: "Für macOS",
      localFilenames: [
        `GerNetiX-Serial-Service-${usbSerialHelperManifest.version}-mac-arm64.pkg`,
        "GerNetiX-Serial-Service-mac-arm64.pkg",
      ],
      detail: "Installationspaket · Apple Silicon",
    },
    {
      platform: "windows",
      architecture: "x64",
      label: "Für Windows",
      localFilenames: ["GerNetiX-Serial-Service-win-x64.exe"],
      detail: "Hintergrunddienst · Windows 10/11 x64",
    },
  ];
  return definitions.map((definition) => {
    const localFilename = definition.localFilenames.find((file) => files.includes(file)) || "";
    const release = published.find((item) =>
      item.platform === definition.platform && item.architecture === definition.architecture);
    const filename = localFilename || release?.file_name || "";
    return {
      platform: definition.platform,
      architecture: definition.architecture,
      label: release?.label || definition.label,
      detail: release?.detail || definition.detail,
      available: Boolean(filename),
      file_name: filename,
      url: filename ? `/downloads/usb-serial-helper/${encodeURIComponent(filename)}` : "",
      source: localFilename ? "local" : release ? "published" : "",
      version: release?.version || (localFilename ? usbSerialHelperManifest.version : ""),
      sha256: release?.sha256 || "",
      size_bytes: release?.size_bytes || (localFilename ? fs.statSync(path.join(usbSerialHelperDistDir, localFilename)).size : 0),
    };
  });
}

async function currentFlashboxInitialFirmware() {
  const platformDownloadRepository = getPlatformDownloadRepository();
  const releases = platformDownloadRepository
    ? await platformDownloadRepository.listCurrent("flashbox-initial-image", { visibility: "public" })
    : [];
  return releases
    .find((release) => release.platform === "esp32" && release.architecture === "esp32-s3") || null;
}

function publicFlashboxFirmwareMetadata(release) {
  return {
    release_id: "flashbox-initial-image",
    version: release.version,
    file_name: release.file_name,
    size_bytes: release.size_bytes,
    sha256: release.sha256,
    published_at: release.published_at,
    hardware_profile: "ESP32-S3 · Flash- und PSRAM-Werte werden vor dem Flash angezeigt",
    content_url: "/api/public/flashbox/initial-firmware/content",
  };
}

async function servePublicFlashboxFirmware(res, release) {
  const platformDownloadRepository = getPlatformDownloadRepository();
  const content = await platformDownloadRepository.getContent(
    "flashbox-initial-image",
    release.version,
    "esp32",
    "esp32-s3",
    { visibility: "public" },
  );
  res.writeHead(200, {
    "Content-Type": content.content_type,
    "Content-Disposition": `attachment; filename="${content.file_name.replace(/[\"\\]/g, "")}"`,
    "Content-Length": content.size_bytes,
    "X-Content-SHA256": content.sha256,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(content.content_blob);
}

async function serveUsbSerialHelperDownload(res, filename) {
  const platformDownloadRepository = getPlatformDownloadRepository();
  const download = (await usbSerialHelperDownloads()).find((item) => item.available && decodeURIComponent(item.url).endsWith(`/${filename}`));
  if (!download) {
    sendJson(res, 404, { error: "download_not_found" });
    return;
  }
  if (download.source === "published") {
    const release = await platformDownloadRepository.getContent(
      "serial-service",
      download.version,
      download.platform,
      download.architecture,
      { visibility: "authenticated" },
    );
    res.writeHead(200, {
      "Content-Type": release.content_type,
      "Content-Disposition": `attachment; filename="${release.file_name.replace(/[\"\\]/g, "")}"`,
      "Content-Length": release.size_bytes,
      "X-Content-SHA256": release.sha256,
      "Cache-Control": "private, no-store",
    });
    res.end(release.content_blob);
    return;
  }
  const filePath = path.join(usbSerialHelperDistDir, filename);
  res.writeHead(200, {
    "Content-Type": filename.endsWith(".pkg") ? "application/vnd.apple.installer+xml" : "application/vnd.microsoft.portable-executable",
    "Content-Disposition": `attachment; filename="${filename.replace(/[\"\\]/g, "")}"`,
    "Content-Length": fs.statSync(filePath).size,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

  return {
    handleDevLessonPreviewMigration,
    usbSerialHelperDownloads,
    currentFlashboxInitialFirmware,
    publicFlashboxFirmwareMetadata,
    servePublicFlashboxFirmware,
    serveUsbSerialHelperDownload,
  };
}

module.exports = { createDownloadService };
