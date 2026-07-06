const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryContextRepository } = require("./repositories/in-memory-context-repository");
const { SqliteBackedContextRepository } = require("./repositories/sqlite-backed-context-repository");
const { ContextService } = require("./services/context-service");
const { LocalProjectAnalyzer } = require("./services/local-project-analyzer");

function createDefaultContextManager(config = createConfig()) {
  return new ContextService({
    repository: createRepository(config),
    analyzer: new LocalProjectAnalyzer({ rootDir: config.projectRoot }),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedContextRepository.create(config.sqlitePath);
  return new InMemoryContextRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryContextRepository,
  SqliteBackedContextRepository,
  ContextService,
  LocalProjectAnalyzer,
  createDefaultContextManager,
};
