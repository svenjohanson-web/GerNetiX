const path = require("node:path");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4600),
    adminToolBaseUrl: env.ADMIN_TOOL_BASE_URL || `http://${env.HOST || "127.0.0.1"}:${Number(env.PORT || 4600)}`,
    runtimeRoot: env.ADMIN_TOOL_RUNTIME_DIR
      ? path.resolve(env.ADMIN_TOOL_RUNTIME_DIR)
      : path.join(__dirname, "..", ".runtime"),
    deviceManagementBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700",
    identityBaseUrl: env.IDENTITY_BASE_URL || "http://127.0.0.1:4300",
    buildDeployBaseUrl: env.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400",
    projectServerBaseUrl: env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800",
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "admin-tool"),
    hardwareShopBaseUrl: env.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900",
    hardwareCatalogBaseUrl: env.HARDWARE_CATALOG_BASE_URL || "http://127.0.0.1:4910",
    publicDemoBaseUrl: env.PUBLIC_DEMO_BASE_URL || "http://127.0.0.1:4920",
    aiUsageBaseUrl: env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000",
    aiContextBaseUrl: env.AI_CONTEXT_BASE_URL || "http://127.0.0.1:5500",
    provisioningBaseUrl: env.PROVISIONING_BASE_URL || "http://127.0.0.1:4500",
    recoveryBaseUrl: env.RECOVERY_BASE_URL || "http://127.0.0.1:5100",
    communityPlatformBaseUrl: env.COMMUNITY_PLATFORM_BASE_URL || "http://127.0.0.1:5200",
    communityAiBaseUrl: env.COMMUNITY_AI_BASE_URL || "http://127.0.0.1:5300",
    defaultOllamaBaseUrl: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    defaultOllamaModel: env.OLLAMA_MODEL || "llama3.2:3b",
    llmConfigPath: env.LLM_CONFIG_PATH || path.join(__dirname, "..", "..", "..", ".runtime", "identity-llm-config.json"),
    runtimeStateEncryptionKey: env.RUNTIME_STATE_ENCRYPTION_KEY || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.ADMIN_TOOL_PERSISTENCE_BACKEND || "postgres",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.ADMIN_TOOL_SQLITE_PATH || path.join(__dirname, "..", "..", "..", ".runtime", "gernetix-services.sqlite"),
    postgres: {
      connectionString: env.OPERATIONS_POSTGRES_URL || "",
      host: env.OPERATIONS_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.OPERATIONS_POSTGRES_PORT || 5432),
      database: env.OPERATIONS_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.OPERATIONS_POSTGRES_USER || "gernetix_runtime",
      password: env.OPERATIONS_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
