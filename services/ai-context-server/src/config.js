const path = require("node:path");

function createConfig(env = process.env) {
  return {
    host: env.HOST || env.AI_CONTEXT_HOST || "127.0.0.1",
    port: Number(env.PORT || env.AI_CONTEXT_PORT || 5500),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.AI_CONTEXT_PERSISTENCE_BACKEND || "sqlite",
    sqlitePath: env.AI_CONTEXT_SQLITE_PATH || path.join(__dirname, "..", "..", "..", ".runtime", "gernetix-ai-context.sqlite"),
    postgres: {
      connectionString: env.AI_CONTEXT_POSTGRES_URL || env.DATABASE_URL || "",
      host: env.AI_CONTEXT_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.AI_CONTEXT_POSTGRES_PORT || 5432),
      database: env.AI_CONTEXT_POSTGRES_DATABASE || "gernetix_ai_context",
      user: env.AI_CONTEXT_POSTGRES_USER || "gernetix_ai_context",
      password: env.AI_CONTEXT_POSTGRES_PASSWORD || "gernetix-dev-only",
    },
    embeddingBaseUrl: env.AI_CONTEXT_EMBEDDING_BASE_URL || env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    embeddingModel: env.AI_CONTEXT_EMBEDDING_MODEL || "embeddinggemma",
    embeddingDimensions: Number(env.AI_CONTEXT_EMBEDDING_DIMENSIONS || 768),
  };
}

module.exports = { createConfig };
