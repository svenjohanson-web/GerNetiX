const { AuthService } = require("./services/auth-service");
const { MockEmailService } = require("./services/mock-email-service");
const { InMemoryIdentityRepository } = require("./repositories/in-memory-identity-repository");
const { SqliteBackedIdentityRepository } = require("./repositories/sqlite-backed-identity-repository");
const {
  MockGoogleProvider,
  MockAppleProvider,
  MockMicrosoftProvider,
  MockGitHubProvider,
} = require("./providers/mock-auth-providers");

function createDefaultIdentityModule(options = {}) {
  const repository = options.repository || createRepository(options);
  if (repository && typeof repository.then === "function") {
    return repository.then((resolvedRepository) => createAuthService(options, resolvedRepository));
  }
  return createAuthService(options, repository);
}

function createAuthService(options, repository) {
  const emailService = options.emailService || new MockEmailService();
  const providers = options.providers || [
    new MockGoogleProvider(),
    new MockAppleProvider(),
    new MockMicrosoftProvider(),
    new MockGitHubProvider(),
  ];

  return new AuthService({
    repository,
    emailService,
    providers,
    appBaseUrl: options.appBaseUrl,
  });
}

function createRepository(options) {
  const backend = options.persistenceBackend || process.env.PERSISTENCE_BACKEND || process.env.IDENTITY_PERSISTENCE_BACKEND;
  if (backend === "sqlite") {
    return SqliteBackedIdentityRepository.create(options.sqlitePath || process.env.PERSISTENCE_SQLITE_PATH || process.env.IDENTITY_SQLITE_PATH || ".runtime/gernetix-services.sqlite");
  }
  if (backend === "postgres" || backend === "postgresql") {
    const { PostgresIdentityRepository } = require("./repositories/postgres-identity-repository");
    return PostgresIdentityRepository.create({
      poolOptions: options.postgres?.connectionString
        ? { connectionString: options.postgres.connectionString }
        : options.postgres,
    });
  }
  return new InMemoryIdentityRepository();
}

module.exports = {
  AuthService,
  InMemoryIdentityRepository,
  SqliteBackedIdentityRepository,
  MockEmailService,
  MockGoogleProvider,
  MockAppleProvider,
  MockMicrosoftProvider,
  MockGitHubProvider,
  createDefaultIdentityModule,
};
