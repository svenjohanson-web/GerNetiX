function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4700),
    publicBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.DEVICE_MANAGEMENT_PERSISTENCE_BACKEND || "memory",
    runtimeRoot: env.DEVICE_MANAGEMENT_RUNTIME_DIR || ".runtime",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.DEVICE_MANAGEMENT_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
  };
}

module.exports = { createConfig };
