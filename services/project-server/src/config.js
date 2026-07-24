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
    postgres: {
      connectionString: env.PROJECT_POSTGRES_URL || "",
      host: env.PROJECT_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.PROJECT_POSTGRES_PORT || 5432),
      database: env.PROJECT_POSTGRES_DATABASE || "gernetix_projects",
      user: env.PROJECT_POSTGRES_USER || "gernetix_projects",
      password: env.PROJECT_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
