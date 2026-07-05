const { AuthService } = require("./services/auth-service");
const { MockEmailService } = require("./services/mock-email-service");
const { InMemoryIdentityRepository } = require("./repositories/in-memory-identity-repository");
const {
  MockGoogleProvider,
  MockAppleProvider,
  MockMicrosoftProvider,
  MockGitHubProvider,
} = require("./providers/mock-auth-providers");

function createDefaultIdentityModule(options = {}) {
  const repository = options.repository || new InMemoryIdentityRepository();
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

module.exports = {
  AuthService,
  InMemoryIdentityRepository,
  MockEmailService,
  MockGoogleProvider,
  MockAppleProvider,
  MockMicrosoftProvider,
  MockGitHubProvider,
  createDefaultIdentityModule,
};
