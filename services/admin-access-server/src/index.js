const { createConfig } = require("./config");
const { AdminAccessRepository } = require("./admin-access-repository");
const { AdminAccessService } = require("./admin-access-service");
const { createHttpApp } = require("./http-app");

function createDefaultAdminAccessServer(config = createConfig()) {
  const repository = AdminAccessRepository.create(config.sqlitePath);
  const service = new AdminAccessService({ repository, config });
  return { repository, service, config };
}
module.exports = { createConfig, AdminAccessRepository, AdminAccessService, createHttpApp, createDefaultAdminAccessServer };
