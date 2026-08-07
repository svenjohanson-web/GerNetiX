const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryAiContextRepository } = require("./repositories/in-memory-ai-context-repository");
const { SqliteBackedAiContextRepository } = require("./repositories/sqlite-backed-ai-context-repository");
const { PostgresAiContextRepository } = require("./repositories/postgres-ai-context-repository");
const { OllamaEmbeddingClient } = require("./embeddings/ollama-embedding-client");
const { OpenAiEmbeddingClient } = require("./embeddings/openai-embedding-client");
const { AiContextService } = require("./services/ai-context-service");
const fs = require("node:fs");

async function createDefaultAiContextServer(config = createConfig()) {
  return new AiContextService({
    repository: await createRepository(config),
  });
}

async function startAiContextBackgroundInitialization(service, logger = console) {
  if (typeof service?.repository?.backfillMissingEmbeddings !== "function") {
    return { completed:true, updated:0 };
  }
  try {
    const result = await service.repository.backfillMissingEmbeddings();
    if (!result.completed) {
      logger.warn(`AI Context Embedding-Backfill pausiert: ${result.reason}`);
    } else if (result.updated > 0) {
      logger.log(`AI Context Embedding-Backfill abgeschlossen: ${result.updated} Eintraege.`);
    }
    return result;
  } catch (error) {
    logger.warn(`AI Context Embedding-Backfill pausiert: ${error?.message || error}`);
    return {
      completed:false,
      updated:0,
      reason:error?.message || String(error),
    };
  }
}

async function createRepository(config) {
  if (config.persistenceBackend === "postgres" || config.persistenceBackend === "postgresql") {
    const repository = await PostgresAiContextRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
      dimensions:config.embeddingDimensions,
      embeddingClient:createEmbeddingClient(config),
    });
    await migrateLegacySqlite(repository, config.sqlitePath);
    return repository;
  }
  if (config.persistenceBackend === "sqlite") return SqliteBackedAiContextRepository.create(config.sqlitePath);
  return new InMemoryAiContextRepository();
}

function createEmbeddingClient(config) {
  if (config.embeddingProvider === "ollama") {
    return new OllamaEmbeddingClient({ baseUrl:config.embeddingBaseUrl, model:config.embeddingModel, dimensions:config.embeddingDimensions });
  }
  if (!config.embeddingApiKey) return null;
  return new OpenAiEmbeddingClient({ baseUrl:config.embeddingBaseUrl, model:config.embeddingModel, dimensions:config.embeddingDimensions, apiKey:config.embeddingApiKey });
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
  OpenAiEmbeddingClient,
  AiContextService,
  createDefaultAiContextServer,
  startAiContextBackgroundInitialization,
};
