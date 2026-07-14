const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryAiContextRepository } = require("./repositories/in-memory-ai-context-repository");
const { SqliteBackedAiContextRepository } = require("./repositories/sqlite-backed-ai-context-repository");
const { PostgresAiContextRepository } = require("./repositories/postgres-ai-context-repository");
const { OllamaEmbeddingClient } = require("./embeddings/ollama-embedding-client");
const { AiContextService } = require("./services/ai-context-service");
const fs = require("node:fs");

async function createDefaultAiContextServer(config = createConfig()) {
  return new AiContextService({
    repository: await createRepository(config),
  });
}

async function createRepository(config) {
  if (config.persistenceBackend === "postgres" || config.persistenceBackend === "postgresql") {
    const repository = await PostgresAiContextRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
      dimensions:config.embeddingDimensions,
      embeddingClient:new OllamaEmbeddingClient({baseUrl:config.embeddingBaseUrl,model:config.embeddingModel,dimensions:config.embeddingDimensions}),
    });
    await migrateLegacySqlite(repository, config.sqlitePath);
    return repository;
  }
  if (config.persistenceBackend === "sqlite") return SqliteBackedAiContextRepository.create(config.sqlitePath);
  return new InMemoryAiContextRepository();
}

async function migrateLegacySqlite(repository, sqlitePath) {
  const migrationId = "ai-context-sqlite-v1";
  if (!sqlitePath || !fs.existsSync(sqlitePath) || await repository.hasMigration(migrationId)) return;
  const legacy = SqliteBackedAiContextRepository.create(sqlitePath);
  await repository.importLegacy(legacy);
  await repository.markMigration(migrationId);
}

module.exports = {
  createConfig,
  createHttpApp,
  InMemoryAiContextRepository,
  SqliteBackedAiContextRepository,
  PostgresAiContextRepository,
  OllamaEmbeddingClient,
  AiContextService,
  createDefaultAiContextServer,
};
