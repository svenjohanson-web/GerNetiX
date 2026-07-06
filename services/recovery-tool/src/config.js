function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5100),
    deviceManagementBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700/api/device-management",
    registerRecoveredDevices: env.REGISTER_RECOVERED_DEVICES !== "false",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.RECOVERY_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.RECOVERY_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
  };
}

module.exports = { createConfig };
