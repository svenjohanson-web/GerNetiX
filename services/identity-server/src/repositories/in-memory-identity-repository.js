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
    this.passkeyCredentials = new Map((seed.passkeyCredentials || []).map((item) => [item.credential_id, clone(item)]));
    this.supportRecoveryTransactions = new Map((seed.supportRecoveryTransactions || []).map((item) => [item.id, clone(item)]));
    this.notificationDeliveries = new Map((seed.notificationDeliveries || []).map((item) => [item.event_id, clone(item)]));
    this.sessions = new Map((seed.sessions || []).map((item) => [item.id, clone(item)]));
    this.knowledgeChapterReads = new Map((seed.knowledgeChapterReads || []).map((item) => [knowledgeReadKey(item.account_id, item.chapter_id), clone(item)]));
    this.usernameIndex = new Map();
    this.emailIndex = new Map();
    this.externalIdentityIndex = new Map();
    this.verificationTokenIndex = new Map();
    this.passwordResetTokenIndex = new Map();
    this.offlineRecoveryTransactionIndex = new Map();
    this.supportRecoveryGrantIndex = new Map();
    this.sessionTokenIndex = new Map();
    this.rebuildIndexes();
    this.migrateLegacyPasskeys();
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
    for (const transaction of this.supportRecoveryTransactions.values()) if (transaction.grant_token_hash) this.supportRecoveryGrantIndex.set(transaction.grant_token_hash, transaction.id);
    for (const session of this.sessions.values()) this.sessionTokenIndex.set(session.token_hash, session.id);
  }

  migrateLegacyPasskeys() {
    for (const account of this.userAccounts.values()) {
      if (!account.passkey_credential_id || this.passkeyCredentials.has(account.passkey_credential_id)) continue;
      this.passkeyCredentials.set(account.passkey_credential_id, {
        id: createId("pkc"), credential_id: account.passkey_credential_id, user_id: account.id,
        public_key: account.passkey_public_key, counter: Number(account.passkey_counter || 0),
        transports: [...(account.passkey_transports || [])], rp_id: account.passkey_rp_id || "legacy-unknown",
        label: "Legacy-Passkey", created_at: account.created_at || this.nowIso(), updated_at: account.updated_at || this.nowIso(), revoked_at: null,
      });
    }
  }

  nowIso() {
    return this.clock().toISOString();
  }

  createUserAccount({ id, username, email, status, accountType = "email_account", guestExpiresAt = null, passkeyCredentialId = null, passkeyPublicKey = null, passkeyCounter = 0, passkeyTransports = [], offlineRecoverySetConfirmedAt = null, offlineRecoverySetHash = null, recoveryBoardIds = [], preferredLocale = "de", welcomeGuideDisabled = false, subscriptionPlan = "free", planValidUntil = null, lifecycleState = "active", emailVerifiedAt = null }) {
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
      email_verified_at: emailVerifiedAt,
      email_contact_version: null,
      pending_email: null,
      pending_email_token_id: null,
      pending_email_requested_at: null,
      notification_preferences: defaultNotificationPreferences(),
      community_email_suppression: null,
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
    if (Object.hasOwn(patch, "email")) {
      const nextEmail = patch.email ? normalizeEmail(patch.email) : null;
      const currentEmail = current.email ? normalizeEmail(current.email) : null;
      const owner = nextEmail ? this.emailIndex.get(nextEmail) : null;
      if (owner && owner !== userId) throw new Error("EMAIL_ALREADY_EXISTS");
      if (currentEmail && currentEmail !== nextEmail) this.emailIndex.delete(currentEmail);
      if (nextEmail) this.emailIndex.set(nextEmail, userId);
      patch = { ...patch, email: nextEmail };
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
    const credential = this.findPasskeyCredentialById(credentialId);
    return credential ? this.findUserById(credential.user_id) : null;
  }

  createPasskeyCredential({ userId, credentialId, publicKey, counter = 0, transports = [], rpId, label = "Passkey" }) {
    const id = String(credentialId || "").trim();
    if (!id || this.passkeyCredentials.has(id)) throw new Error("PASSKEY_CREDENTIAL_ALREADY_EXISTS");
    const now = this.nowIso();
    const credential = { id: createId("pkc"), credential_id: id, user_id: userId, public_key: publicKey, counter: Number(counter || 0), transports: [...transports], rp_id: String(rpId || "").trim().toLowerCase(), label: String(label || "Passkey").slice(0, 80), created_at: now, updated_at: now, revoked_at: null };
    this.passkeyCredentials.set(id, credential);
    return clone(credential);
  }

  listPasskeyCredentials(userId, { includeRevoked = false } = {}) {
    return Array.from(this.passkeyCredentials.values()).filter((item) => item.user_id === userId && (includeRevoked || !item.revoked_at)).map(clone);
  }

  findPasskeyCredentialById(credentialId) {
    const item = this.passkeyCredentials.get(String(credentialId || "").trim());
    return item && !item.revoked_at ? clone(item) : null;
  }

  updatePasskeyCredentialCounter(credentialId, counter) {
    const current = this.passkeyCredentials.get(String(credentialId || "").trim());
    if (!current || current.revoked_at) return null;
    const next = { ...current, counter: Number(counter || 0), updated_at: this.nowIso() };
    this.passkeyCredentials.set(next.credential_id, next);
    return clone(next);
  }

  revokePasskeyCredentialsByUserId(userId, reason = "recovery_replaced", exceptCredentialId = "") {
    let revoked = 0;
    for (const [credentialId, item] of this.passkeyCredentials.entries()) {
      if (item.user_id !== userId || item.revoked_at || credentialId === exceptCredentialId) continue;
      this.passkeyCredentials.set(credentialId, { ...item, revoked_at: this.nowIso(), revoked_reason: reason, updated_at: this.nowIso() });
      revoked += 1;
    }
    return revoked;
  }

  findUserByEmail(email) {
    if (!email) return null;
    const id = this.emailIndex.get(normalizeEmail(email));
    return id ? this.findUserById(id) : null;
  }

  findNotificationDelivery(eventId) {
    return clone(this.notificationDeliveries.get(String(eventId || "")));
  }

  saveNotificationDelivery(delivery) {
    const current = this.notificationDeliveries.get(delivery.event_id);
    const next = { ...current, ...delivery, updated_at: this.nowIso() };
    this.notificationDeliveries.set(next.event_id, next);
    return clone(next);
  }

  purgeNotificationDeliveries({ terminalBefore, failedBefore }) {
    const purged = { terminal: 0, failed: 0, total: 0 };
    const terminalCutoff = new Date(terminalBefore).getTime();
    const failedCutoff = new Date(failedBefore).getTime();
    for (const [eventId, delivery] of this.notificationDeliveries.entries()) {
      const timestamp = new Date(delivery.updated_at || delivery.created_at || "").getTime();
      const purgeTerminal = ["sent", "skipped"].includes(delivery.status) && Number.isFinite(timestamp) && timestamp < terminalCutoff;
      const purgeFailed = ["failed", "processing"].includes(delivery.status) && Number.isFinite(timestamp) && timestamp < failedCutoff;
      if (!purgeTerminal && !purgeFailed) continue;
      this.notificationDeliveries.delete(eventId);
      purged[purgeTerminal ? "terminal" : "failed"] += 1;
      purged.total += 1;
    }
    return purged;
  }

  purgeExpiredAuthenticationRecords({ tokenBefore, supportRecoveryBefore }) {
    const tokenCutoff = new Date(tokenBefore).getTime();
    const supportCutoff = new Date(supportRecoveryBefore).getTime();
    const purged = { verification_tokens: 0, password_reset_tokens: 0, support_recoveries: 0, total: 0 };
    purgeTokenMap(this.verificationTokens, this.verificationTokenIndex, tokenCutoff, purged, "verification_tokens");
    purgeTokenMap(this.passwordResetTokens, this.passwordResetTokenIndex, tokenCutoff, purged, "password_reset_tokens");
    for (const [id, transaction] of this.supportRecoveryTransactions.entries()) {
      const effectiveExpiry = Math.max(
        new Date(transaction.expires_at || "").getTime(),
        new Date(transaction.grant_expires_at || "").getTime() || 0,
      );
      if (!Number.isFinite(effectiveExpiry) || effectiveExpiry >= supportCutoff) continue;
      if (transaction.grant_token_hash) this.supportRecoveryGrantIndex.delete(transaction.grant_token_hash);
      this.supportRecoveryTransactions.delete(id);
      purged.support_recoveries += 1;
      purged.total += 1;
    }
    return purged;
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

  createSupportRecoveryTransaction(input) {
    const now = this.nowIso();
    const record = { id: createId("srt"), user_id: input.userId, password_hash: input.passwordHash, expires_at: input.expiresAt, used_at: null, revoked_at: null, grant_token_hash: null, grant_expires_at: null, support_actor_id: input.supportActorId, support_actor_role: input.supportActorRole, reason: input.reason, action_id: input.actionId, delivery_status: input.deliveryStatus || "pending", email_deleted_at: input.emailDeletedAt || null, attempts: 0, created_at: now, updated_at: now };
    this.supportRecoveryTransactions.set(record.id, record);
    return clone(record);
  }

  replaceActiveSupportRecovery(input, { sinceIso, maximum = 3 } = {}) {
    if (this.countRecentSupportRecoveries(input.userId, sinceIso) >= maximum) throw new Error("SUPPORT_RECOVERY_RATE_LIMITED");
    if (this.findActiveSupportRecoveryByUserId(input.userId)) throw new Error("SUPPORT_RECOVERY_ALREADY_ACTIVE");
    return this.createSupportRecoveryTransaction(input);
  }

  findActiveSupportRecoveryByUserId(userId) {
    return Array.from(this.supportRecoveryTransactions.values()).filter((item) => item.user_id === userId && !item.used_at && !item.revoked_at && new Date(item.expires_at).getTime() > this.clock().getTime()).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(clone)[0] || null;
  }

  findSupportRecoveryByGrantHash(tokenHash) {
    const id = this.supportRecoveryGrantIndex.get(tokenHash);
    return id ? clone(this.supportRecoveryTransactions.get(id)) : null;
  }

  updateSupportRecoveryTransaction(id, patch) {
    const current = this.supportRecoveryTransactions.get(id);
    if (!current) return null;
    if (current.grant_token_hash) this.supportRecoveryGrantIndex.delete(current.grant_token_hash);
    const next = { ...current, ...patch, updated_at: this.nowIso() };
    this.supportRecoveryTransactions.set(id, next);
    if (next.grant_token_hash) this.supportRecoveryGrantIndex.set(next.grant_token_hash, id);
    return clone(next);
  }

  consumeSupportRecoveryTransaction(id, patch) {
    const current = this.supportRecoveryTransactions.get(id);
    if (!current || current.used_at || current.revoked_at || new Date(current.expires_at).getTime() <= this.clock().getTime()) return null;
    return this.updateSupportRecoveryTransaction(id, patch);
  }

  incrementSupportRecoveryAttempts(id) {
    const current = this.supportRecoveryTransactions.get(id);
    if (!current || current.used_at || current.revoked_at || new Date(current.expires_at).getTime() <= this.clock().getTime()) return null;
    return this.updateSupportRecoveryTransaction(id, { attempts: Number(current.attempts || 0) + 1 });
  }

  revokeActiveSupportRecoveries(userId, reason = "superseded") {
    let revoked = 0;
    for (const item of this.supportRecoveryTransactions.values()) {
      if (item.user_id !== userId || item.used_at || item.revoked_at) continue;
      this.updateSupportRecoveryTransaction(item.id, { revoked_at: this.nowIso(), revoked_reason: reason });
      revoked += 1;
    }
    return revoked;
  }

  countRecentSupportRecoveries(userId, sinceIso) {
    return Array.from(this.supportRecoveryTransactions.values()).filter((item) => item.user_id === userId && item.created_at >= sinceIso).length;
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

function defaultNotificationPreferences() {
  return {
    thread_replies: false,
    direct_messages: false,
    support_replies: false,
    project_invitations: false,
  };
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

function purgeTokenMap(records, index, cutoff, purged, key) {
  for (const [id, token] of records.entries()) {
    const expiresAt = new Date(token.expires_at || "").getTime();
    if (!Number.isFinite(expiresAt) || expiresAt >= cutoff) continue;
    records.delete(id);
    index.delete(token.token_hash);
    purged[key] += 1;
    purged.total += 1;
  }
}

module.exports = { InMemoryIdentityRepository };
