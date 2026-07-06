const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryRecoveryRepository } = require("./repositories/in-memory-recovery-repository");
const { SqliteBackedRecoveryRepository } = require("./repositories/sqlite-backed-recovery-repository");
const { RecoveryService } = require("./services/recovery-service");

function createDefaultRecoveryTool(config = createConfig()) {
  return new RecoveryService({
    repository: createRepository(config),
    deviceManagementBaseUrl: config.deviceManagementBaseUrl,
    registerRecoveredDevices: config.registerRecoveredDevices,
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedRecoveryRepository.create(config.sqlitePath);
  return new InMemoryRecoveryRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryRecoveryRepository,
  SqliteBackedRecoveryRepository,
  RecoveryService,
  createDefaultRecoveryTool,
};
