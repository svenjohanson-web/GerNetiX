const path = require("node:path");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5100),
    deviceManagementBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700/api/device-management",
    registerRecoveredDevices: env.REGISTER_RECOVERED_DEVICES !== "false",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.RECOVERY_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.RECOVERY_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
    llmConfigPath: env.RECOVERY_LLM_CONFIG_PATH || path.join(workspaceRoot, ".runtime", "identity-llm-config.json"),
    ollamaBaseUrl: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    ollamaModel: env.OLLAMA_MODEL || "qwen2.5-coder:7b",
    buildDeployBaseUrl: env.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400",
    aiUsageBaseUrl: env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000/api/ai-usage",
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "recovery-tool"),
    aiUsageTimeoutMs: Number(env.AI_USAGE_TIMEOUT_MS || 10000),
    hardwareSourceMaxBytes: Number(env.HARDWARE_SOURCE_MAX_BYTES || 2 * 1024 * 1024),
    hardwareSourceTimeoutMs: Number(env.HARDWARE_SOURCE_TIMEOUT_MS || 12000),
    hardwareAiTimeoutMs: Number(env.HARDWARE_AI_TIMEOUT_MS || 90000),
  };
}

module.exports = { createConfig };
