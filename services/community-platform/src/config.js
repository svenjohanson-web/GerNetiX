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
    postgres: {
      connectionString: env.COMMUNITY_POSTGRES_URL || "",
      host: env.COMMUNITY_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.COMMUNITY_POSTGRES_PORT || 5432),
      database: env.COMMUNITY_POSTGRES_DATABASE || "gernetix_community",
      user: env.COMMUNITY_POSTGRES_USER || "gernetix_community",
      password: env.COMMUNITY_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
