const { createConfig } = require("./config");
const { AdminAccessRepository } = require("./admin-access-repository");
const { PostgresAdminAccessRepository } = require("./postgres-admin-access-repository");
const { AdminAccessService } = require("./admin-access-service");
const { createHttpApp } = require("./http-app");

async function createDefaultAdminAccessServer(config = createConfig()) {
  const repository = config.persistenceBackend === "postgres"
    ? await PostgresAdminAccessRepository.create({
      poolOptions: config.postgres.connectionString
        ? { connectionString: config.postgres.connectionString }
        : config.postgres,
    })
    : AdminAccessRepository.create(config.sqlitePath);
  const service = new AdminAccessService({ repository, config });
  return { repository, service, config };
}
module.exports = { createConfig, AdminAccessRepository, PostgresAdminAccessRepository, AdminAccessService, createHttpApp, createDefaultAdminAccessServer };
