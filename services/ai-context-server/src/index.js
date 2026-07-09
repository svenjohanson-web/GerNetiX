const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryAiContextRepository } = require("./repositories/in-memory-ai-context-repository");
const { SqliteBackedAiContextRepository } = require("./repositories/sqlite-backed-ai-context-repository");
const { AiContextService } = require("./services/ai-context-service");

function createDefaultAiContextServer(config = createConfig()) {
  return new AiContextService({
    repository: createRepository(config),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedAiContextRepository.create(config.sqlitePath);
  return new InMemoryAiContextRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryAiContextRepository,
  SqliteBackedAiContextRepository,
  AiContextService,
  createDefaultAiContextServer,
};
