const crypto = require("node:crypto");

class InMemoryIdentityRepository {
  constructor(clock = () => new Date(), seed = {}) {
    this.clock = clock;
    this.userAccounts = new Map((seed.userAccounts || []).map((item) => [item.id, clone(item)]));
    this.localCredentials = new Map((seed.localCredentials || []).map((item) => [item.user_id, clone(item)]));
    this.externalIdentities = new Map((seed.externalIdentities || []).map((item) => [item.id, clone(item)]));
    this.verificationTokens = new Map((seed.verificationTokens || []).map((item) => [item.id, clone(item)]));
    this.passwordResetTokens = new Map((seed.passwordResetTokens || []).map((item) => [item.id, clone(item)]));
    this.sessions = new Map((seed.sessions || []).map((item) => [item.id, clone(item)]));
    this.usernameIndex = new Map();
    this.emailIndex = new Map();
    this.externalIdentityIndex = new Map();
    this.verificationTokenIndex = new Map();
    this.passwordResetTokenIndex = new Map();
    this.sessionTokenIndex = new Map();
    this.rebuildIndexes();
  }

  rebuildIndexes() {
    for (const account of this.userAccounts.values()) {
      this.usernameIndex.set(normalizeUsername(account.username), account.id);
      this.emailIndex.set(normalizeEmail(account.email), account.id);
    }
    for (const identity of this.externalIdentities.values()) {
      this.externalIdentityIndex.set(externalKey(identity.provider, identity.provider_user_id), identity.id);
    }
    for (const token of this.verificationTokens.values()) this.verificationTokenIndex.set(token.token_hash, token.id);
    for (const token of this.passwordResetTokens.values()) this.passwordResetTokenIndex.set(token.token_hash, token.id);
    for (const session of this.sessions.values()) this.sessionTokenIndex.set(session.token_hash, session.id);
  }

  nowIso() {
    return this.clock().toISOString();
  }

  createUserAccount({ id, username, email, status }) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    if (this.usernameIndex.has(normalizedUsername)) {
      throw new Error("USERNAME_ALREADY_EXISTS");
    }
    if (this.emailIndex.has(normalizedEmail)) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    const now = this.nowIso();
    const accountId = String(id || "").trim() || createId("usr");
    if (this.userAccounts.has(accountId)) {
      throw new Error("USER_ID_ALREADY_EXISTS");
    }
    const account = {
      id: accountId,
      username,
      email: normalizedEmail,
      status,
      created_at: now,
      updated_at: now,
    };

    this.userAccounts.set(account.id, account);
    this.usernameIndex.set(normalizedUsername, account.id);
    this.emailIndex.set(normalizedEmail, account.id);
    return { ...account };
  }

  updateUserAccount(userId, patch) {
    const current = this.userAccounts.get(userId);
    if (!current) return null;
    const next = { ...current, ...patch, updated_at: this.nowIso() };
    this.userAccounts.set(userId, next);
    return { ...next };
  }

  findUserById(userId) {
    return clone(this.userAccounts.get(userId));
  }

  findUserByUsername(username) {
    const id = this.usernameIndex.get(normalizeUsername(username));
    return id ? this.findUserById(id) : null;
  }

  findUserByEmail(email) {
    const id = this.emailIndex.get(normalizeEmail(email));
    return id ? this.findUserById(id) : null;
  }

  usernameExists(username) {
    return this.usernameIndex.has(normalizeUsername(username));
  }

  createLocalCredential({ userId, passwordHash }) {
    const now = this.nowIso();
    const credential = {
      id: createId("lcr"),
      user_id: userId,
      password_hash: passwordHash,
      created_at: now,
      updated_at: now,
    };
    this.localCredentials.set(userId, credential);
    return { ...credential };
  }

  findLocalCredentialByUserId(userId) {
    return clone(this.localCredentials.get(userId));
  }

  updateLocalCredential(userId, patch) {
    const current = this.localCredentials.get(userId);
    if (!current) return null;
    const next = { ...current, ...patch, updated_at: this.nowIso() };
    this.localCredentials.set(userId, next);
    return { ...next };
  }

  createExternalIdentity({ userId, provider, providerUserId, providerEmail }) {
    const key = externalKey(provider, providerUserId);
    if (this.externalIdentityIndex.has(key)) {
      throw new Error("EXTERNAL_IDENTITY_ALREADY_EXISTS");
    }

    const now = this.nowIso();
    const identity = {
      id: createId("eid"),
      user_id: userId,
      provider,
      provider_user_id: providerUserId,
      provider_email: normalizeEmail(providerEmail),
      linked_at: now,
      last_login_at: now,
    };

    this.externalIdentities.set(identity.id, identity);
    this.externalIdentityIndex.set(key, identity.id);
    return { ...identity };
  }

  findExternalIdentity(provider, providerUserId) {
    const id = this.externalIdentityIndex.get(externalKey(provider, providerUserId));
    return id ? clone(this.externalIdentities.get(id)) : null;
  }

  touchExternalIdentity(identityId) {
    const current = this.externalIdentities.get(identityId);
    if (!current) return null;
    const next = { ...current, last_login_at: this.nowIso() };
    this.externalIdentities.set(identityId, next);
    return { ...next };
  }

  createVerificationToken(token) {
    const record = { id: createId("vft"), ...token };
    this.verificationTokens.set(record.id, record);
    this.verificationTokenIndex.set(record.token_hash, record.id);
    return { ...record };
  }

  findVerificationTokenByHash(tokenHash) {
    const id = this.verificationTokenIndex.get(tokenHash);
    return id ? clone(this.verificationTokens.get(id)) : null;
  }

  markVerificationTokenUsed(tokenId) {
    const current = this.verificationTokens.get(tokenId);
    if (!current) return null;
    const next = { ...current, used_at: this.nowIso() };
    this.verificationTokens.set(tokenId, next);
    return { ...next };
  }

  createPasswordResetToken(token) {
    const record = { id: createId("prt"), ...token };
    this.passwordResetTokens.set(record.id, record);
    this.passwordResetTokenIndex.set(record.token_hash, record.id);
    return { ...record };
  }

  findPasswordResetTokenByHash(tokenHash) {
    const id = this.passwordResetTokenIndex.get(tokenHash);
    return id ? clone(this.passwordResetTokens.get(id)) : null;
  }

  markPasswordResetTokenUsed(tokenId) {
    const current = this.passwordResetTokens.get(tokenId);
    if (!current) return null;
    const next = { ...current, used_at: this.nowIso() };
    this.passwordResetTokens.set(tokenId, next);
    return { ...next };
  }

  createSession({ userId, tokenHash, expiresAt, jwtId = null }) {
    const now = this.nowIso();
    const session = {
      id: createId("ses"),
      user_id: userId,
      token_hash: tokenHash,
      jwt_id: jwtId,
      expires_at: expiresAt,
      revoked_at: null,
      created_at: now,
    };
    this.sessions.set(session.id, session);
    this.sessionTokenIndex.set(tokenHash, session.id);
    return { ...session };
  }

  findSessionById(sessionId) {
    return clone(this.sessions.get(sessionId));
  }

  findSessionByTokenHash(tokenHash) {
    const id = this.sessionTokenIndex.get(tokenHash);
    return id ? this.findSessionById(id) : null;
  }

  revokeSession(sessionId) {
    const current = this.sessions.get(sessionId);
    if (!current) return null;
    const next = { ...current, revoked_at: this.nowIso() };
    this.sessions.set(sessionId, next);
    return { ...next };
  }
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function externalKey(provider, providerUserId) {
  return `${provider}:${providerUserId}`;
}

function clone(value) {
  return value ? { ...value } : null;
}

module.exports = { InMemoryIdentityRepository };
