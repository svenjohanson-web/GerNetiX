const path = require("node:path");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5200),
    triageSlaHours: Number(env.COMMUNITY_TRIAGE_SLA_HOURS || 24),
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "community-platform"),
    // A separate secret is required for the Admin Tool. It must not be shared
    // with Identity, which only acts on behalf of regular customer accounts.
    messageRateLimit: Number(env.COMMUNITY_MESSAGE_RATE_LIMIT || 20),
    messageRateWindowSeconds: Number(env.COMMUNITY_MESSAGE_RATE_WINDOW_SECONDS || 600),
    supportUserIds: String(env.COMMUNITY_SUPPORT_USER_IDS || "support-mailbox").split(",").map((item) => item.trim()).filter(Boolean),
    // Community data has its own database. In-memory mode remains useful for isolated tests only.
    persistenceBackend: env.PERSISTENCE_BACKEND || env.COMMUNITY_PERSISTENCE_BACKEND || "sqlite",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.COMMUNITY_SQLITE_PATH
      || path.resolve(__dirname, "..", "..", "..", ".runtime", "gernetix-community.sqlite"),
    postgres: {
      connectionString: env.COMMUNITY_POSTGRES_URL || "",
      host: env.COMMUNITY_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.COMMUNITY_POSTGRES_PORT || 5432),
      database: env.COMMUNITY_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.COMMUNITY_POSTGRES_USER || "gernetix_runtime",
      password: env.COMMUNITY_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
