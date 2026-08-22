const path = require("node:path");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4610),
    sqlitePath: env.ADMIN_ACCESS_SQLITE_PATH || path.join(__dirname, "..", ".runtime", "gernetix-admin-access.sqlite"),
    persistenceBackend: env.ADMIN_ACCESS_PERSISTENCE_BACKEND || env.PERSISTENCE_BACKEND || "sqlite",
    postgres: {
      connectionString: env.ADMIN_ACCESS_POSTGRES_URL || "",
      host: env.ADMIN_ACCESS_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.ADMIN_ACCESS_POSTGRES_PORT || 5432),
      database: env.ADMIN_ACCESS_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.ADMIN_ACCESS_POSTGRES_USER || "gernetix_runtime",
      password: env.ADMIN_ACCESS_POSTGRES_PASSWORD || "",
    },
    adminToolBaseUrl: env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600",
    contextManagerBaseUrl: env.CONTEXT_MANAGER_BASE_URL || "http://127.0.0.1:5050",
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "admin-access-server"),
    bootstrapUsername: env.ADMIN_BOOTSTRAP_USERNAME || "",
    bootstrapPassword: env.ADMIN_BOOTSTRAP_PASSWORD || "",
    sessionHours: Math.max(1, Math.min(24, Number(env.ADMIN_SESSION_HOURS || 8))),
    cookieSecure: env.ADMIN_SESSION_COOKIE_SECURE === "true",
  };
}

module.exports = { createConfig };
