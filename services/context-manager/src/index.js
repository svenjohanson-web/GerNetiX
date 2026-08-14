const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryContextRepository } = require("./repositories/in-memory-context-repository");
const { SqliteBackedContextRepository } = require("./repositories/sqlite-backed-context-repository");
const { PostgresBackedContextRepository } = require("./repositories/postgres-backed-context-repository");
const { ContextService } = require("./services/context-service");
const { LocalProjectAnalyzer } = require("./services/local-project-analyzer");

async function createDefaultContextManager(config = createConfig()) {
  return new ContextService({
    repository: await createRepository(config),
    analyzer: new LocalProjectAnalyzer({ rootDir: config.projectRoot }),
  });
}

async function createRepository(config) {
  if (config.persistenceBackend === "postgres") {
    const { Pool } = require("pg");
    const pool = new Pool(config.postgres.connectionString
      ? { connectionString: config.postgres.connectionString }
      : config.postgres);
    return PostgresBackedContextRepository.create({ pool });
  }
  if (config.persistenceBackend === "sqlite") return SqliteBackedContextRepository.create(config.sqlitePath);
  return new InMemoryContextRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryContextRepository,
  SqliteBackedContextRepository,
  PostgresBackedContextRepository,
  ContextService,
  LocalProjectAnalyzer,
  createDefaultContextManager,
};
