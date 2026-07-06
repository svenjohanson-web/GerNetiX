function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5050),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.CONTEXT_MANAGER_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.CONTEXT_MANAGER_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
    projectRoot: env.PROJECT_ROOT || env.CONTEXT_MANAGER_PROJECT_ROOT || process.cwd(),
  };
}

module.exports = { createConfig };
