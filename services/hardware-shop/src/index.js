const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryHardwareShopRepository } = require("./repositories/in-memory-hardware-shop-repository");
const { SqliteBackedHardwareShopRepository } = require("./repositories/sqlite-backed-hardware-shop-repository");
const { HardwareShopService } = require("./services/hardware-shop-service");

function createDefaultHardwareShop(config = createConfig()) {
  return new HardwareShopService({
    repository: createRepository(config),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedHardwareShopRepository.create(config.sqlitePath);
  return new InMemoryHardwareShopRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryHardwareShopRepository,
  SqliteBackedHardwareShopRepository,
  HardwareShopService,
  createDefaultHardwareShop,
};
