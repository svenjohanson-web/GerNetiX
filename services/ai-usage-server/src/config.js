function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5000),
    publicBaseUrl: env.AI_USAGE_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.AI_USAGE_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.AI_USAGE_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
  };
}

module.exports = { createConfig };
