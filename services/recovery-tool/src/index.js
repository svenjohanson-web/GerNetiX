const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryRecoveryRepository } = require("./repositories/in-memory-recovery-repository");
const { SqliteBackedRecoveryRepository } = require("./repositories/sqlite-backed-recovery-repository");
const { RecoveryService } = require("./services/recovery-service");
const { HardwareSourceReader } = require("./services/hardware-source-reader");
const { HardwareLabAi } = require("./services/hardware-lab-ai");
const { BuildDeployClient } = require("./services/build-deploy-client");
const { AiUsageClient } = require("./services/ai-usage-client");
const { createLlmConfigStore } = require("../../shared/llm-config");

function createDefaultRecoveryTool(config = createConfig(), overrides = {}) {
  const llmConfigStore = overrides.llmConfigStore || createLlmConfigStore({
    configPath: config.llmConfigPath,
    defaultOllamaBaseUrl: config.ollamaBaseUrl,
    defaultOllamaModel: config.ollamaModel,
  });
  return new RecoveryService({
    repository: overrides.repository || createRepository(config),
    deviceManagementBaseUrl: config.deviceManagementBaseUrl,
    internalApiSigningKey: config.internalApiSigningKey,
    registerRecoveredDevices: config.registerRecoveredDevices,
    sourceReader: overrides.sourceReader || new HardwareSourceReader({
      maxSourceBytes: config.hardwareSourceMaxBytes,
      timeoutMs: config.hardwareSourceTimeoutMs,
    }),
    hardwareLabAi: overrides.hardwareLabAi || new HardwareLabAi({
      llmConfigStore,
      timeoutMs: config.hardwareAiTimeoutMs,
      aiUsageClient: overrides.aiUsageClient || new AiUsageClient({
        baseUrl: config.aiUsageBaseUrl,
        timeoutMs: config.aiUsageTimeoutMs,
        signingKey: config.internalApiSigningKey,
      }),
    }),
    buildDeployClient: overrides.buildDeployClient || new BuildDeployClient({
      baseUrl: config.buildDeployBaseUrl,
      signingKey: config.internalApiSigningKey,
    }),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedRecoveryRepository.create(config.sqlitePath);
  return new InMemoryRecoveryRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryRecoveryRepository,
  SqliteBackedRecoveryRepository,
  RecoveryService,
  HardwareSourceReader,
  HardwareLabAi,
  BuildDeployClient,
  AiUsageClient,
  createDefaultRecoveryTool,
};
