const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.DEVICE_MANAGEMENT_RUNTIME_DIR
    ? path.resolve(env.DEVICE_MANAGEMENT_RUNTIME_DIR)
    : path.join(workspaceRoot, ".runtime");
  const sqlitePath = env.PERSISTENCE_SQLITE_PATH || env.DEVICE_MANAGEMENT_SQLITE_PATH
    ? path.resolve(env.PERSISTENCE_SQLITE_PATH || env.DEVICE_MANAGEMENT_SQLITE_PATH)
    : path.join(runtimeRoot, "gernetix-services.sqlite");

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4700),
    publicBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.DEVICE_MANAGEMENT_PERSISTENCE_BACKEND || "postgres",
    runtimeRoot,
    sqlitePath,
    postgres: {
      connectionString: env.DEVICE_MANAGEMENT_POSTGRES_URL || "",
      host: env.DEVICE_MANAGEMENT_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.DEVICE_MANAGEMENT_POSTGRES_PORT || 5432),
      database: env.DEVICE_MANAGEMENT_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.DEVICE_MANAGEMENT_POSTGRES_USER || "gernetix_runtime",
      password: env.DEVICE_MANAGEMENT_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
