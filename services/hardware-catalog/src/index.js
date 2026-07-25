const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryHardwareCatalogRepository, SqliteBackedHardwareCatalogRepository } = require("./repositories");
const { PostgresHardwareCatalogRepository } = require("./postgres-repository");
const { HardwareCatalogService } = require("./service");

function createDefaultHardwareCatalog(config = createConfig()) {
  const repository = createRepository(config);
  if (repository && typeof repository.then === "function") {
    return repository.then((resolved) => new HardwareCatalogService({ repository: resolved }));
  }
  return new HardwareCatalogService({ repository });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedHardwareCatalogRepository.create(config.sqlitePath);
  if (config.persistenceBackend === "memory") return new InMemoryHardwareCatalogRepository();
  if (["postgres", "postgresql"].includes(config.persistenceBackend)) {
    return PostgresHardwareCatalogRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    });
  }
  throw new Error(`Unsupported Hardware Catalog persistence backend: ${config.persistenceBackend}`);
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryHardwareCatalogRepository,
  PostgresHardwareCatalogRepository,
  SqliteBackedHardwareCatalogRepository,
  HardwareCatalogService,
  createDefaultHardwareCatalog,
};
