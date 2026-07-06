const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryAiUsageRepository } = require("./repositories/in-memory-ai-usage-repository");
const { SqliteBackedAiUsageRepository } = require("./repositories/sqlite-backed-ai-usage-repository");
const { AiUsageService } = require("./services/ai-usage-service");

function createDefaultAiUsageServer(config = createConfig()) {
  return new AiUsageService({
    repository: createRepository(config),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedAiUsageRepository.create(config.sqlitePath);
  return new InMemoryAiUsageRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryAiUsageRepository,
  SqliteBackedAiUsageRepository,
  AiUsageService,
  createDefaultAiUsageServer,
};
