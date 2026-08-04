"use strict";

const CUSTOMER_DOWNLOADABLE_ARTIFACTS = new Set([
  "bootloader.bin",
  "partitions.bin",
  "boot_app0.bin",
  "firmware.bin",
  "firmware.hex",
]);

const PROTECTED_BUILD_PROGRESS_MESSAGES = Object.freeze({
  queued: "Build wartet auf Ausführung.",
  waiting: "Build wartet auf freie Kapazität.",
  packaging: "Build-Paket wird vorbereitet.",
  compiling: "Firmware wird kompiliert.",
  artifacts: "Firmware-Artefakte werden gesichert.",
  deploying: "Firmware wird bereitgestellt.",
  completed: "Build erfolgreich abgeschlossen.",
  failed: "Build ist fehlgeschlagen.",
  cancelled: "Build wurde abgebrochen.",
});

function isCustomerDownloadableArtifactName(value) {
  return CUSTOMER_DOWNLOADABLE_ARTIFACTS.has(String(value || "").trim());
}

function customerArtifactList(jobId, artifacts) {
  return Object.values(artifacts || {})
    .filter((artifact) => artifact?.file_name && isCustomerDownloadableArtifactName(artifact.file_name))
    .map((artifact) => ({
      file_name: artifact.file_name,
      size_bytes: artifact.size_bytes,
      sha256: artifact.sha256,
      download_url: `/api/user-ide/build-artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifact.file_name)}`,
    }));
}

function redactProtectedSymbolFrames(frames, allowedSourcePaths) {
  const allowed = Array.from(new Set((Array.isArray(allowedSourcePaths) ? allowedSourcePaths : [])
    .map(normalizeSourcePath)
    .filter(Boolean)));
  return (Array.isArray(frames) ? frames : []).map((frame) => {
    if (!frame?.resolved || allowed.some((sourcePath) => sourceMatches(frame.file, sourcePath))) return frame;
    return {
      address: String(frame.address || ""),
      resolved: false,
      protected: true,
      function: "",
      file: "",
      line: 0,
    };
  });
}

function customerBuildProgress(progress, protectDetails) {
  if (!Array.isArray(progress)) return [];
  if (!protectDetails) return progress;
  const result = [];
  for (const item of progress) {
    const requestedPhase = String(item?.phase || "").trim().toLowerCase();
    const phase = Object.hasOwn(PROTECTED_BUILD_PROGRESS_MESSAGES, requestedPhase) ? requestedPhase : "processing";
    const previous = result.at(-1);
    if (previous?.phase === phase) {
      previous.sequence = item?.sequence;
      previous.at = item?.at;
      continue;
    }
    result.push({
      sequence: item?.sequence,
      phase,
      message: PROTECTED_BUILD_PROGRESS_MESSAGES[phase] || "Build wird verarbeitet.",
      at: item?.at,
    });
  }
  return result;
}

function sourceMatches(framePath, allowedPath) {
  const frame = normalizeSourcePath(framePath);
  const allowed = normalizeSourcePath(allowedPath);
  return Boolean(frame && allowed && (frame === allowed || frame.endsWith(`/${allowed}`)));
}

function normalizeSourcePath(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
}

module.exports = {
  CUSTOMER_DOWNLOADABLE_ARTIFACTS,
  customerArtifactList,
  customerBuildProgress,
  isCustomerDownloadableArtifactName,
  redactProtectedSymbolFrames,
  sourceMatches,
};
