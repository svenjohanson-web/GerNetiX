const path = require("node:path");

function createConfig(env = process.env) {
  return {
    host: env.HOST || env.AI_CONTEXT_HOST || "127.0.0.1",
    port: Number(env.PORT || env.AI_CONTEXT_PORT || 5500),
    persistenceBackend: env.PERSISTENCE_BACKEND || env.AI_CONTEXT_PERSISTENCE_BACKEND || "sqlite",
    sqlitePath: env.AI_CONTEXT_SQLITE_PATH || path.join(__dirname, "..", "..", "..", ".runtime", "gernetix-ai-context.sqlite"),
  };
}

module.exports = { createConfig };
