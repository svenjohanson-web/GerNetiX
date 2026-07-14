const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BASIS_ROOT = path.resolve(__dirname, "../../../..", "basissoftware", "esp32");
const INCLUDED_ROOT_FILES = new Set(["CMakeLists.txt", "dependencies.lock", "platformio.ini", "sdkconfig.esp32dev", "partitions_ota_4mb.csv"]);
const PROFILE_PARTITION_FILE = /^partitions_(full|medium|low)_(4|8|16)mb\.csv$/;

function loadEsp32BasissoftwareFiles(root = process.env.GERNETIX_ESP32_BASISSOFTWARE_ROOT || DEFAULT_BASIS_ROOT) {
  if (!fs.existsSync(root)) {
    throw new Error(`ESP32-Basissoftware wurde nicht gefunden: ${root}`);
  }
  return walk(root)
    .filter((filePath) => includeFile(root, filePath))
    .map((filePath) => ({
      path: relativePath(root, filePath),
      content: fs.readFileSync(filePath, "utf8"),
      content_type: contentType(filePath),
    }));
}

function composeEsp32BasissoftwarePackage({ basisFiles, projectSources, buildConfig }) {
  const userSourcePath = buildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp";
  const userTargetPath = buildConfig.user_target_path || "src/user/user_app.cpp";
  const userSource = projectSources.find((source) => source.path === userSourcePath);
  if (!userSource) {
    throw new Error(`Projektquelle fuer User-Main fehlt: ${userSourcePath}`);
  }
  const byPath = new Map(basisFiles.map((file) => [file.path, { ...file }]));
  applyBasissoftwareProfile(byPath, buildConfig);
  byPath.set(userTargetPath, {
    path: userTargetPath,
    content: userSource.content,
    content_type: userSource.content_type || "text/x-c++src",
    source_project_path: userSourcePath,
  });
  const componentSourceRoot = userSourcePath.replace(/\/user_main\.cpp$/, "/");
  for (const projectSource of projectSources) {
    if (projectSource.path === userSourcePath || !projectSource.path.startsWith(componentSourceRoot)) continue;
    const relative = projectSource.path.slice(componentSourceRoot.length);
    if (!/\.(h|hpp)$/i.test(relative) || relative.includes("..")) continue;
    byPath.set(`include/user_project/${relative}`, {
      path: `include/user_project/${relative}`,
      content: projectSource.content,
      content_type: projectSource.content_type || "text/x-c++hdr",
      source_project_path: projectSource.path,
    });
  }
  return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function includeFile(root, filePath) {
  const relative = relativePath(root, filePath);
  if (relative.startsWith(".pio/") || relative.startsWith(".vscode/") || relative.startsWith("build/")) return false;
  if (relative.startsWith("managed_components/espressif__mqtt/")) {
    return !relative.includes("/examples/")
      && !relative.includes("/test/")
      && !relative.includes("/docs/")
      && !relative.includes("/.git")
      && !/\.(html|xml|toml|yml)$/i.test(relative.replace(/idf_component\.yml$/i, ""));
  }
  return INCLUDED_ROOT_FILES.has(relative) || PROFILE_PARTITION_FILE.test(relative) || relative.startsWith("src/") || relative.startsWith("include/");
}

function applyBasissoftwareProfile(byPath, buildConfig = {}) {
  if (!byPath.has("platformio.ini")) return;
  if (!/^board_build\.partitions\s*=/m.test(byPath.get("platformio.ini").content)) return;
  const profile = normalizeProfile(buildConfig.firmware_basis_variant || buildConfig.basissoftware_profile?.class);
  const flashSizeMb = normalizeFlashSize(buildConfig.flash_size_mb);
  const requestedPartitionFile = `partitions_${profile}_${flashSizeMb}mb.csv`;
  const partitionFile = byPath.has(requestedPartitionFile)
    ? requestedPartitionFile
    : profile === "full" && flashSizeMb === 4 && byPath.has("partitions_ota_4mb.csv")
      ? "partitions_ota_4mb.csv"
      : requestedPartitionFile;
  if (!byPath.has(partitionFile)) {
    throw new Error(`Partitionslayout fuer ${profile.toUpperCase()} mit ${flashSizeMb} MB fehlt: ${partitionFile}`);
  }

  const platformioFile = byPath.get("platformio.ini");
  if (platformioFile) {
    platformioFile.content = platformioFile.content
      .replace(/^board_build\.flash_size\s*=.*$/m, `board_build.flash_size = ${flashSizeMb}MB`)
      .replace(/^board_build\.partitions\s*=.*$/m, `board_build.partitions = ${partitionFile}`)
      .replace(/^build_flags\s*=.*$/m, `build_flags = -D GERNETIX_BASISSOFTWARE_PROFILE_${profile.toUpperCase()}=1`);
  }

  const sdkconfigFile = byPath.get("sdkconfig.esp32dev");
  if (sdkconfigFile) {
    sdkconfigFile.content = [4, 8, 16].reduce((source, size) => source
      .replace(new RegExp(`^(?:# )?CONFIG_ESPTOOLPY_FLASHSIZE_${size}MB(?:=y| is not set)$`, "m"),
        size === flashSizeMb ? `CONFIG_ESPTOOLPY_FLASHSIZE_${size}MB=y` : `# CONFIG_ESPTOOLPY_FLASHSIZE_${size}MB is not set`), sdkconfigFile.content)
      .replace(/^CONFIG_ESPTOOLPY_FLASHSIZE="[^"]+"$/m, `CONFIG_ESPTOOLPY_FLASHSIZE="${flashSizeMb}MB"`)
      .replace(/^CONFIG_PARTITION_TABLE_FILENAME="[^"]+"$/m, `CONFIG_PARTITION_TABLE_FILENAME="${partitionFile}"`)
      .replace(/^CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="[^"]+"$/m, `CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="${partitionFile}"`);
  }
}

function normalizeProfile(value) {
  const normalized = String(value || "full").trim().toLowerCase();
  if (normalized === "comfort") return "full";
  if (["full", "medium", "low"].includes(normalized)) return normalized;
  throw new Error(`Unbekanntes Basissoftwareprofil: ${value}`);
}

function normalizeFlashSize(value) {
  const parsed = Number.parseInt(value, 10);
  return [4, 8, 16].includes(parsed) ? parsed : 4;
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function contentType(filePath) {
  if (/\.(cpp|cc|c)$/i.test(filePath)) return "text/x-c++src";
  if (/\.(h|hpp)$/i.test(filePath)) return "text/x-c++hdr";
  return "text/plain";
}

module.exports = { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles };
