"use strict";

const { ProjectServerError } = require("../errors");
const { normalizeChanges, normalizeRepositoryPath } = require("./git-project-repository-store");

const PROJECT_FILE_SCHEMA_VERSION = 1;
const PROJECT_MANIFEST_PATH = "gernetix/project.json";
const PROJECT_FILE_SCHEMA = Object.freeze({
  schema_id: "gernetix.project-file-set",
  schema_version: PROJECT_FILE_SCHEMA_VERSION,
  manifest: { path: PROJECT_MANIFEST_PATH, schema_id: "gernetix.project", required: ["schema_version", "schema_id", "project_id", "title"] },
  software_unit: { path_pattern: "gernetix/software-units/<software-unit-id>.json", required: ["schema_version", "software_unit_id", "title", "software_kind", "build_system", "source_root"] },
  architecture: { path: "gernetix/architecture/project.puml", encoding: "utf-8" },
  hardware_allocation: { path: "gernetix/hardware/allocation.json", required: ["schema_version", "components"] },
  board_snapshot: { path_pattern: "gernetix/hardware/boards/<component-id>.json", required: ["schema_version"] },
});

function loadProjectFileSet(files = []) {
  const normalized = normalizeProjectFiles(files);
  const byPath = new Map(normalized.map((file) => [file.path, file]));
  const manifest = parseVersionedJson(byPath, PROJECT_MANIFEST_PATH, true);
  if (manifest.schema_id !== PROJECT_FILE_SCHEMA.manifest.schema_id) throw schemaError("project_schema_id_invalid", "gernetix/project.json besitzt keine bekannte schema_id.", PROJECT_MANIFEST_PATH);
  requiredText(manifest.project_id, "project_id", PROJECT_MANIFEST_PATH);
  if (typeof manifest.title !== "string") throw schemaError("project_schema_field_invalid", "title muss Text sein.", PROJECT_MANIFEST_PATH);
  const softwareUnits = normalized
    .filter((file) => /^gernetix\/software-units\/[^/]+\.json$/.test(file.path))
    .map((file) => parseVersionedJson(byPath, file.path, true));
  for (const file of normalized.filter((candidate) => candidate.path.startsWith("gernetix/") && candidate.path.endsWith(".json"))) {
    parseVersionedJson(byPath, file.path, true);
  }
  const hardwareAllocation = byPath.has("gernetix/hardware/allocation.json")
    ? parseVersionedJson(byPath, "gernetix/hardware/allocation.json", true)
    : null;
  if (hardwareAllocation && !Array.isArray(hardwareAllocation.components)) {
    throw schemaError("project_schema_field_invalid", "components muss eine Liste sein.", "gernetix/hardware/allocation.json");
  }
  const ids = new Set();
  for (const unit of softwareUnits) {
    const id = requiredText(unit.software_unit_id, "software_unit_id", unit.__path);
    for (const field of ["title", "software_kind", "build_system", "source_root"]) {
      if (typeof unit[field] !== "string") throw schemaError("project_schema_field_invalid", `${field} muss Text sein.`, unit.__path);
    }
    if (ids.has(id)) throw schemaError("project_schema_duplicate_software_unit", `Software-Einheit ${id} ist doppelt definiert.`, unit.__path);
    ids.add(id);
  }
  if (manifest.active_software_unit_id && !ids.has(String(manifest.active_software_unit_id))) {
    throw schemaError("project_schema_reference_invalid", "active_software_unit_id verweist auf keine Projektdatei.", PROJECT_MANIFEST_PATH);
  }
  return {
    schema_version: PROJECT_FILE_SCHEMA_VERSION,
    manifest: withoutInternalFields(manifest),
    software_units: softwareUnits.map(withoutInternalFields),
    files: normalized.map((file) => ({ ...file })),
  };
}

function writeProjectFileSet(document = {}) {
  if (Number(document.schema_version) !== PROJECT_FILE_SCHEMA_VERSION) throw unknownSchema(document.schema_version, "project_file_set");
  return normalizeProjectFiles(document.files || []);
}

function validateProjectChanges(changes = []) {
  const normalized = normalizeChanges(changes, { allowEmpty: false });
  for (const change of normalized) {
    if (change.operation !== "upsert" || !change.path.startsWith("gernetix/") || !change.path.endsWith(".json")) continue;
    const value = parseJson(change.content, change.path);
    assertSchemaVersion(value, change.path);
  }
  return normalized;
}

function normalizeProjectFiles(files) {
  if (!Array.isArray(files) || !files.length) throw schemaError("project_schema_files_required", "Das Projektdateischema benötigt mindestens eine Datei.");
  const paths = new Set();
  return files.map((raw) => {
    const path = normalizeRepositoryPath(raw?.path);
    if (paths.has(path)) throw schemaError("duplicate_repository_path", "Ein Projektpfad darf nur einmal vorkommen.", path);
    paths.add(path);
    const content = String(raw?.content ?? "");
    if (Buffer.byteLength(content) > 1024 * 1024) throw schemaError("repository_file_too_large", "Eine Projektdatei darf höchstens 1 MiB groß sein.", path, 413);
    if (content.includes("\0")) throw schemaError("repository_binary_forbidden", "Binärdateien sind im Projektquellen-Repository nicht zulässig.", path, 415);
    return { path, content, content_type: raw?.content_type || mimeTypeForPath(path), role: raw?.role || "project_file" };
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function parseVersionedJson(byPath, path, required) {
  const file = byPath.get(path);
  if (!file) {
    if (!required) return null;
    throw schemaError("project_schema_manifest_missing", `Projektdatei ${path} fehlt.`, path);
  }
  const value = parseJson(file.content, path);
  assertSchemaVersion(value, path);
  return { ...value, __path: path };
}

function parseJson(content, path) {
  try {
    const value = JSON.parse(content);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object_required");
    return value;
  } catch {
    throw schemaError("project_schema_json_invalid", `Projektdatei ${path} enthält kein gültiges JSON-Objekt.`, path);
  }
}

function assertSchemaVersion(value, path) {
  if (!supportedSchemaVersions(path).includes(Number(value.schema_version))) throw unknownSchema(value.schema_version, path);
}

function unknownSchema(version, path) {
  return schemaError("project_schema_version_unsupported", `schema_version ${String(version ?? "fehlt")} wird nicht unterstützt.`, path, 409, {
    supported_schema_versions: supportedSchemaVersions(path),
  });
}

function supportedSchemaVersions(path) {
  if ([
    "gernetix/configuration/communication.json",
    "gernetix/configuration/game.json",
    "gernetix/configuration/home-automation.json",
  ].includes(path)) return [1, 2];
  return [PROJECT_FILE_SCHEMA_VERSION];
}

function requiredText(value, field, path) {
  const text = String(value || "").trim();
  if (!text) throw schemaError("project_schema_field_required", `${field} fehlt.`, path);
  return text;
}

function withoutInternalFields(value) {
  const { __path, ...result } = value;
  return result;
}

function mimeTypeForPath(path) {
  if (path.endsWith(".json")) return "application/json";
  if (/\.(?:h|hh|hpp|hxx)$/i.test(path)) return "text/x-c++hdr";
  if (/\.(?:c|cc|cpp|cxx|ino)$/i.test(path)) return "text/x-c++src";
  if (/\.(?:puml|plantuml|md|txt|ini|yaml|yml|toml)$/i.test(path)) return "text/plain";
  return "text/plain";
}

function schemaError(code, message, path = "", status = 400, details = {}) {
  return new ProjectServerError(code, message, status, { ...(path ? { path } : {}), ...details });
}

module.exports = {
  PROJECT_FILE_SCHEMA,
  PROJECT_FILE_SCHEMA_VERSION,
  PROJECT_MANIFEST_PATH,
  loadProjectFileSet,
  mimeTypeForPath,
  validateProjectChanges,
  writeProjectFileSet,
};
