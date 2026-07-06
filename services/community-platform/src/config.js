function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5200),
    triageSlaHours: Number(env.COMMUNITY_TRIAGE_SLA_HOURS || 24),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.COMMUNITY_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.COMMUNITY_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
  };
}

module.exports = { createConfig };
