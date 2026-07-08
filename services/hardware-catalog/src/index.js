const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryHardwareCatalogRepository, SqliteBackedHardwareCatalogRepository } = require("./repositories");
const { HardwareCatalogService } = require("./service");

function createDefaultHardwareCatalog(config = createConfig()) {
  return new HardwareCatalogService({
    repository: createRepository(config),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedHardwareCatalogRepository.create(config.sqlitePath);
  return new InMemoryHardwareCatalogRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryHardwareCatalogRepository,
  SqliteBackedHardwareCatalogRepository,
  HardwareCatalogService,
  createDefaultHardwareCatalog,
};
