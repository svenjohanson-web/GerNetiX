"use strict";

const crypto = require("node:crypto");
const { ProjectServerError } = require("../errors");
const { normalizeRepositoryPath, validateSha } = require("./git-project-repository-store");

const BOARD_SUPPORT_SCHEMA_VERSION = 1;
const DEFAULT_MANIFEST_PATH = "gernetix/board-support.json";
const ALLOWED_ROLES = new Set(["board_definition", "driver", "partition_table", "linker_script", "header"]);

function materializeBoardSupportFiles(files = [], reference = {}) {
  const manifestPath = normalizeRepositoryPath(reference.manifest_path || DEFAULT_MANIFEST_PATH);
  const byPath = new Map(files.map((file) => [normalizeRepositoryPath(file.path), file]));
  const manifestFile = byPath.get(manifestPath);
  if (!manifestFile || manifestFile.content === undefined) {
    throw boardSupportError("board_support_manifest_missing", "Das Board-Support-Manifest fehlt.", manifestPath);
  }
  const manifest = parseManifest(manifestFile.content, manifestPath);
  if (manifest.hardware_item_id !== String(reference.hardware_item_id || "")) {
    throw boardSupportError("board_support_hardware_mismatch", "Board-Support-Manifest und HardwareItem stimmen nicht überein.", manifestPath);
  }
  if (reference.release_version && manifest.release_version !== String(reference.release_version)) {
    throw boardSupportError("board_support_release_mismatch", "Die freigegebene Board-Support-Version stimmt nicht mit dem Manifest überein.", manifestPath);
  }
  const targetPaths = new Set();
  const materialized = manifest.files.map((entry) => {
    const sourcePath = normalizeRepositoryPath(entry.path);
    const targetPath = normalizeRepositoryPath(entry.target_path);
    if (targetPaths.has(targetPath)) throw boardSupportError("board_support_target_duplicate", "Ein Board-Support-Zielpfad ist doppelt belegt.", targetPath);
    targetPaths.add(targetPath);
    const source = byPath.get(sourcePath);
    if (!source) throw boardSupportError("board_support_file_missing", "Eine im Manifest genannte Board-Support-Datei fehlt.", sourcePath);
    const actualSha = sourceSha256(source);
    if (actualSha !== entry.sha256) throw boardSupportError("board_support_hash_mismatch", "Eine Board-Support-Datei stimmt nicht mit ihrer freigegebenen Prüfsumme überein.", sourcePath);
    return {
      path: targetPath,
      role: entry.role,
      content_type: source.content_type || contentType(targetPath),
      ...(source.content_base64 ? { content_base64: source.content_base64 } : { content: String(source.content ?? "") }),
      content_sha256: actualSha,
      board_support_source_path: sourcePath,
    };
  });
  return { manifest, files: materialized };
}

function parseManifest(content, manifestPath = DEFAULT_MANIFEST_PATH) {
  let value;
  try { value = JSON.parse(String(content)); } catch {
    throw boardSupportError("board_support_manifest_invalid", "Das Board-Support-Manifest ist kein gültiges JSON-Objekt.", manifestPath);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw boardSupportError("board_support_manifest_invalid", "Das Board-Support-Manifest ist kein JSON-Objekt.", manifestPath);
  }
  if (Number(value.schema_version) !== BOARD_SUPPORT_SCHEMA_VERSION || value.schema_id !== "gernetix.board-support") {
    throw boardSupportError("board_support_schema_unsupported", "Die Board-Support-Schemaversion wird nicht unterstützt.", manifestPath);
  }
  const hardwareItemId = requiredText(value.hardware_item_id, "hardware_item_id", manifestPath);
  const releaseVersion = requiredText(value.release_version, "release_version", manifestPath);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(releaseVersion)) {
    throw boardSupportError("board_support_release_invalid", "release_version muss eine semantische Version sein.", manifestPath);
  }
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > 100) {
    throw boardSupportError("board_support_files_invalid", "Das Board-Support-Manifest benötigt 1 bis 100 Dateien.", manifestPath);
  }
  const sourcePaths = new Set();
  const files = value.files.map((raw) => {
    const path = normalizeRepositoryPath(raw?.path);
    const targetPath = normalizeRepositoryPath(raw?.target_path);
    const role = String(raw?.role || "");
    const sha256 = String(raw?.sha256 || "").toLowerCase();
    if (sourcePaths.has(path)) throw boardSupportError("board_support_source_duplicate", "Eine Board-Support-Quelldatei ist doppelt aufgeführt.", path);
    sourcePaths.add(path);
    if (!ALLOWED_ROLES.has(role)) throw boardSupportError("board_support_role_invalid", "Die Board-Support-Datei besitzt keine erlaubte Rolle.", path);
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw boardSupportError("board_support_hash_invalid", "Für jede Board-Support-Datei ist eine SHA-256-Prüfsumme erforderlich.", path);
    return { path, target_path: targetPath, role, sha256 };
  });
  return { schema_id: value.schema_id, schema_version: BOARD_SUPPORT_SCHEMA_VERSION, hardware_item_id: hardwareItemId, release_version: releaseVersion, files };
}

function normalizeBoardSupportReference(reference, source) {
  if (!reference && !source) return null;
  const effective = source || reference;
  const commitSha = validateSha(effective.commit_sha, "board_support_commit_sha");
  return {
    source_id: String(effective.source_id || ""),
    provider: "forgejo",
    organization: String(effective.organization || ""),
    repository_name: String(effective.repository_name || ""),
    commit_sha: commitSha,
    manifest_path: normalizeRepositoryPath(effective.manifest_path || DEFAULT_MANIFEST_PATH),
    hardware_item_id: String(effective.hardware_item_id || reference?.hardware_item_id || ""),
    release_version: String(effective.release_version || reference?.release_version || ""),
  };
}

function sameBoardSupportReference(left, right) {
  return JSON.stringify(normalizeBoardSupportReference(left)) === JSON.stringify(normalizeBoardSupportReference(right));
}

function sourceSha256(source) {
  const bytes = source.content_base64 !== undefined
    ? Buffer.from(String(source.content_base64), "base64")
    : Buffer.from(String(source.content ?? ""), "utf8");
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function requiredText(value, field, path) {
  const text = String(value || "").trim();
  if (!text) throw boardSupportError("board_support_field_required", `${field} fehlt im Board-Support-Manifest.`, path);
  return text;
}

function contentType(path) {
  if (path.endsWith(".json")) return "application/json";
  if (/\.(?:h|hpp)$/i.test(path)) return "text/x-c++hdr";
  return "text/plain";
}

function boardSupportError(code, message, path) {
  return new ProjectServerError(code, message, 409, { path });
}

module.exports = {
  BOARD_SUPPORT_SCHEMA_VERSION,
  DEFAULT_MANIFEST_PATH,
  materializeBoardSupportFiles,
  normalizeBoardSupportReference,
  parseManifest,
  sameBoardSupportReference,
};
