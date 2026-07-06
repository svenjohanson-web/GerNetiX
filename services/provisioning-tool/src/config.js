const path = require("node:path");

function createConfig(env = process.env) {
  const runtimeRoot = env.PROVISIONING_RUNTIME_DIR
    ? path.resolve(env.PROVISIONING_RUNTIME_DIR)
    : path.join(__dirname, "..", ".runtime");

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4500),
    runtimeRoot,
    manifestDir: path.join(runtimeRoot, "manifests"),
    deviceManagementBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700/api/device-management",
    registerDeviceOnComplete: env.REGISTER_DEVICE_ON_COMPLETE !== "false",
    flashRunner: env.FLASH_RUNNER || "mock",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.PROVISIONING_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.PROVISIONING_SQLITE_PATH || path.join(runtimeRoot, "gernetix-services.sqlite"),
  };
}

module.exports = { createConfig };
