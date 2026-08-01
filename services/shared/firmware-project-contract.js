"use strict";

const FIRMWARE_PROJECT_CONTRACT_VERSION = 1;
const FIRMWARE_BUILD_PACKAGE_KIND = "gernetix_firmware_build_package";
const IMPLEMENTATION_FILE = /\.(?:c|cc|cpp|cxx|m|mm|ino|cu)$/i;
const HEADER_FILE = /\.(?:h|hh|hpp|hxx|inc|inl|ipp|tpp|cuh)$/i;

function firmwareSoftwareUnitProblems(unit = {}, sourcePaths = [], options = {}) {
  if (unit.build_system !== "platformio" && unit.software_kind !== "embedded_firmware") return [];
  const problems = [];
  const sourceRoot = normalizePath(unit.source_root);
  const entrypoint = normalizePath(unit.entrypoint);
  const userSourcePath = normalizePath(unit.build_config?.user_source_path);
  if (!/^Komponenten\/[^/]+$/.test(sourceRoot)) problems.push("source_root muss genau Komponenten/<Komponente> sein");
  if (!/^src\/[^/].*/.test(entrypoint) || !IMPLEMENTATION_FILE.test(entrypoint)) problems.push("entrypoint muss eine Implementierungsdatei unter src sein");
  if (!unit.build_config || typeof unit.build_config !== "object") problems.push("build_config fehlt");
  if (entrypoint !== userSourcePath) problems.push("entrypoint und build_config.user_source_path muessen identisch sein");
  if (unit.build_config && (!unit.build_config.platform || !unit.build_config.board || !unit.build_config.environment)) {
    problems.push("build_config braucht platform, board und environment");
  }
  const paths = sourcePaths.map(normalizePath).filter(Boolean);
  if (options.requireEntrypointSource && entrypoint) {
    const expected = options.pathsAreScoped ? entrypoint : `${sourceRoot}/${entrypoint}`;
    if (!paths.includes(expected)) problems.push(`Einstiegsquelle fehlt: ${expected}`);
  }
  if (!options.allowLegacyHeaders && sourceRoot) {
    const prefix = options.pathsAreScoped ? "" : `${sourceRoot}/`;
    const misplacedHeader = paths.find((filePath) => filePath.startsWith(`${prefix}src/`) && HEADER_FILE.test(filePath));
    if (misplacedHeader) problems.push(`Header muss unter include liegen: ${misplacedHeader}`);
  }
  return problems;
}

function createFirmwareBuildPackageContract({ softwareUnit = {}, buildConfig = {}, packageFiles = [] }) {
  const basissoftware = Boolean(buildConfig.firmware_basis_id);
  return {
    kind: FIRMWARE_BUILD_PACKAGE_KIND,
    schema_version: FIRMWARE_PROJECT_CONTRACT_VERSION,
    software_unit_id: softwareUnit.software_unit_id || "",
    source_root: softwareUnit.source_root || "",
    project_entrypoint: softwareUnit.entrypoint || buildConfig.user_source_path || "",
    package_entrypoint: basissoftware
      ? buildConfig.user_target_path || "src/user/user_app.cpp"
      : buildConfig.user_source_path || softwareUnit.entrypoint || "",
    build_system: softwareUnit.build_system || "platformio",
    platform: buildConfig.platform || "",
    board: buildConfig.board || "",
    environment: buildConfig.environment || "",
    required_files: ["platformio.ini", "build-job.json"],
    package_file_count: packageFiles.length,
  };
}

function firmwareBuildPackageProblems(contract = {}, files = {}) {
  const problems = [];
  if (contract.kind !== FIRMWARE_BUILD_PACKAGE_KIND) problems.push(`kind muss ${FIRMWARE_BUILD_PACKAGE_KIND} sein`);
  if (Number(contract.schema_version) !== FIRMWARE_PROJECT_CONTRACT_VERSION) problems.push(`schema_version muss ${FIRMWARE_PROJECT_CONTRACT_VERSION} sein`);
  if (!contract.software_unit_id) problems.push("software_unit_id fehlt");
  if (contract.build_system !== "platformio") problems.push("build_system muss platformio sein");
  if (!contract.platform || !contract.board || !contract.environment) problems.push("platform, board oder environment fehlt");
  for (const requiredPath of Array.isArray(contract.required_files) ? contract.required_files : []) {
    if (!Object.hasOwn(files, requiredPath) || files[requiredPath] === undefined || files[requiredPath] === null) problems.push(`Pflichtdatei fehlt: ${requiredPath}`);
  }
  const packageEntrypoint = normalizePath(contract.package_entrypoint);
  if (!packageEntrypoint || !Object.hasOwn(files, packageEntrypoint) || files[packageEntrypoint] === undefined || files[packageEntrypoint] === null) problems.push(`Paket-Einstieg fehlt: ${packageEntrypoint || "nicht gesetzt"}`);
  if (Number(contract.package_file_count) !== Object.keys(files).length) problems.push("package_file_count stimmt nicht mit den uebergebenen Dateien ueberein");
  return problems;
}

function normalizePath(value) {
  return String(value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

module.exports = {
  FIRMWARE_BUILD_PACKAGE_KIND,
  FIRMWARE_PROJECT_CONTRACT_VERSION,
  createFirmwareBuildPackageContract,
  firmwareBuildPackageProblems,
  firmwareSoftwareUnitProblems,
};
