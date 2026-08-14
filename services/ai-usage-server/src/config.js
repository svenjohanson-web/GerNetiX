const path = require("node:path");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5000),
    publicBaseUrl: env.AI_USAGE_BASE_URL || "",
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "ai-usage-server"),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.AI_USAGE_PERSISTENCE_BACKEND || "postgres",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.AI_USAGE_SQLITE_PATH || path.resolve(__dirname, "..", "..", "..", ".runtime", "gernetix-services.sqlite"),
    postgres: {
      connectionString: env.AI_USAGE_POSTGRES_URL || "",
      host: env.AI_USAGE_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.AI_USAGE_POSTGRES_PORT || 5432),
      database: env.AI_USAGE_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.AI_USAGE_POSTGRES_USER || "gernetix_runtime",
      password: env.AI_USAGE_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
