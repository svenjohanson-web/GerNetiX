const path = require("node:path");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5200),
    triageSlaHours: Number(env.COMMUNITY_TRIAGE_SLA_HOURS || 24),
    internalToken: env.COMMUNITY_INTERNAL_TOKEN || "",
    // Community data has its own database. In-memory mode remains useful for isolated tests only.
    persistenceBackend: env.PERSISTENCE_BACKEND || env.COMMUNITY_PERSISTENCE_BACKEND || "sqlite",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.COMMUNITY_SQLITE_PATH
      || path.resolve(__dirname, "..", "..", "..", ".runtime", "gernetix-community.sqlite"),
  };
}

module.exports = { createConfig };
