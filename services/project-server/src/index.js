const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { FileBackedProjectRepository } = require("./repositories/file-backed-project-repository");
const { InMemoryProjectRepository } = require("./repositories/in-memory-project-repository");
const { SqliteBackedProjectRepository } = require("./repositories/sqlite-backed-project-repository");
const { ProjectService } = require("./services/project-service");

function createDefaultProjectServer(config = createConfig()) {
  const repository = createRepository(config);
  if (repository && typeof repository.then === "function") {
    return repository.then(async (resolvedRepository) => {
      const service = new ProjectService({ repository: resolvedRepository });
      await service.ready;
      return service;
    });
  }
  return new ProjectService({ repository });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") {
    return SqliteBackedProjectRepository.create(config.sqlitePath);
  }
  if (config.persistenceBackend === "json") {
    return FileBackedProjectRepository.create(config.runtimeRoot);
  }
  if (["postgres", "postgresql"].includes(config.persistenceBackend)) {
    const { PostgresProjectRepository } = require("./repositories/postgres-project-repository");
    return PostgresProjectRepository.create({
      poolOptions: config.postgres?.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    });
  }
  return new InMemoryProjectRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  FileBackedProjectRepository,
  InMemoryProjectRepository,
  SqliteBackedProjectRepository,
  PostgresProjectRepository: require("./repositories/postgres-project-repository").PostgresProjectRepository,
  ProjectService,
  createDefaultProjectServer,
};
