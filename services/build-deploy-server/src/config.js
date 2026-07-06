const path = require("node:path");

function createConfig(env = process.env) {
  const runtimeRoot = env.BUILD_DEPLOY_RUNTIME_DIR
    ? path.resolve(env.BUILD_DEPLOY_RUNTIME_DIR)
    : path.join(__dirname, "..", ".runtime");

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4400),
    publicBaseUrl: env.PUBLIC_BASE_URL || "",
    runner: env.BUILD_RUNNER || "mock",
    platformioCommand: env.PLATFORMIO_COMMAND || "platformio",
    runtimeRoot,
    tempDir: path.join(runtimeRoot, "tmp"),
    cacheDir: env.BUILD_CACHE_DIR ? path.resolve(env.BUILD_CACHE_DIR) : path.join(runtimeRoot, "cache"),
    artifactDir: env.BUILD_ARTIFACT_DIR
      ? path.resolve(env.BUILD_ARTIFACT_DIR)
      : path.join(runtimeRoot, "artifacts"),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.BUILD_DEPLOY_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.BUILD_DEPLOY_SQLITE_PATH || path.join(runtimeRoot, "gernetix-services.sqlite"),
  };
}

module.exports = { createConfig };
