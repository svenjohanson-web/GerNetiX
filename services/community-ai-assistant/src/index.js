const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { CommunityPlatformClient, AiUsageClient } = require("./clients/http-clients");
const { InMemoryCommunityAiRepository } = require("./repositories/in-memory-community-ai-repository");
const { SqliteBackedCommunityAiRepository } = require("./repositories/sqlite-backed-community-ai-repository");
const { CommunityAiService } = require("./services/community-ai-service");

function createDefaultCommunityAiAssistant(config = createConfig()) {
  return new CommunityAiService({
    repository: createRepository(config),
    communityClient: new CommunityPlatformClient(config.communityBaseUrl),
    aiUsageClient: new AiUsageClient(config.aiUsageBaseUrl),
    defaultModel: config.defaultModel,
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedCommunityAiRepository.create(config.sqlitePath);
  return new InMemoryCommunityAiRepository();
}

module.exports = {
  createConfig,
  createHttpApp,
  CommunityPlatformClient,
  AiUsageClient,
  InMemoryCommunityAiRepository,
  SqliteBackedCommunityAiRepository,
  CommunityAiService,
  createDefaultCommunityAiAssistant,
};
