const path = require("node:path");
const fs = require("node:fs");

function createConfig(env = process.env) {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const runtimeRoot = env.PROVISIONING_RUNTIME_DIR
    ? path.resolve(env.PROVISIONING_RUNTIME_DIR)
    : path.join(__dirname, "..", ".runtime");
  const firmwareRoot = env.PROVISIONING_FIRMWARE_ROOT
    ? path.resolve(env.PROVISIONING_FIRMWARE_ROOT)
    : "";
  const firmwareArtifactId = env.PROVISIONING_FIRMWARE_ARTIFACT_ID || "firmware_artifact.esp32_basissoftware_factory.latest";
  const firmwareArtifactSource = env.PROVISIONING_FIRMWARE_ARTIFACT_SOURCE || "sqlite";
  const firmwareArtifactUri = env.PROVISIONING_FIRMWARE_ARTIFACT_URI
    || `sqlite://provisioning_firmware_artifacts/${firmwareArtifactId}`;
  const serverFirmwareArtifactPath = env.PROVISIONING_FIRMWARE_FILE_PATH
    ? path.resolve(env.PROVISIONING_FIRMWARE_FILE_PATH)
    : "";
  const toolchainRoot = env.PROVISIONING_TOOLCHAIN_ROOT
    ? path.resolve(env.PROVISIONING_TOOLCHAIN_ROOT)
    : path.join(repoRoot, ".runtime", "toolchains", "provisioning");
  const toolchainManifestPath = env.PROVISIONING_TOOLCHAIN_MANIFEST
    ? path.resolve(env.PROVISIONING_TOOLCHAIN_MANIFEST)
    : path.join(toolchainRoot, "toolchain.json");
  const toolchainManifest = readToolchainManifest(toolchainManifestPath);

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4500),
    runtimeRoot,
    manifestDir: path.join(runtimeRoot, "manifests"),
    deviceManagementBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700/api/device-management",
    hardwareCatalogBaseUrl: env.HARDWARE_CATALOG_BASE_URL || env.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900/api/hardware-shop",
    registerDeviceOnComplete: env.REGISTER_DEVICE_ON_COMPLETE !== "false",
    flashRunner: env.FLASH_RUNNER || "mock",
    allowRealUsbFlash: env.ALLOW_REAL_USB_FLASH === "true",
    allowFirmwareArtifactAdminWrite: env.ALLOW_FIRMWARE_ARTIFACT_ADMIN_WRITE === "true",
    serverFirmwareArtifactPath,
    firmwareRoot,
    firmwareArtifact: {
      artifact_id: firmwareArtifactId,
      source: firmwareArtifactSource,
      uri: firmwareArtifactUri,
      version: env.PROVISIONING_FIRMWARE_ARTIFACT_VERSION || "latest",
      sha256: env.PROVISIONING_FIRMWARE_ARTIFACT_SHA256 || "",
      file_name: env.PROVISIONING_FIRMWARE_FILE_NAME || (serverFirmwareArtifactPath ? path.basename(serverFirmwareArtifactPath) : "firmware.bin"),
      local_file_path: serverFirmwareArtifactPath,
      local_staging_path: env.PROVISIONING_FIRMWARE_STAGING_PATH
        ? path.resolve(env.PROVISIONING_FIRMWARE_STAGING_PATH)
        : firmwareRoot,
    },
    toolchainRoot,
    toolchainManifestPath,
    platformioExecutable: env.PLATFORMIO_EXE
      || env.PLATFORMIO_EXECUTABLE
      || toolchainManifest.platformioExecutable
      || "",
    esptoolExecutable: env.ESPTOOL_EXE
      || env.ESPTOOL_EXECUTABLE
      || toolchainManifest.esptoolExecutable
      || "",
    esptoolPythonExecutable: env.ESPTOOL_PYTHON_EXE
      || env.PYTHON_EXE
      || toolchainManifest.esptoolPythonExecutable
      || "",
    flashTimeoutMs: Number(env.PROVISIONING_FLASH_TIMEOUT_MS || 180000),
    generatedProvisioningHeaderPath: env.PROVISIONING_GENERATED_HEADER_PATH
      ? path.resolve(env.PROVISIONING_GENERATED_HEADER_PATH)
      : path.join(runtimeRoot, "factory-payload", "generated_provisioning_payload.h"),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.PROVISIONING_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.PROVISIONING_SQLITE_PATH || path.join(runtimeRoot, "gernetix-services.sqlite"),
  };
}

function readToolchainManifest(manifestPath) {
  if (!manifestPath || !fs.existsSync(manifestPath)) return {};
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return {
    platformioExecutable: parsed.platformioExecutable || parsed.platformio_executable || "",
    esptoolExecutable: parsed.esptoolExecutable || parsed.esptool_executable || "",
    esptoolPythonExecutable: parsed.esptoolPythonExecutable || parsed.esptool_python_executable || "",
  };
}

module.exports = { createConfig };
