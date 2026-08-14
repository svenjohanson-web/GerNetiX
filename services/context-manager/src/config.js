const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5050),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.CONTEXT_MANAGER_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.CONTEXT_MANAGER_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
    projectRoot: env.PROJECT_ROOT || env.CONTEXT_MANAGER_PROJECT_ROOT || process.cwd(),
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "context-manager"),
    postgres: {
      connectionString: env.CONTEXT_MANAGER_POSTGRES_URL || "",
      host: env.CONTEXT_MANAGER_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.CONTEXT_MANAGER_POSTGRES_PORT || 5432),
      database: env.CONTEXT_MANAGER_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.CONTEXT_MANAGER_POSTGRES_USER || "gernetix_runtime",
      password: env.CONTEXT_MANAGER_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
