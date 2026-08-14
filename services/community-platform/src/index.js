const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryCommunityRepository } = require("./repositories/in-memory-community-repository");
const { SqliteBackedCommunityRepository } = require("./repositories/sqlite-backed-community-repository");
const { PostgresCommunityRepository } = require("./repositories/postgres-community-repository");
const { CommunityService, seedKnowledge } = require("./services/community-service");

async function createDefaultCommunityPlatform(config = createConfig()) {
  const service = new CommunityService({
    repository: await createRepository(config),
    triageSlaHours: config.triageSlaHours,
    internalApiSigningKey: config.internalApiSigningKey,
    persistenceBackend: config.persistenceBackend,
    messageRateLimit: config.messageRateLimit,
    messageRateWindowSeconds: config.messageRateWindowSeconds,
    supportUserIds: config.supportUserIds,
  });
  await seedKnowledge(service);
  return service;
}

async function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedCommunityRepository.create(config.sqlitePath);
  if (config.persistenceBackend === "memory") return new InMemoryCommunityRepository();
  if (["postgres", "postgresql"].includes(config.persistenceBackend)) {
    return PostgresCommunityRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    });
  }
  throw new Error(`Unsupported Community persistence backend: ${config.persistenceBackend}`);
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryCommunityRepository,
  PostgresCommunityRepository,
  SqliteBackedCommunityRepository,
  CommunityService,
  createDefaultCommunityPlatform,
};
