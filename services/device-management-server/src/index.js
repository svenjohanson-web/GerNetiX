const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { FileBackedDeviceManagementRepository } = require("./repositories/file-backed-device-management-repository");
const { InMemoryDeviceManagementRepository } = require("./repositories/in-memory-device-management-repository");
const { SqliteBackedDeviceManagementRepository } = require("./repositories/sqlite-backed-device-management-repository");
const { DeviceManagementService } = require("./services/device-management-service");

function createDefaultDeviceManagementServer(config = createConfig()) {
  return new DeviceManagementService({
    repository: createRepository(config),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") {
    return SqliteBackedDeviceManagementRepository.create(config.sqlitePath);
  }
  if (config.persistenceBackend === "json") {
    return FileBackedDeviceManagementRepository.create(config.runtimeRoot);
  }
  return new InMemoryDeviceManagementRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  FileBackedDeviceManagementRepository,
  InMemoryDeviceManagementRepository,
  SqliteBackedDeviceManagementRepository,
  DeviceManagementService,
  createDefaultDeviceManagementServer,
};
