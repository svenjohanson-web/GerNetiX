const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { LocalHardwareCatalogClient, HttpHardwareCatalogClient } = require("./catalog-client");
const { InMemoryHardwareShopRepository } = require("./repositories/in-memory-hardware-shop-repository");
const { SqliteBackedHardwareShopRepository } = require("./repositories/sqlite-backed-hardware-shop-repository");
const { PostgresHardwareShopRepository } = require("./repositories/postgres-hardware-shop-repository");
const { HardwareShopService } = require("./services/hardware-shop-service");
const { createDefaultHardwareCatalog } = require("../../hardware-catalog/src");

function createDefaultHardwareShop(config = createConfig()) {
  const repository = createRepository(config);
  if (repository && typeof repository.then === "function") {
    return repository.then((resolved) => new HardwareShopService({
      repository: resolved,
      catalogClient: createCatalogClient(config),
    }));
  }
  return new HardwareShopService({ repository, catalogClient: createCatalogClient(config) });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedHardwareShopRepository.create(config.sqlitePath);
  if (config.persistenceBackend === "memory") return new InMemoryHardwareShopRepository();
  if (["postgres", "postgresql"].includes(config.persistenceBackend)) {
    return PostgresHardwareShopRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    });
  }
  throw new Error(`Unsupported Hardware Shop persistence backend: ${config.persistenceBackend}`);
}

function createCatalogClient(config) {
  if (config.catalogClient) return config.catalogClient;
  if (config.hardwareCatalogBaseUrl) return new HttpHardwareCatalogClient(config.hardwareCatalogBaseUrl);
  return new LocalHardwareCatalogClient(createDefaultHardwareCatalog({
    persistenceBackend: config.persistenceBackend,
    sqlitePath: config.sqlitePath,
  }));
}

module.exports = {
  createConfig,
  createHttpApp,
  LocalHardwareCatalogClient,
  HttpHardwareCatalogClient,
  InMemoryHardwareShopRepository,
  PostgresHardwareShopRepository,
  SqliteBackedHardwareShopRepository,
  HardwareShopService,
  createDefaultHardwareShop,
};
