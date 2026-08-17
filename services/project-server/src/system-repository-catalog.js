"use strict";

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SYSTEM_REPOSITORY_DEFINITIONS = Object.freeze([
  Object.freeze({ source_id: "gernetix-runtime-basissoftware", title: "Basissoftware ESP32", kind: "basissoftware", organization: "gernetix-platform", repository_name: "basissoftware-esp32", commit_environment: "FORGEJO_ESP32_BASIS_COMMIT" }),
  Object.freeze({ source_id: "gernetix-runtime-basissoftware-esp8266", title: "Basissoftware ESP8266", kind: "basissoftware", organization: "gernetix-platform", repository_name: "basissoftware-esp8266", commit_environment: "FORGEJO_ESP8266_BASIS_COMMIT" }),
  Object.freeze({ source_id: "gernetix-product-nexi", title: "Nexi", kind: "product", organization: "gernetix-products", repository_name: "nexi", commit_environment: "FORGEJO_NEXI_COMMIT", local_directory: "nexi" }),
  Object.freeze({ source_id: "gernetix-product-flashbox", title: "FlashBox", kind: "product", organization: "gernetix-products", repository_name: "flashbox", commit_environment: "FORGEJO_FLASHBOX_COMMIT", local_directory: "flashbox" }),
  Object.freeze({ source_id: "gernetix-product-game-collection-esp8266", title: "Spielesammlung ESP8266 OLED", kind: "product", organization: "gernetix-products", repository_name: "spielesammlung-esp8266-oled", commit_environment: "FORGEJO_ESP8266_GAME_COLLECTION_COMMIT", local_directory: "spielesammlung-esp8266-oled" }),
  Object.freeze({ source_id: "gernetix-product-game-collection-esp32", title: "Spielesammlung ESP32-S3 Touch", kind: "product", organization: "gernetix-products", repository_name: "spielesammlung-esp32-s3-touch", commit_environment: "FORGEJO_ESP32_GAME_COLLECTION_COMMIT", local_directory: "spielesammlung-esp32-s3-touch" }),
  Object.freeze({ source_id: "gernetix-product-camera-touch-display", title: "ESP32-Kamera auf Touchdisplay", kind: "product", organization: "gernetix-products", repository_name: "kamera-touchdisplay", commit_environment: "FORGEJO_CAMERA_TOUCH_DISPLAY_COMMIT", local_directory: "kamera-touchdisplay" }),
  Object.freeze({ source_id: "gernetix-product-radar-room-presence", title: "Radar-Raumpräsenz", kind: "product", organization: "gernetix-products", repository_name: "radar-raumpraesenz", commit_environment: "FORGEJO_RADAR_ROOM_PRESENCE_COMMIT", local_directory: "radar-raumpraesenz" }),
  Object.freeze({
    source_id: "gernetix-board-support-esp32-s3-es3c28p",
    title: "Board-Support ESP32-S3 ES3C28P",
    kind: "board_support",
    organization: "gernetix-platform",
    repository_name: "board-support-esp32-s3-es3c28p",
    commit_environment: "FORGEJO_ESP32_S3_ES3C28P_BOARD_SUPPORT_COMMIT",
    local_directory: "board-support-esp32-s3-es3c28p",
    manifest_path: "gernetix/board-support.json",
    hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    release_version: "1.0.0",
  }),
]);

function createSystemRepositoryCatalog(env = process.env) {
  const defaults = [
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[0], env),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[1], env),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[2], env, {
      target_root: "Komponenten/IoT-Device 1",
      path_mappings: { "voice_lab.cpp": "src/user_main.cpp" },
      excluded_paths: ["gernetix/system-repository.json"],
    }),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[3], env),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[4], env, {
      target_root: "Komponenten/IoT-Device 1",
      excluded_paths: ["gernetix/system-repository.json", "platformio.ini"],
    }),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[5], env, {
      target_root: "Komponenten/IoT-Device 1",
      path_mappings: { "src/main.cpp": "src/user_main.cpp" },
      entrypoint_adapters: { "src/main.cpp": "touchscreen_game_basis" },
      excluded_paths: ["gernetix/system-repository.json", "platformio.ini"],
    }),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[6], env, {
      target_root: "",
      excluded_paths: ["gernetix/system-repository.json"],
    }),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[7], env, {
      target_root: "Komponenten/IoT-Device 1",
      excluded_paths: ["gernetix/system-repository.json"],
    }),
    systemRepositoryDefinition(SYSTEM_REPOSITORY_DEFINITIONS[8], env),
  ];
  const configured = parseConfiguredRepositories(env.PROJECT_SYSTEM_REPOSITORIES_JSON);
  const byId = new Map(defaults.map((item) => [item.source_id, item]));
  for (const item of configured) byId.set(item.source_id, item);
  return [...byId.values()];
}

function systemRepositoryDefinition(definition, env, materialization = null) {
  return {
    ...systemRepository(
      definition.source_id,
      definition.title,
      definition.kind,
      definition.organization,
      definition.repository_name,
      env[definition.commit_environment],
      materialization,
    ),
    ...(definition.manifest_path ? { manifest_path: definition.manifest_path } : {}),
    ...(definition.hardware_item_id ? { hardware_item_id: definition.hardware_item_id } : {}),
    ...(definition.release_version ? { release_version: definition.release_version } : {}),
  };
}

function parseConfiguredRepositories(value) {
  if (!String(value || "").trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("project_system_repositories_json_invalid");
  }
  if (!Array.isArray(parsed)) throw new Error("project_system_repositories_json_invalid");
  return parsed.map((item) => normalizeSystemRepository(item));
}

function systemRepository(sourceId, title, kind, organization, repositoryName, commitSha, materialization = null) {
  return normalizeSystemRepository({
    source_id: sourceId,
    title,
    kind,
    organization,
    repository_name: repositoryName,
    default_branch: "main",
    commit_sha: commitSha || "",
    protected: true,
    ...(materialization ? { materialization } : {}),
  });
}

function normalizeSystemRepository(input = {}) {
  const sourceId = identifier(input.source_id, "source_id");
  const organization = identifier(input.organization, "organization");
  const repositoryName = identifier(input.repository_name, "repository_name");
  const commitSha = String(input.commit_sha || "").trim().toLowerCase();
  if (commitSha && !SHA_PATTERN.test(commitSha)) throw new Error(`project_system_repository_commit_invalid:${sourceId}`);
  const kind = String(input.kind || "product").trim().toLowerCase();
  if (!["basissoftware", "product", "board_support"].includes(kind)) throw new Error(`project_system_repository_kind_invalid:${sourceId}`);
  return {
    source_id: sourceId,
    title: String(input.title || sourceId).trim().slice(0, 120),
    kind,
    provider: "forgejo",
    organization,
    repository_name: repositoryName,
    default_branch: String(input.default_branch || "main").trim(),
    commit_sha: commitSha,
    protected: true,
    ...(kind === "product" && input.materialization ? { materialization: normalizeMaterialization(input.materialization, sourceId) } : {}),
    ...(kind === "board_support" ? {
      manifest_path: safeRelativePath(input.manifest_path || "gernetix/board-support.json", "manifest_path", sourceId),
      hardware_item_id: String(input.hardware_item_id || "").trim(),
      release_version: String(input.release_version || "").trim(),
    } : {}),
  };
}

function normalizeMaterialization(input, sourceId) {
  if (!input || typeof input !== "object") throw new Error(`project_system_repository_materialization_invalid:${sourceId}`);
  const targetRoot = String(input.target_root || "").trim()
    ? safeRelativePath(input.target_root, "target_root", sourceId)
    : "";
  const mappings = {};
  for (const [sourcePath, targetPath] of Object.entries(input.path_mappings || {})) {
    mappings[safeRelativePath(sourcePath, "mapping_source", sourceId)] = safeRelativePath(targetPath, "mapping_target", sourceId);
  }
  return {
    target_root: targetRoot,
    path_mappings: mappings,
    entrypoint_adapters: Object.fromEntries(Object.entries(input.entrypoint_adapters || {}).map(([sourcePath, adapter]) => {
      const normalizedSourcePath = safeRelativePath(sourcePath, "entrypoint_source", sourceId);
      const adapterId = String(adapter || "").trim();
      if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(adapterId)) {
        throw new Error(`project_system_repository_entrypoint_adapter_invalid:${sourceId}`);
      }
      return [normalizedSourcePath, adapterId];
    })),
    excluded_paths: Array.from(new Set((input.excluded_paths || []).map((value) => safeRelativePath(value, "excluded_path", sourceId)))),
  };
}

function safeRelativePath(value, field, sourceId) {
  const normalized = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`project_system_repository_${field}_invalid:${sourceId}`);
  }
  return normalized;
}

function identifier(value, field) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(normalized)) throw new Error(`project_system_repository_${field}_invalid`);
  return normalized;
}

module.exports = { SYSTEM_REPOSITORY_DEFINITIONS, createSystemRepositoryCatalog, normalizeSystemRepository };
