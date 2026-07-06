const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { CredentialGenerator } = require("./modules/credential-generator");
const { DeviceIdFactory } = require("./modules/device-id-factory");
const { FlashPlanner } = require("./modules/flash-planner");
const { InMemoryProvisioningRepository } = require("./repositories/in-memory-provisioning-repository");
const { SqliteBackedProvisioningRepository } = require("./repositories/sqlite-backed-provisioning-repository");
const { ProvisioningService } = require("./services/provisioning-service");

function createDefaultProvisioningTool(config = createConfig()) {
  return new ProvisioningService({
    repository: createRepository(config),
    deviceIdFactory: new DeviceIdFactory(),
    credentialGenerator: new CredentialGenerator(),
    flashPlanner: new FlashPlanner({ flashRunner: config.flashRunner }),
    deviceManagementBaseUrl: config.deviceManagementBaseUrl,
    registerDeviceOnComplete: config.registerDeviceOnComplete,
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedProvisioningRepository.create(config.sqlitePath);
  return new InMemoryProvisioningRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  CredentialGenerator,
  DeviceIdFactory,
  FlashPlanner,
  InMemoryProvisioningRepository,
  SqliteBackedProvisioningRepository,
  ProvisioningService,
  createDefaultProvisioningTool,
};
