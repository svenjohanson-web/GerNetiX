const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { FileBackedDeviceManagementRepository } = require("./repositories/file-backed-device-management-repository");
const { InMemoryDeviceManagementRepository } = require("./repositories/in-memory-device-management-repository");
const { PostgresDeviceManagementRepository } = require("./repositories/postgres-device-management-repository");
const { SqliteBackedDeviceManagementRepository } = require("./repositories/sqlite-backed-device-management-repository");
const { DeviceManagementService } = require("./services/device-management-service");

async function createDefaultDeviceManagementServer(config = createConfig({ DEVICE_MANAGEMENT_PERSISTENCE_BACKEND: "memory" })) {
  return new DeviceManagementService({
    repository: await createRepository(config),
  });
}

async function createRepository(config) {
  if (config.persistenceBackend === "sqlite") {
    return SqliteBackedDeviceManagementRepository.create(config.sqlitePath);
  }
  if (config.persistenceBackend === "json") {
    return FileBackedDeviceManagementRepository.create(config.runtimeRoot);
  }
  if (config.persistenceBackend === "memory") return new InMemoryDeviceManagementRepository();
  if (["postgres", "postgresql"].includes(config.persistenceBackend)) {
    return PostgresDeviceManagementRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    });
  }
  throw new Error(`Unsupported Device Management persistence backend: ${config.persistenceBackend}`);
}

module.exports = {
  createConfig,
  createHttpApp,
  FileBackedDeviceManagementRepository,
  InMemoryDeviceManagementRepository,
  PostgresDeviceManagementRepository,
  SqliteBackedDeviceManagementRepository,
  DeviceManagementService,
  createDefaultDeviceManagementServer,
};
