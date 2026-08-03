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
      const service = new ProjectService({ repository: resolvedRepository, projectRepositoryStore: createProjectRepositoryStore(config) });
      await service.ready;
      return service;
    });
  }
  return new ProjectService({ repository, projectRepositoryStore: createProjectRepositoryStore(config) });
}

function createProjectRepositoryStore(config) {
  if (config.repositoryStoreBackend !== "forgejo") return null;
  if (!config.forgejo?.baseUrl || !config.forgejo?.provisionToken || !config.forgejo?.runtimeToken) {
    throw new Error("forgejo_repository_store_configuration_incomplete");
  }
  const { ForgejoClient } = require("./repository-store/forgejo-client");
  const { ForgejoProjectRepositoryStore } = require("./repository-store/forgejo-project-repository-store");
  const { GitProjectRepositoryStore } = require("./repository-store/git-project-repository-store");
  return new ForgejoProjectRepositoryStore({
    organization: config.forgejo.organization,
    defaultBranch: config.forgejo.defaultBranch,
    client: new ForgejoClient({
      baseUrl: config.forgejo.baseUrl,
      token: config.forgejo.provisionToken,
      timeoutMs: config.forgejo.timeoutMs,
    }),
    git: new GitProjectRepositoryStore({
      gitBinary: config.forgejo.gitBinary,
      authToken: config.forgejo.runtimeToken,
      timeoutMs: config.forgejo.gitTimeoutMs,
    }),
  });
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
  createProjectRepositoryStore,
  createDefaultProjectServer,
};
