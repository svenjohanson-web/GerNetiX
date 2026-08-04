const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.PUBLIC_DEMO_RUNTIME_DIR
    ? path.resolve(env.PUBLIC_DEMO_RUNTIME_DIR)
    : path.join(workspaceRoot, ".runtime", "public-demos");
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4920),
    runtimeRoot,
    persistenceBackend: env.PUBLIC_DEMO_PERSISTENCE_BACKEND || env.PERSISTENCE_BACKEND || "sqlite",
    sqlitePath: env.PUBLIC_DEMO_SQLITE_PATH
      ? path.resolve(env.PUBLIC_DEMO_SQLITE_PATH)
      : path.join(runtimeRoot, "gernetix-public-demos.sqlite"),
    postgres: {
      connectionString: env.PUBLIC_DEMO_POSTGRES_URL || "",
      host: env.PUBLIC_DEMO_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.PUBLIC_DEMO_POSTGRES_PORT || 5432),
      database: env.PUBLIC_DEMO_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.PUBLIC_DEMO_POSTGRES_USER || "gernetix_runtime",
      password: env.PUBLIC_DEMO_POSTGRES_PASSWORD || "",
    },
    publisherToken: env.PUBLIC_DEMO_PUBLISHER_TOKEN || "",
    artifactDir: path.resolve(env.ARTIFACT_STORE_DIR || path.join(workspaceRoot, ".runtime", "artifacts")),
  };
}

module.exports = { createConfig };
