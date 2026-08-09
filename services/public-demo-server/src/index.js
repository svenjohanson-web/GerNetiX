const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { PostgresPublicDemoRepository } = require("./repositories/postgres-public-demo-repository");
const { PublicDemoService } = require("./services/public-demo-service");
const { ContentAddressedArtifactStore } = require("../../shared");

function createDefaultPublicDemoService(config = createConfig()) {
  return PostgresPublicDemoRepository.create({
    poolOptions: config.postgres.connectionString ? { connectionString: config.postgres.connectionString } : config.postgres,
    artifactStore: new ContentAddressedArtifactStore(config.artifactDir),
  }).then((repository) => new PublicDemoService({ repository }));
}

module.exports = {
  createConfig,
  createHttpApp,
  PostgresPublicDemoRepository,
  PublicDemoService,
  createDefaultPublicDemoService,
};
