const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { FileBackedProjectRepository } = require("./repositories/file-backed-project-repository");
const { InMemoryProjectRepository } = require("./repositories/in-memory-project-repository");
const { SqliteBackedProjectRepository } = require("./repositories/sqlite-backed-project-repository");
const { ProjectService } = require("./services/project-service");

function createDefaultProjectServer(config = createConfig()) {
  return new ProjectService({
    repository: createRepository(config),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") {
    return SqliteBackedProjectRepository.create(config.sqlitePath);
  }
  if (config.persistenceBackend === "json") {
    return FileBackedProjectRepository.create(config.runtimeRoot);
  }
  return new InMemoryProjectRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  FileBackedProjectRepository,
  InMemoryProjectRepository,
  SqliteBackedProjectRepository,
  ProjectService,
  createDefaultProjectServer,
};
