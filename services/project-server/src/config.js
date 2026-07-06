function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4800),
    publicBaseUrl: env.PROJECT_SERVER_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.PROJECT_SERVER_PERSISTENCE_BACKEND || "memory",
    runtimeRoot: env.PROJECT_SERVER_RUNTIME_DIR || ".runtime",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.PROJECT_SERVER_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
  };
}

module.exports = { createConfig };
