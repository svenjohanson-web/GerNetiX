"use strict";

const SHA_PATTERN = /^[a-f0-9]{40}$/;

function createSystemRepositoryCatalog(env = process.env) {
  const defaults = [
    systemRepository("gernetix-runtime-basissoftware", "Basissoftware ESP32", "basissoftware", "gernetix-platform", "basissoftware-esp32", env.FORGEJO_ESP32_BASIS_COMMIT),
    systemRepository("gernetix-runtime-basissoftware-esp8266", "Basissoftware ESP8266", "basissoftware", "gernetix-platform", "basissoftware-esp8266", env.FORGEJO_ESP8266_BASIS_COMMIT),
    systemRepository("gernetix-product-nexi", "Nexi", "product", "gernetix-products", "nexi", env.FORGEJO_NEXI_COMMIT, {
      target_root: "Komponenten/IoT-Device 1",
      path_mappings: { "voice_lab.cpp": "src/user_main.cpp" },
      excluded_paths: ["gernetix/system-repository.json"],
    }),
    systemRepository("gernetix-product-flashbox", "FlashBox", "product", "gernetix-products", "flashbox", env.FORGEJO_FLASHBOX_COMMIT),
    systemRepository("gernetix-product-game-collection-esp8266", "Spielesammlung ESP8266 OLED", "product", "gernetix-products", "spielesammlung-esp8266-oled", env.FORGEJO_ESP8266_GAME_COLLECTION_COMMIT),
    systemRepository("gernetix-product-game-collection-esp32", "Spielesammlung ESP32-S3 Touch", "product", "gernetix-products", "spielesammlung-esp32-s3-touch", env.FORGEJO_ESP32_GAME_COLLECTION_COMMIT),
  ];
  const configured = parseConfiguredRepositories(env.PROJECT_SYSTEM_REPOSITORIES_JSON);
  const byId = new Map(defaults.map((item) => [item.source_id, item]));
  for (const item of configured) byId.set(item.source_id, item);
  return [...byId.values()];
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
  if (!['basissoftware', 'product'].includes(kind)) throw new Error(`project_system_repository_kind_invalid:${sourceId}`);
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
  };
}

function normalizeMaterialization(input, sourceId) {
  if (!input || typeof input !== "object") throw new Error(`project_system_repository_materialization_invalid:${sourceId}`);
  const targetRoot = safeRelativePath(input.target_root, "target_root", sourceId);
  const mappings = {};
  for (const [sourcePath, targetPath] of Object.entries(input.path_mappings || {})) {
    mappings[safeRelativePath(sourcePath, "mapping_source", sourceId)] = safeRelativePath(targetPath, "mapping_target", sourceId);
  }
  return {
    target_root: targetRoot,
    path_mappings: mappings,
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

module.exports = { createSystemRepositoryCatalog, normalizeSystemRepository };
