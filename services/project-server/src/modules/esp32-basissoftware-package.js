const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BASIS_ROOT = path.resolve(__dirname, "../../../..", "basissoftware", "esp32");
const INCLUDED_ROOT_FILES = new Set(["CMakeLists.txt", "dependencies.lock", "platformio.ini", "sdkconfig.esp32dev", "partitions_ota_4mb.csv"]);

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
  const userSourcePath = buildConfig.user_source_path || "Komponenten/ESP32/src/user_main.cpp";
  const userTargetPath = buildConfig.user_target_path || "src/user/user_app.cpp";
  const userSource = projectSources.find((source) => source.path === userSourcePath);
  if (!userSource) {
    throw new Error(`Projektquelle fuer User-Main fehlt: ${userSourcePath}`);
  }
  const byPath = new Map(basisFiles.map((file) => [file.path, { ...file }]));
  byPath.set(userTargetPath, {
    path: userTargetPath,
    content: userSource.content,
    content_type: userSource.content_type || "text/x-c++src",
    source_project_path: userSourcePath,
  });
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
  return INCLUDED_ROOT_FILES.has(relative) || relative.startsWith("src/") || relative.startsWith("include/");
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
