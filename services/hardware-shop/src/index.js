const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { LocalHardwareCatalogClient, HttpHardwareCatalogClient } = require("./catalog-client");
const { InMemoryHardwareShopRepository } = require("./repositories/in-memory-hardware-shop-repository");
const { SqliteBackedHardwareShopRepository } = require("./repositories/sqlite-backed-hardware-shop-repository");
const { HardwareShopService } = require("./services/hardware-shop-service");
const { createDefaultHardwareCatalog } = require("../../hardware-catalog/src");

function createDefaultHardwareShop(config = createConfig()) {
  return new HardwareShopService({
    repository: createRepository(config),
    catalogClient: createCatalogClient(config),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedHardwareShopRepository.create(config.sqlitePath);
  return new InMemoryHardwareShopRepository();
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
  SqliteBackedHardwareShopRepository,
  HardwareShopService,
  createDefaultHardwareShop,
};
