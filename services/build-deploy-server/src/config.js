const path = require("node:path");
const os = require("node:os");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.BUILD_DEPLOY_RUNTIME_DIR
    ? path.resolve(env.BUILD_DEPLOY_RUNTIME_DIR)
    : path.join(__dirname, "..", ".runtime");

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4400),
    publicBaseUrl: env.PUBLIC_BASE_URL || "",
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "build-deploy-server"),
    mqttBrokerUrl: env.MQTT_BROKER_URL || "",
    runner: env.BUILD_RUNNER || "platformio",
    allowMockRunner: env.NODE_ENV === "test",
    platformioCommand: env.PLATFORMIO_COMMAND || (env.HOME
      ? path.join(env.HOME, ".platformio", "penv", "bin", "platformio")
      : "platformio"),
    addr2lineCommands: env.BUILD_ADDR2LINE_COMMANDS
      ? String(env.BUILD_ADDR2LINE_COMMANDS).split(",").map((value) => value.trim()).filter(Boolean)
      : defaultAddr2lineCommands(env),
    runtimeRoot,
    tempDir: path.join(runtimeRoot, "tmp"),
    incrementalCacheDir: path.join(runtimeRoot, "incremental-build-cache"),
    incrementalCacheTtlMs: Number(env.BUILD_INCREMENTAL_CACHE_TTL_MS || 7 * 24 * 60 * 60 * 1000),
    incrementalCachePruneIntervalMs: Number(env.BUILD_INCREMENTAL_CACHE_PRUNE_INTERVAL_MS || 60 * 60 * 1000),
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
    artifactPersistenceBackend: env.BUILD_ARTIFACT_PERSISTENCE_BACKEND || "sqlite",
    artifactUploadBaseUrl: env.BUILD_ARTIFACT_UPLOAD_BASE_URL || "",
    artifactUploadToken: env.BUILD_ARTIFACT_UPLOAD_TOKEN || "",
    artifactUploadTimeoutMs: Number(env.BUILD_ARTIFACT_UPLOAD_TIMEOUT_MS || 120000),
    artifactUploadStagingDir: env.BUILD_ARTIFACT_UPLOAD_STAGING_DIR
      ? path.resolve(env.BUILD_ARTIFACT_UPLOAD_STAGING_DIR)
      : path.join(runtimeRoot, "artifact-upload-staging"),
    artifactUploadMaxStoredBytes: Number(env.BUILD_ARTIFACT_UPLOAD_MAX_STORED_BYTES || 64 * 1024 * 1024),
    artifactUploadMaxOriginalBytes: Number(env.BUILD_ARTIFACT_UPLOAD_MAX_ORIGINAL_BYTES || 128 * 1024 * 1024),
    artifactUploadStaleMs: Number(env.BUILD_ARTIFACT_UPLOAD_STALE_MS || 60 * 60 * 1000),
    artifactRetentionPruneIntervalMs: Number(env.BUILD_ARTIFACT_RETENTION_PRUNE_INTERVAL_MS || 60 * 60 * 1000),
    artifactPolicyOverrides: parseJsonObject(env.BUILD_ARTIFACT_POLICY_JSON, "BUILD_ARTIFACT_POLICY_JSON"),
    coordinationBackend: env.BUILD_COORDINATION_BACKEND
      || ((env.BUILD_ARTIFACT_PERSISTENCE_BACKEND || "sqlite") === "postgres" ? "postgres" : "memory"),
    workerId: env.BUILD_WORKER_ID || os.hostname(),
    workerRole: env.BUILD_WORKER_ROLE === "build_only" ? "build_only" : "full",
    coordinationPoolMax: Number(env.BUILD_COORDINATION_POOL_MAX || 20),
    workerHeartbeatMs: Number(env.BUILD_WORKER_HEARTBEAT_MS || 15000),
    workerStaleMs: Number(env.BUILD_WORKER_STALE_MS || 120000),
    cancellationPollMs: Number(env.BUILD_CANCELLATION_POLL_MS || 500),
    databaseSchemaManagement: env.BUILD_DATABASE_SCHEMA_MANAGEMENT !== "disabled",
    postgres: {
      connectionString: env.BUILD_POSTGRES_URL || "",
      host: env.BUILD_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.BUILD_POSTGRES_PORT || 5432),
      database: env.BUILD_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.BUILD_POSTGRES_USER || "gernetix_runtime",
      password: env.BUILD_POSTGRES_PASSWORD || "",
    },
    persistenceBackend: env.PERSISTENCE_BACKEND || env.BUILD_DEPLOY_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.BUILD_DEPLOY_SQLITE_PATH || path.join(runtimeRoot, "gernetix-services.sqlite"),
    interfaceTelemetrySqlitePath: env.INTERFACE_TELEMETRY_SQLITE_PATH
      ? path.resolve(env.INTERFACE_TELEMETRY_SQLITE_PATH)
      : (env.PERSISTENCE_SQLITE_PATH || path.join(workspaceRoot, ".runtime", "gernetix-services.sqlite")),
    interfaceTelemetryEndpoint: env.INTERFACE_TELEMETRY_ENDPOINT || "",
    otaSigningPrivateKeyPath: env.OTA_SIGNING_PRIVATE_KEY_PATH ? path.resolve(env.OTA_SIGNING_PRIVATE_KEY_PATH) : "",
    otaSigningKeyId: env.OTA_SIGNING_KEY_ID || "",
  };
}

function parseJsonObject(value, name) {
  if (!value) return {};
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${name} muss gueltiges JSON enthalten.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${name} muss ein JSON-Objekt enthalten.`);
  return parsed;
}

function defaultAddr2lineCommands(env) {
  const commands = [];
  if (env.HOME) {
    commands.push(
      path.join(env.HOME, ".platformio", "packages", "toolchain-xtensa-esp-elf", "bin", "xtensa-esp32s3-elf-addr2line"),
      path.join(env.HOME, ".platformio", "packages", "toolchain-xtensa-esp32s3", "bin", "xtensa-esp32s3-elf-addr2line"),
      path.join(env.HOME, ".platformio", "packages", "toolchain-xtensa-esp-elf", "bin", "xtensa-esp32-elf-addr2line"),
      path.join(env.HOME, ".platformio", "packages", "toolchain-xtensa32", "bin", "xtensa-esp32-elf-addr2line"),
      path.join(env.HOME, ".platformio", "packages", "toolchain-riscv32-esp", "bin", "riscv32-esp-elf-addr2line"),
    );
  }
  return commands.concat(["xtensa-esp32s3-elf-addr2line", "xtensa-esp32-elf-addr2line", "riscv32-esp-elf-addr2line"]);
}

module.exports = { createConfig };
