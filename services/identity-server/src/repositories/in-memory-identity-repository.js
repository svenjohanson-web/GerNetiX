const crypto = require("node:crypto");

class InMemoryIdentityRepository {
  constructor(clock = () => new Date(), seed = {}) {
    this.clock = clock;
    this.userAccounts = new Map((seed.userAccounts || []).map((item) => [item.id, clone(item)]));
    this.localCredentials = new Map((seed.localCredentials || []).map((item) => [item.user_id, clone(item)]));
    this.externalIdentities = new Map((seed.externalIdentities || []).map((item) => [item.id, clone(item)]));
    this.verificationTokens = new Map((seed.verificationTokens || []).map((item) => [item.id, clone(item)]));
    this.passwordResetTokens = new Map((seed.passwordResetTokens || []).map((item) => [item.id, clone(item)]));
    this.offlineRecoveryTransactions = new Map((seed.offlineRecoveryTransactions || []).map((item) => [item.id, clone(item)]));
    this.sessions = new Map((seed.sessions || []).map((item) => [item.id, clone(item)]));
    this.knowledgeChapterReads = new Map((seed.knowledgeChapterReads || []).map((item) => [knowledgeReadKey(item.account_id, item.chapter_id), clone(item)]));
    this.usernameIndex = new Map();
    this.emailIndex = new Map();
    this.externalIdentityIndex = new Map();
    this.verificationTokenIndex = new Map();
    this.passwordResetTokenIndex = new Map();
    this.offlineRecoveryTransactionIndex = new Map();
    this.sessionTokenIndex = new Map();
    this.rebuildIndexes();
  }

  rebuildIndexes() {
    for (const account of this.userAccounts.values()) {
      this.usernameIndex.set(normalizeUsername(account.username), account.id);
      if (account.email) this.emailIndex.set(normalizeEmail(account.email), account.id);
    }
    for (const identity of this.externalIdentities.values()) {
      this.externalIdentityIndex.set(externalKey(identity.provider, identity.provider_user_id), identity.id);
    }
    for (const token of this.verificationTokens.values()) this.verificationTokenIndex.set(token.token_hash, token.id);
    for (const token of this.passwordResetTokens.values()) this.passwordResetTokenIndex.set(token.token_hash, token.id);
    for (const token of this.offlineRecoveryTransactions.values()) this.offlineRecoveryTransactionIndex.set(token.token_hash, token.id);
    for (const session of this.sessions.values()) this.sessionTokenIndex.set(session.token_hash, session.id);
  }

  nowIso() {
    return this.clock().toISOString();
  }

  createUserAccount({ id, username, email, status, accountType = "email_account", guestExpiresAt = null, passkeyCredentialId = null, passkeyPublicKey = null, passkeyCounter = 0, passkeyTransports = [], offlineRecoverySetConfirmedAt = null, offlineRecoverySetHash = null, recoveryBoardIds = [], preferredLocale = "de", welcomeGuideDisabled = false, subscriptionPlan = "free", planValidUntil = null, lifecycleState = "active" }) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = email ? normalizeEmail(email) : null;

    if (this.usernameIndex.has(normalizedUsername)) {
      throw new Error("USERNAME_ALREADY_EXISTS");
    }
    if (normalizedEmail && this.emailIndex.has(normalizedEmail)) {
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
      account_type: accountType,
      guest_expires_at: guestExpiresAt,
      passkey_credential_id: passkeyCredentialId,
      passkey_public_key: passkeyPublicKey,
      passkey_counter: passkeyCounter,
      passkey_transports: [...passkeyTransports],
      offline_recovery_set_confirmed_at: offlineRecoverySetConfirmedAt,
      offline_recovery_set_hash: offlineRecoverySetHash,
      recovery_board_ids: [...recoveryBoardIds],
      preferred_locale: preferredLocale,
      welcome_guide_disabled: Boolean(welcomeGuideDisabled),
      subscription_plan: subscriptionPlan,
      plan_valid_until: planValidUntil,
      last_meaningful_activity_at: now,
      lifecycle_state: lifecycleState,
      lifecycle_state_changed_at: now,
      grace_until: null,
      cold_archive_at: null,
      delete_after: null,
      created_at: now,
      updated_at: now,
    };

    this.userAccounts.set(account.id, account);
    this.usernameIndex.set(normalizedUsername, account.id);
    if (normalizedEmail) this.emailIndex.set(normalizedEmail, account.id);
    return { ...account };
  }

  updateUserAccount(userId, patch) {
    const current = this.userAccounts.get(userId);
    if (!current) return null;
    if (patch.username && normalizeUsername(patch.username) !== normalizeUsername(current.username)) {
      const nextUsername = normalizeUsername(patch.username);
      if (this.usernameIndex.has(nextUsername)) throw new Error("USERNAME_ALREADY_EXISTS");
      this.usernameIndex.delete(normalizeUsername(current.username));
      this.usernameIndex.set(nextUsername, userId);
    }
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

  findUserByPasskeyCredentialId(credentialId) {
    const expected = String(credentialId || "").trim();
    if (!expected) return null;
    for (const account of this.userAccounts.values()) {
      if (account.passkey_credential_id === expected) return clone(account);
    }
    return null;
  }

  findUserByEmail(email) {
    if (!email) return null;
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

  createOfflineRecoveryTransaction(token) {
    const record = { id: createId("ort"), ...token };
    this.offlineRecoveryTransactions.set(record.id, record);
    this.offlineRecoveryTransactionIndex.set(record.token_hash, record.id);
    return { ...record };
  }

  findOfflineRecoveryTransactionByHash(tokenHash) {
    const id = this.offlineRecoveryTransactionIndex.get(tokenHash);
    return id ? clone(this.offlineRecoveryTransactions.get(id)) : null;
  }

  markOfflineRecoveryTransactionUsed(tokenId) {
    const current = this.offlineRecoveryTransactions.get(tokenId);
    if (!current) return null;
    const next = { ...current, used_at: this.nowIso() };
    this.offlineRecoveryTransactions.set(tokenId, next);
    return { ...next };
  }

  createSession({ userId, tokenHash, expiresAt, jwtId = null, status = "active", pendingExpiresAt = null }) {
    const now = this.nowIso();
    const session = {
      id: createId("ses"),
      user_id: userId,
      token_hash: tokenHash,
      jwt_id: jwtId,
      expires_at: expiresAt,
      status,
      pending_expires_at: pendingExpiresAt,
      revoked_at: null,
      revoked_reason: null,
      replaced_by_session_id: null,
      created_at: now,
    };
    this.sessions.set(session.id, session);
    this.sessionTokenIndex.set(tokenHash, session.id);
    return { ...session };
  }

  createLoginSession(input) {
    const active = Array.from(this.sessions.values()).find((session) => (
      session.user_id === input.userId && isActiveSession(session, this.clock())
    ));
    for (const session of this.sessions.values()) {
      if (session.user_id === input.userId && session.status === "pending" && !session.revoked_at) {
        this.revokeSession(session.id, "superseded_pending_login");
      }
    }
    return this.createSession({
      ...input,
      status: active ? "pending" : "active",
      pendingExpiresAt: active ? input.pendingExpiresAt : null,
    });
  }

  findSessionById(sessionId) {
    return clone(this.sessions.get(sessionId));
  }

  findSessionByTokenHash(tokenHash) {
    const id = this.sessionTokenIndex.get(tokenHash);
    return id ? this.findSessionById(id) : null;
  }

  revokeSession(sessionId, reason = "logout", replacedBySessionId = null) {
    const current = this.sessions.get(sessionId);
    if (!current) return null;
    const next = {
      ...current,
      status: "revoked",
      revoked_at: this.nowIso(),
      revoked_reason: reason,
      replaced_by_session_id: replacedBySessionId,
    };
    this.sessions.set(sessionId, next);
    return { ...next };
  }

  activatePendingSessionByTokenHash(tokenHash) {
    const pending = this.findSessionByTokenHash(tokenHash);
    if (!isUsablePendingSession(pending, this.clock())) return null;
    for (const session of this.sessions.values()) {
      if (session.user_id !== pending.user_id || session.id === pending.id || !isActiveSession(session, this.clock())) continue;
      this.revokeSession(session.id, "replaced", pending.id);
    }
    const activated = {
      ...pending,
      status: "active",
      pending_expires_at: null,
      activated_at: this.nowIso(),
    };
    this.sessions.set(activated.id, activated);
    return { ...activated, replaced_session: true };
  }

  cancelPendingSessionByTokenHash(tokenHash) {
    const pending = this.findSessionByTokenHash(tokenHash);
    if (!isUsablePendingSession(pending, this.clock())) return null;
    return this.revokeSession(pending.id, "cancelled_pending_login");
  }

  secureAccountByPendingTokenHash(tokenHash) {
    const pending = this.findSessionByTokenHash(tokenHash);
    if (!isUsablePendingSession(pending, this.clock())) return null;
    let revoked = 0;
    for (const session of this.sessions.values()) {
      if (session.user_id !== pending.user_id || session.id === pending.id || session.revoked_at) continue;
      this.revokeSession(session.id, "account_security_requested", pending.id);
      revoked += 1;
    }
    const activated = {
      ...pending,
      status: "active",
      pending_expires_at: null,
      activated_at: this.nowIso(),
    };
    this.sessions.set(activated.id, activated);
    return { ...activated, revoked_sessions: revoked };
  }

  revokeSessionsByUserId(userId) {
    let revoked = 0;
    for (const session of this.sessions.values()) {
      if (session.user_id !== userId || session.revoked_at) continue;
      this.revokeSession(session.id);
      revoked += 1;
    }
    return revoked;
  }

  listKnowledgeChapterReads(accountId) {
    return Array.from(this.knowledgeChapterReads.values())
      .filter((read) => read.account_id === accountId)
      .map(clone);
  }

  markKnowledgeChapterRead(accountId, chapterId, chapterVersion) {
    const read = {
      account_id: String(accountId),
      chapter_id: String(chapterId),
      chapter_version: String(chapterVersion),
      seen_at: this.nowIso(),
    };
    this.knowledgeChapterReads.set(knowledgeReadKey(read.account_id, read.chapter_id), read);
    return clone(read);
  }
}

function isActiveSession(session, now = new Date()) {
  return Boolean(session && !session.revoked_at && session.status !== "pending" && new Date(session.expires_at).getTime() > now.getTime());
}

function isUsablePendingSession(session, now = new Date()) {
  return Boolean(session && !session.revoked_at && session.status === "pending" && new Date(session.pending_expires_at).getTime() > now.getTime());
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

function knowledgeReadKey(accountId, chapterId) {
  return `${accountId}:${chapterId}`;
}

function clone(value) {
  return value ? { ...value } : null;
}

module.exports = { InMemoryIdentityRepository };
