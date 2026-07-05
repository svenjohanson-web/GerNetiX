const { AuthProvider } = require("./auth-provider");

const SUPPORTED_PROVIDERS = new Set(["google", "apple", "microsoft", "github"]);

class MockAuthProvider extends AuthProvider {
  constructor(providerName) {
    super(providerName);
  }

  async authenticate(providerTokenOrMockPayload) {
    const payload = normalizePayload(providerTokenOrMockPayload);
    if (payload.provider && payload.provider !== this.providerName) {
      throw new Error(`Mock payload provider '${payload.provider}' does not match '${this.providerName}'.`);
    }
    if (!payload.provider_user_id) {
      throw new Error("Mock provider payload requires provider_user_id.");
    }
    if (!payload.email) {
      throw new Error("Mock provider payload requires email.");
    }

    return {
      provider: this.providerName,
      provider_user_id: String(payload.provider_user_id),
      email: String(payload.email).trim().toLowerCase(),
      email_verified: Boolean(payload.email_verified),
      username: payload.username ? String(payload.username).trim() : null,
    };
  }
}

class MockGoogleProvider extends MockAuthProvider {
  constructor() {
    super("google");
  }
}

class MockAppleProvider extends MockAuthProvider {
  constructor() {
    super("apple");
  }
}

class MockMicrosoftProvider extends MockAuthProvider {
  constructor() {
    super("microsoft");
  }
}

class MockGitHubProvider extends MockAuthProvider {
  constructor() {
    super("github");
  }
}

function normalizePayload(payload) {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      throw new Error("Mock provider string payload must be valid JSON.");
    }
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Mock provider payload must be an object.");
  }
  if (payload.provider && !SUPPORTED_PROVIDERS.has(payload.provider)) {
    throw new Error(`Unsupported provider '${payload.provider}'.`);
  }
  return payload;
}

module.exports = {
  MockAuthProvider,
  MockGoogleProvider,
  MockAppleProvider,
  MockMicrosoftProvider,
  MockGitHubProvider,
};
