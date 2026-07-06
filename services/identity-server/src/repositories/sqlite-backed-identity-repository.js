const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryIdentityRepository } = require("./in-memory-identity-repository");

class SqliteBackedIdentityRepository extends InMemoryIdentityRepository {
  constructor(store, clock = () => new Date()) {
    super(clock, store.load());
    this.store = store;
  }

  static create(sqlitePath, clock = () => new Date()) {
    return new SqliteBackedIdentityRepository(new SqliteSnapshotStore(sqlitePath, "identity-server", {
      defaultState: emptyState(),
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
    this.store.save({
      userAccounts: Array.from(this.userAccounts.values()),
      localCredentials: Array.from(this.localCredentials.values()),
      externalIdentities: Array.from(this.externalIdentities.values()),
      verificationTokens: Array.from(this.verificationTokens.values()),
      passwordResetTokens: Array.from(this.passwordResetTokens.values()),
      sessions: Array.from(this.sessions.values()),
    });
  }
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
