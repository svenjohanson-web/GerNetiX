const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { PersistenceService } = require("./persistence-service");

function createDefaultPersistenceServer(config = createConfig()) {
  return new PersistenceService({ dbPath: config.dbPath });
}

module.exports = {
  createConfig,
  createHttpApp,
  PersistenceService,
  createDefaultPersistenceServer,
};
