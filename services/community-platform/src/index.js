const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryCommunityRepository } = require("./repositories/in-memory-community-repository");
const { SqliteBackedCommunityRepository } = require("./repositories/sqlite-backed-community-repository");
const { CommunityService } = require("./services/community-service");

function createDefaultCommunityPlatform(config = createConfig()) {
  return new CommunityService({
    repository: createRepository(config),
    triageSlaHours: config.triageSlaHours,
    internalToken: config.internalToken,
    persistenceBackend: config.persistenceBackend,
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedCommunityRepository.create(config.sqlitePath);
  if (config.persistenceBackend === "memory") return new InMemoryCommunityRepository();
  throw new Error(`Unsupported Community persistence backend: ${config.persistenceBackend}`);
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryCommunityRepository,
  SqliteBackedCommunityRepository,
  CommunityService,
  createDefaultCommunityPlatform,
};
