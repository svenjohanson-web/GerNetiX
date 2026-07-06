function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5300),
    communityBaseUrl: env.COMMUNITY_BASE_URL || "http://127.0.0.1:5200/api/community",
    aiUsageBaseUrl: env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000/api/ai-usage",
    useLiveIntegrations: env.USE_LIVE_INTEGRATIONS !== "false",
    defaultModel: env.COMMUNITY_AI_MODEL || "gpt-4.1-mini",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.COMMUNITY_AI_PERSISTENCE_BACKEND || "memory",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.COMMUNITY_AI_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
  };
}

module.exports = { createConfig };
