const { SqliteStateStore } = require("../../../shared");
const { InMemoryIdentityRepository } = require("./in-memory-identity-repository");

class SqliteBackedIdentityRepository extends InMemoryIdentityRepository {
  constructor(store, clock = () => new Date()) {
    super(clock, store.load());
    this.store = store;
    this.store.ensureSchema?.(identitySchema());
  }

  static create(sqlitePath, clock = () => new Date()) {
    return new SqliteBackedIdentityRepository(new SqliteStateStore(sqlitePath, "identity-server", {
      defaultState: emptyState(),
      collectionMap: {
        userAccounts: "user_accounts",
        localCredentials: "local_credentials",
        externalIdentities: "external_identities",
        verificationTokens: "verification_tokens",
        passwordResetTokens: "password_reset_tokens",
        sessions: "sessions",
      },
    }), clock);
  }

  createUserAccount(input) { const result = super.createUserAccount(input); this.persist(); return result; }
  updateUserAccount(userId, patch) { const result = super.updateUserAccount(userId, patch); this.persist(); return result; }
  createLocalCredential(input) { const result = super.createLocalCredential(input); this.persist(); return result; }
  updateLocalCredential(userId, patch) { const result = super.updateLocalCredential(userId, patch); this.persist(); return result; }
  createExternalIdentity(input) { const result = super.createExternalIdentity(input); this.persist(); return result; }
  touchExternalIdentity(identityId) { const result = super.touchExternalIdentity(identityId); this.persist(); return result; }
  createVerificationToken(token) { const result = super.createVerificationToken(token); this.persist(); return result; }
  markVerificationTokenUsed(tokenId) { const result = super.markVerificationTokenUsed(tokenId); this.persist(); return result; }
  createPasswordResetToken(token) { const result = super.createPasswordResetToken(token); this.persist(); return result; }
  markPasswordResetTokenUsed(tokenId) { const result = super.markPasswordResetTokenUsed(tokenId); this.persist(); return result; }
  createSession(input) { const result = super.createSession(input); this.persist(); return result; }
  revokeSession(sessionId) { const result = super.revokeSession(sessionId); this.persist(); return result; }

  persist() {
    const state = {
      userAccounts: Array.from(this.userAccounts.values()),
      localCredentials: Array.from(this.localCredentials.values()),
      externalIdentities: Array.from(this.externalIdentities.values()),
      verificationTokens: Array.from(this.verificationTokens.values()),
      passwordResetTokens: Array.from(this.passwordResetTokens.values()),
      sessions: Array.from(this.sessions.values()),
    };
    this.store.save(state);
    this.store.replaceCollection?.("user_accounts", state.userAccounts, "id");
    this.store.replaceCollection?.("local_credentials", state.localCredentials, "id");
    this.store.replaceCollection?.("external_identities", state.externalIdentities, "id");
    this.store.replaceCollection?.("verification_tokens", state.verificationTokens, "id");
    this.store.replaceCollection?.("password_reset_tokens", state.passwordResetTokens, "id");
    this.store.replaceCollection?.("sessions", state.sessions, "id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("identity_user_accounts", state.userAccounts, identityColumns([
        "id", "username", "email", "status", "created_at", "updated_at",
      ]));
      this.store.replaceTable("identity_local_credentials", state.localCredentials, identityColumns([
        "id", "user_id", "password_hash", "created_at", "updated_at",
      ]));
      this.store.replaceTable("identity_external_identities", state.externalIdentities, identityColumns([
        "id", "user_id", "provider", "provider_user_id", "provider_email", "linked_at", "last_login_at",
      ]));
      this.store.replaceTable("identity_verification_tokens", state.verificationTokens, identityColumns([
        "id", "user_id", "token_hash", "expires_at", "used_at", "created_at",
      ]));
      this.store.replaceTable("identity_password_reset_tokens", state.passwordResetTokens, identityColumns([
        "id", "user_id", "token_hash", "expires_at", "used_at", "created_at",
      ]));
      this.store.replaceTable("identity_sessions", state.sessions, identityColumns([
        "id", "user_id", "token_hash", "jwt_id", "expires_at", "revoked_at", "created_at",
      ]));
    }
  }
}

function identitySchema() {
  return [
    `CREATE TABLE IF NOT EXISTS identity_user_accounts (id TEXT PRIMARY KEY, username TEXT, email TEXT, status TEXT, created_at TEXT, updated_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS identity_local_credentials (id TEXT PRIMARY KEY, user_id TEXT, password_hash TEXT, created_at TEXT, updated_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS identity_external_identities (id TEXT PRIMARY KEY, user_id TEXT, provider TEXT, provider_user_id TEXT, provider_email TEXT, linked_at TEXT, last_login_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS identity_verification_tokens (id TEXT PRIMARY KEY, user_id TEXT, token_hash TEXT, expires_at TEXT, used_at TEXT, created_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS identity_password_reset_tokens (id TEXT PRIMARY KEY, user_id TEXT, token_hash TEXT, expires_at TEXT, used_at TEXT, created_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS identity_sessions (id TEXT PRIMARY KEY, user_id TEXT, token_hash TEXT, jwt_id TEXT, expires_at TEXT, revoked_at TEXT, created_at TEXT);`,
  ];
}

function identityColumns(names) {
  return Object.fromEntries(names.map((name) => [name, name]));
}

function emptyState() {
  return {
    userAccounts: [],
    localCredentials: [],
    externalIdentities: [],
    verificationTokens: [],
    passwordResetTokens: [],
    sessions: [],
  };
}

module.exports = { SqliteBackedIdentityRepository };
