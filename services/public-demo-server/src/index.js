const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqlitePublicDemoRepository } = require("./repositories/sqlite-public-demo-repository");
const { PostgresPublicDemoRepository } = require("./repositories/postgres-public-demo-repository");
const { PublicDemoService } = require("./services/public-demo-service");

function createDefaultPublicDemoService(config = createConfig()) {
  if (config.persistenceBackend === "postgres") {
    return PostgresPublicDemoRepository.create({
      poolOptions: config.postgres.connectionString ? { connectionString: config.postgres.connectionString } : config.postgres,
    }).then((repository) => new PublicDemoService({ repository }));
  }
  return new PublicDemoService({ repository: new SqlitePublicDemoRepository(config.sqlitePath) });
}

module.exports = {
  createConfig,
  createHttpApp,
  SqlitePublicDemoRepository,
  PostgresPublicDemoRepository,
  PublicDemoService,
  createDefaultPublicDemoService,
};
