const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryAdminRepository } = require("./repositories/in-memory-admin-repository");
const { SqliteBackedAdminRepository } = require("./repositories/sqlite-backed-admin-repository");
const { AdminAccessPolicy } = require("./services/admin-access-policy");
const { AdminService } = require("./services/admin-service");
const { createLlmConfigStore } = require("../../shared/llm-config");

function createDefaultAdminTool(config = {}) {
  const repository = createRepository(config);
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
      deviceManagementBaseUrl: config.deviceManagementBaseUrl,
      projectServerBaseUrl: config.projectServerBaseUrl,
      aiUsageBaseUrl: config.aiUsageBaseUrl,
      aiContextBaseUrl: config.aiContextBaseUrl,
    } : null,
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedAdminRepository.create(config.sqlitePath);
  return new InMemoryAdminRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryAdminRepository,
  SqliteBackedAdminRepository,
  AdminAccessPolicy,
  AdminService,
  createDefaultAdminTool,
};
