const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqlitePublicDemoRepository } = require("./repositories/sqlite-public-demo-repository");
const { PublicDemoService } = require("./services/public-demo-service");

function createDefaultPublicDemoService(config = createConfig()) {
  return new PublicDemoService({ repository: new SqlitePublicDemoRepository(config.sqlitePath) });
}

module.exports = {
  createConfig,
  createHttpApp,
  SqlitePublicDemoRepository,
  PublicDemoService,
  createDefaultPublicDemoService,
};
