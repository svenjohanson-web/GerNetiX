const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.PROJECT_SERVER_RUNTIME_DIR
    ? path.resolve(env.PROJECT_SERVER_RUNTIME_DIR)
    : path.join(workspaceRoot, ".runtime");
  const sqlitePath = env.PROJECT_SERVER_SQLITE_PATH || env.PERSISTENCE_SQLITE_PATH
    ? path.resolve(env.PROJECT_SERVER_SQLITE_PATH || env.PERSISTENCE_SQLITE_PATH)
    : path.join(runtimeRoot, "gernetix-projects.sqlite");

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4800),
    publicBaseUrl: env.PROJECT_SERVER_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.PROJECT_SERVER_PERSISTENCE_BACKEND || "sqlite",
    runtimeRoot,
    sqlitePath,
    repositoryStoreBackend: env.PROJECT_REPOSITORY_STORE || "sql",
    forgejo: {
      baseUrl: env.FORGEJO_INTERNAL_URL || "",
      organization: env.FORGEJO_PROJECT_ORGANIZATION || "gernetix-projects",
      defaultBranch: env.FORGEJO_PROJECT_DEFAULT_BRANCH || "main",
      provisionToken: env.FORGEJO_PROVISION_TOKEN || "",
      runtimeToken: env.FORGEJO_RUNTIME_TOKEN || "",
      gitBinary: env.GIT_BINARY || "git",
      timeoutMs: Number(env.FORGEJO_TIMEOUT_MS || 10_000),
      gitTimeoutMs: Number(env.PROJECT_GIT_TIMEOUT_MS || 30_000),
    },
    postgres: {
      connectionString: env.PROJECT_POSTGRES_URL || "",
      host: env.PROJECT_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.PROJECT_POSTGRES_PORT || 5432),
      database: env.PROJECT_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.PROJECT_POSTGRES_USER || "gernetix_runtime",
      password: env.PROJECT_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
