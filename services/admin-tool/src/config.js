const path = require("node:path");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4600),
    runtimeRoot: env.ADMIN_TOOL_RUNTIME_DIR
      ? path.resolve(env.ADMIN_TOOL_RUNTIME_DIR)
      : path.join(__dirname, "..", ".runtime"),
    deviceManagementBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700",
    projectServerBaseUrl: env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800",
    hardwareCatalogBaseUrl: env.HARDWARE_CATALOG_BASE_URL || "http://127.0.0.1:4910",
    aiUsageBaseUrl: env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000",
    aiContextBaseUrl: env.AI_CONTEXT_BASE_URL || "http://127.0.0.1:5500",
    defaultOllamaBaseUrl: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    defaultOllamaModel: env.OLLAMA_MODEL || "llama3.2:3b",
    llmConfigPath: env.LLM_CONFIG_PATH || path.join(__dirname, "..", "..", "..", ".runtime", "identity-llm-config.json"),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.ADMIN_TOOL_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.ADMIN_TOOL_SQLITE_PATH || path.join(__dirname, "..", ".runtime", "gernetix-services.sqlite"),
  };
}

module.exports = { createConfig };
