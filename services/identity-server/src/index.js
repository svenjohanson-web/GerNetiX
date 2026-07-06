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
  if ((options.persistenceBackend || process.env.PERSISTENCE_BACKEND || process.env.IDENTITY_PERSISTENCE_BACKEND) === "sqlite") {
    return SqliteBackedIdentityRepository.create(options.sqlitePath || process.env.PERSISTENCE_SQLITE_PATH || process.env.IDENTITY_SQLITE_PATH || ".runtime/gernetix-services.sqlite");
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
