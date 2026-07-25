const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryAiUsageRepository } = require("./repositories/in-memory-ai-usage-repository");
const { PostgresAiUsageRepository } = require("./repositories/postgres-ai-usage-repository");
const { SqliteBackedAiUsageRepository } = require("./repositories/sqlite-backed-ai-usage-repository");
const { AiUsageService } = require("./services/ai-usage-service");

async function createDefaultAiUsageServer(config = createConfig({ AI_USAGE_PERSISTENCE_BACKEND: "memory" })) {
  return new AiUsageService({
    repository: await createRepository(config),
  });
}

async function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedAiUsageRepository.create(config.sqlitePath);
  if (config.persistenceBackend === "memory") return new InMemoryAiUsageRepository();
  if (["postgres", "postgresql"].includes(config.persistenceBackend)) {
    return PostgresAiUsageRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    });
  }
  throw new Error(`Unsupported AI Usage persistence backend: ${config.persistenceBackend}`);
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryAiUsageRepository,
  PostgresAiUsageRepository,
  SqliteBackedAiUsageRepository,
  AiUsageService,
  createDefaultAiUsageServer,
};
