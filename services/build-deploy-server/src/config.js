const path = require("node:path");
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.BUILD_DEPLOY_RUNTIME_DIR
    ? path.resolve(env.BUILD_DEPLOY_RUNTIME_DIR)
    : path.join(__dirname, "..", ".runtime");

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4400),
    publicBaseUrl: env.PUBLIC_BASE_URL || "",
    mqttBrokerUrl: env.MQTT_BROKER_URL || "",
    runner: env.BUILD_RUNNER || "platformio",
    allowMockRunner: env.NODE_ENV === "test",
    platformioCommand: env.PLATFORMIO_COMMAND || (env.HOME
      ? path.join(env.HOME, ".platformio", "penv", "bin", "platformio")
      : "platformio"),
    runtimeRoot,
    tempDir: path.join(runtimeRoot, "tmp"),
    incrementalCacheDir: path.join(runtimeRoot, "incremental-build-cache"),
    cacheDir: env.BUILD_CACHE_DIR === "platformio-default"
      ? null
      : env.BUILD_CACHE_DIR
        ? path.resolve(env.BUILD_CACHE_DIR)
        : path.join(runtimeRoot, "cache"),
    artifactDir: env.BUILD_ARTIFACT_DIR
      ? path.resolve(env.BUILD_ARTIFACT_DIR)
      : path.join(runtimeRoot, "artifacts"),
    artifactSqlitePath: env.BUILD_ARTIFACT_SQLITE_PATH
      ? path.resolve(env.BUILD_ARTIFACT_SQLITE_PATH)
      : env.NODE_ENV === "test"
        ? ":memory:"
        : path.join(runtimeRoot, "gernetix-build-artifacts.sqlite"),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.BUILD_DEPLOY_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.BUILD_DEPLOY_SQLITE_PATH || path.join(runtimeRoot, "gernetix-services.sqlite"),
    interfaceTelemetrySqlitePath: env.INTERFACE_TELEMETRY_SQLITE_PATH
      ? path.resolve(env.INTERFACE_TELEMETRY_SQLITE_PATH)
      : (env.PERSISTENCE_SQLITE_PATH || path.join(workspaceRoot, ".runtime", "gernetix-services.sqlite")),
    otaSigningPrivateKeyPath: env.OTA_SIGNING_PRIVATE_KEY_PATH ? path.resolve(env.OTA_SIGNING_PRIVATE_KEY_PATH) : "",
    otaSigningKeyId: env.OTA_SIGNING_KEY_ID || "",
  };
}

module.exports = { createConfig };
