const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryAdminRepository } = require("./repositories/in-memory-admin-repository");
const { SqliteBackedAdminRepository } = require("./repositories/sqlite-backed-admin-repository");
const { PostgresAdminRepository } = require("./repositories/postgres-admin-repository");
const { AdminAccessPolicy } = require("./services/admin-access-policy");
const { AdminService } = require("./services/admin-service");
const { createLlmConfigStore } = require("../../shared/llm-config");

function createDefaultAdminTool(config = {}) {
  const repository = createRepository(config);
  if (repository && typeof repository.then === "function") {
    return repository.then((resolved) => createAdminService(config, resolved));
  }
  return createAdminService(config, repository);
}

function createAdminService(config, repository) {
  const accessPolicy = new AdminAccessPolicy({ repository });
  return new AdminService({
    repository,
    accessPolicy,
    llmConfigStore: createLlmConfigStore({
      configPath: config.llmConfigPath,
      defaultOllamaBaseUrl: config.defaultOllamaBaseUrl,
      defaultOllamaModel: config.defaultOllamaModel,
    }),
    serviceClients: config.deviceManagementBaseUrl ? {
      adminToolBaseUrl: config.adminToolBaseUrl,
      deviceManagementBaseUrl: config.deviceManagementBaseUrl,
      identityBaseUrl: config.identityBaseUrl,
      identityAdminToken: config.identityAdminToken,
      adminToolAccessToken: config.adminToolAccessToken,
      systemEventIngestToken: config.systemEventIngestToken,
      buildDeployBaseUrl: config.buildDeployBaseUrl,
      projectServerBaseUrl: config.projectServerBaseUrl,
      hardwareShopBaseUrl: config.hardwareShopBaseUrl,
      hardwareCatalogBaseUrl: config.hardwareCatalogBaseUrl,
      aiUsageBaseUrl: config.aiUsageBaseUrl,
      aiContextBaseUrl: config.aiContextBaseUrl,
      provisioningBaseUrl: config.provisioningBaseUrl,
      recoveryBaseUrl: config.recoveryBaseUrl,
      communityPlatformBaseUrl: config.communityPlatformBaseUrl,
      communityInternalToken: config.communityInternalToken,
      communityAiBaseUrl: config.communityAiBaseUrl,
      securityMonitorToken: config.securityMonitorToken,
    } : null,
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedAdminRepository.create(config.sqlitePath);
  if (config.persistenceBackend === "memory" || !config.persistenceBackend) return new InMemoryAdminRepository();
  if (["postgres", "postgresql"].includes(config.persistenceBackend)) {
    return PostgresAdminRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    });
  }
  throw new Error(`Unsupported Admin Tool persistence backend: ${config.persistenceBackend}`);
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryAdminRepository,
  PostgresAdminRepository,
  SqliteBackedAdminRepository,
  AdminAccessPolicy,
  AdminService,
  createDefaultAdminTool,
};
