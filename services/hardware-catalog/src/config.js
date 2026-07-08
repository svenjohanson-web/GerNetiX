function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || env.HARDWARE_CATALOG_PORT || 4910),
    publicBaseUrl: env.HARDWARE_CATALOG_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.HARDWARE_CATALOG_PERSISTENCE_BACKEND || "sqlite",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.HARDWARE_CATALOG_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
  };
}

module.exports = { createConfig };
