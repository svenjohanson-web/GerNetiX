const crypto = require("node:crypto");

class PostgresIdentityRepository {
  constructor(pool, clock = () => new Date()) {
    this.pool = pool;
    this.clock = clock;
  }

  static async create(options = {}, clock = () => new Date()) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresIdentityRepository(pool, clock);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS identity_user_accounts (
        id text PRIMARY KEY,
        username_normalized text NOT NULL UNIQUE,
        email_normalized text UNIQUE,
        passkey_credential_id text UNIQUE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS identity_local_credentials (
        user_id text PRIMARY KEY,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS identity_external_identities (
        id text PRIMARY KEY,
        provider_key text NOT NULL UNIQUE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS identity_verification_tokens (
        id text PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS identity_password_reset_tokens (
        id text PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS identity_offline_recovery_transactions (
        id text PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS identity_passkey_credentials (
        id text PRIMARY KEY,
        credential_id text NOT NULL UNIQUE,
        user_id text NOT NULL REFERENCES identity_user_accounts(id) ON DELETE CASCADE,
        rp_id text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_identity_passkey_credentials_user
        ON identity_passkey_credentials (user_id, rp_id);
      CREATE TABLE IF NOT EXISTS identity_support_recovery_transactions (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES identity_user_accounts(id) ON DELETE CASCADE,
        grant_token_hash text UNIQUE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_identity_support_recovery_user
        ON identity_support_recovery_transactions (user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS identity_notification_deliveries (
        event_id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES identity_user_accounts(id) ON DELETE CASCADE,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_identity_notification_deliveries_user
        ON identity_notification_deliveries (user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS identity_sessions (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        token_hash text NOT NULL UNIQUE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_identity_sessions_user_id
        ON identity_sessions (user_id);
      CREATE TABLE IF NOT EXISTS identity_knowledge_chapter_reads (
        account_id text NOT NULL REFERENCES identity_user_accounts(id) ON DELETE CASCADE,
        chapter_id text NOT NULL,
        chapter_version text NOT NULL,
        seen_at timestamptz NOT NULL,
        PRIMARY KEY (account_id, chapter_id)
      );
      CREATE INDEX IF NOT EXISTS idx_identity_knowledge_chapter_reads_account
        ON identity_knowledge_chapter_reads (account_id, seen_at DESC);
      CREATE TABLE IF NOT EXISTS identity_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO identity_passkey_credentials (id, credential_id, user_id, rp_id, raw_json, updated_at)
      SELECT
        'pkc_' || md5(passkey_credential_id),
        passkey_credential_id,
        id,
        COALESCE(NULLIF(raw_json->>'passkey_rp_id', ''), 'legacy-unknown'),
        jsonb_build_object(
          'id', 'pkc_' || md5(passkey_credential_id),
          'credential_id', passkey_credential_id,
          'user_id', id,
          'public_key', raw_json->>'passkey_public_key',
          'counter', COALESCE((raw_json->>'passkey_counter')::integer, 0),
          'transports', COALESCE(raw_json->'passkey_transports', '[]'::jsonb),
          'rp_id', COALESCE(NULLIF(raw_json->>'passkey_rp_id', ''), 'legacy-unknown'),
          'label', 'Legacy-Passkey',
          'created_at', raw_json->>'created_at',
          'updated_at', raw_json->>'updated_at',
          'revoked_at', NULL
        ),
        updated_at
      FROM identity_user_accounts
      WHERE passkey_credential_id IS NOT NULL
      ON CONFLICT (credential_id) DO NOTHING;
    `);
  }

  nowIso() {
    return this.clock().toISOString();
  }

  async createUserAccount({
    id, username, email, status, accountType = "email_account", guestExpiresAt = null,
    passkeyCredentialId = null, passkeyPublicKey = null, passkeyCounter = 0,
    passkeyTransports = [], offlineRecoverySetConfirmedAt = null,
    offlineRecoverySetHash = null, recoveryBoardIds = [], preferredLocale = "de",
    subscriptionPlan = "free", planValidUntil = null, lifecycleState = "active",
    emailVerifiedAt = null,
  }) {
    const now = this.nowIso();
    const account = {
      id: String(id || "").trim() || createId("usr"),
      username,
      email: email ? normalizeEmail(email) : null,
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
    try {
      await this.pool.query(`
        INSERT INTO identity_user_accounts
          (id, username_normalized, email_normalized, passkey_credential_id, raw_json, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        account.id,
        normalizeUsername(account.username),
        account.email,
        account.passkey_credential_id,
        account,
        account.updated_at,
      ]);
      return clone(account);
    } catch (error) {
      throw mapAccountConflict(error);
    }
  }

  async updateUserAccount(userId, patch) {
    const current = await this.findUserById(userId);
    if (!current) return null;
    const next = { ...current, ...patch, updated_at: this.nowIso() };
    try {
      const result = await this.pool.query(`
        UPDATE identity_user_accounts
        SET username_normalized=$2, email_normalized=$3, passkey_credential_id=$4,
            raw_json=$5, updated_at=$6
        WHERE id=$1
        RETURNING raw_json
      `, [
        userId,
        normalizeUsername(next.username),
        next.email ? normalizeEmail(next.email) : null,
        next.passkey_credential_id || null,
        next,
        next.updated_at,
      ]);
      return first(result);
    } catch (error) {
      throw mapAccountConflict(error);
    }
  }

  async findUserById(userId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_user_accounts WHERE id=$1",
      [userId],
    ));
  }

  async findUserByUsername(username) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_user_accounts WHERE username_normalized=$1",
      [normalizeUsername(username)],
    ));
  }

  async findUserByPasskeyCredentialId(credentialId) {
    const value = String(credentialId || "").trim();
    if (!value) return null;
    const credential = await this.findPasskeyCredentialById(value);
    return credential ? this.findUserById(credential.user_id) : null;
  }

  async createPasskeyCredential({ userId, credentialId, publicKey, counter = 0, transports = [], rpId, label = "Passkey" }) {
    const now = this.nowIso();
    const credential = {
      id: createId("pkc"), credential_id: String(credentialId || "").trim(), user_id: userId,
      public_key: String(publicKey || "").trim(), counter: Number(counter || 0), transports: [...transports],
      rp_id: String(rpId || "").trim().toLowerCase(), label: String(label || "Passkey").slice(0, 80),
      created_at: now, updated_at: now, revoked_at: null,
    };
    try {
      await this.pool.query(`
        INSERT INTO identity_passkey_credentials (id, credential_id, user_id, rp_id, raw_json, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [credential.id, credential.credential_id, credential.user_id, credential.rp_id, credential, now]);
      return clone(credential);
    } catch (error) {
      if (error.code === "23505") throw new Error("PASSKEY_CREDENTIAL_ALREADY_EXISTS");
      throw error;
    }
  }

  async listPasskeyCredentials(userId, { includeRevoked = false } = {}) {
    const result = await this.pool.query(`
      SELECT raw_json FROM identity_passkey_credentials
      WHERE user_id=$1 AND ($2::boolean OR raw_json->>'revoked_at' IS NULL)
      ORDER BY updated_at DESC
    `, [userId, includeRevoked]);
    return result.rows.map((row) => clone(row.raw_json));
  }

  async findPasskeyCredentialById(credentialId) {
    return first(await this.pool.query(`
      SELECT raw_json FROM identity_passkey_credentials
      WHERE credential_id=$1 AND raw_json->>'revoked_at' IS NULL
    `, [String(credentialId || "").trim()]));
  }

  async updatePasskeyCredentialCounter(credentialId, counter) {
    const current = await this.findPasskeyCredentialById(credentialId);
    if (!current) return null;
    const next = { ...current, counter: Number(counter || 0), updated_at: this.nowIso() };
    await this.pool.query("UPDATE identity_passkey_credentials SET raw_json=$2, updated_at=$3 WHERE credential_id=$1", [credentialId, next, next.updated_at]);
    return clone(next);
  }

  async revokePasskeyCredentialsByUserId(userId, reason = "recovery_replaced", exceptCredentialId = "") {
    const now = this.nowIso();
    const result = await this.pool.query(`
      UPDATE identity_passkey_credentials
      SET raw_json = raw_json || jsonb_build_object('revoked_at', $3::text, 'revoked_reason', $4::text, 'updated_at', $3::text), updated_at=$3
      WHERE user_id=$1 AND credential_id<>$2 AND raw_json->>'revoked_at' IS NULL
    `, [userId, String(exceptCredentialId || ""), now, reason]);
    return result.rowCount;
  }

  async findUserByEmail(email) {
    if (!email) return null;
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_user_accounts WHERE email_normalized=$1",
      [normalizeEmail(email)],
    ));
  }

  async findNotificationDelivery(eventId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_notification_deliveries WHERE event_id=$1",
      [String(eventId || "")],
    ));
  }

  async saveNotificationDelivery(delivery) {
    const next = { ...delivery, updated_at: this.nowIso() };
    await this.pool.query(`
      INSERT INTO identity_notification_deliveries (event_id, user_id, status, raw_json, updated_at)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (event_id) DO UPDATE SET
        status=EXCLUDED.status, raw_json=EXCLUDED.raw_json, updated_at=EXCLUDED.updated_at
    `, [next.event_id, next.user_id, next.status, next, next.updated_at]);
    return clone(next);
  }

  async purgeNotificationDeliveries({ terminalBefore, failedBefore }) {
    const result = await this.pool.query(`
      WITH deleted AS (
        DELETE FROM identity_notification_deliveries
        WHERE (status IN ('sent', 'skipped') AND updated_at < $1)
           OR (status IN ('failed', 'processing') AND updated_at < $2)
        RETURNING status
      )
      SELECT
        count(*) FILTER (WHERE status IN ('sent', 'skipped'))::int AS terminal,
        count(*) FILTER (WHERE status IN ('failed', 'processing'))::int AS failed,
        count(*)::int AS total
      FROM deleted
    `, [terminalBefore, failedBefore]);
    const row = result.rows[0] || {};
    return { terminal: Number(row.terminal || 0), failed: Number(row.failed || 0), total: Number(row.total || 0) };
  }

  async purgeExpiredAuthenticationRecords({ tokenBefore, supportRecoveryBefore }) {
    const result = await this.pool.query(`
      WITH deleted_verification AS (
        DELETE FROM identity_verification_tokens
        WHERE (raw_json->>'expires_at')::timestamptz < $1
        RETURNING 1
      ), deleted_password_reset AS (
        DELETE FROM identity_password_reset_tokens
        WHERE (raw_json->>'expires_at')::timestamptz < $1
        RETURNING 1
      ), deleted_support AS (
        DELETE FROM identity_support_recovery_transactions
        WHERE GREATEST(
          (raw_json->>'expires_at')::timestamptz,
          COALESCE((raw_json->>'grant_expires_at')::timestamptz, '-infinity'::timestamptz)
        ) < $2
        RETURNING 1
      )
      SELECT
        (SELECT count(*)::int FROM deleted_verification) AS verification_tokens,
        (SELECT count(*)::int FROM deleted_password_reset) AS password_reset_tokens,
        (SELECT count(*)::int FROM deleted_support) AS support_recoveries
    `, [tokenBefore, supportRecoveryBefore]);
    const row = result.rows[0] || {};
    const purged = {
      verification_tokens: Number(row.verification_tokens || 0),
      password_reset_tokens: Number(row.password_reset_tokens || 0),
      support_recoveries: Number(row.support_recoveries || 0),
    };
    return { ...purged, total: purged.verification_tokens + purged.password_reset_tokens + purged.support_recoveries };
  }

  async checkHealth() {
    try {
      await this.pool.query("SELECT 1");
      return { ready:true };
    } catch {
      return { ready:false, error_code:"identity_persistence_unavailable" };
    }
  }

  async usernameExists(username) {
    return (await this.pool.query(
      "SELECT 1 FROM identity_user_accounts WHERE username_normalized=$1",
      [normalizeUsername(username)],
    )).rowCount > 0;
  }

  async createLocalCredential({ userId, passwordHash }) {
    const now = this.nowIso();
    const credential = {
      id: createId("lcr"),
      user_id: userId,
      password_hash: passwordHash,
      created_at: now,
      updated_at: now,
    };
    await upsertRaw(this.pool, "identity_local_credentials", "user_id", userId, credential, now);
    return clone(credential);
  }

  async findLocalCredentialByUserId(userId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_local_credentials WHERE user_id=$1",
      [userId],
    ));
  }

  async updateLocalCredential(userId, patch) {
    const current = await this.findLocalCredentialByUserId(userId);
    if (!current) return null;
    const next = { ...current, ...patch, updated_at: this.nowIso() };
    await upsertRaw(this.pool, "identity_local_credentials", "user_id", userId, next, next.updated_at);
    return clone(next);
  }

  async createExternalIdentity({ userId, provider, providerUserId, providerEmail }) {
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
    try {
      await this.pool.query(`
        INSERT INTO identity_external_identities (id, provider_key, raw_json, updated_at)
        VALUES ($1, $2, $3, $4)
      `, [identity.id, externalKey(provider, providerUserId), identity, now]);
      return clone(identity);
    } catch (error) {
      if (error.code === "23505") throw new Error("EXTERNAL_IDENTITY_ALREADY_EXISTS");
      throw error;
    }
  }

  async findExternalIdentity(provider, providerUserId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_external_identities WHERE provider_key=$1",
      [externalKey(provider, providerUserId)],
    ));
  }

  async touchExternalIdentity(identityId) {
    const current = first(await this.pool.query(
      "SELECT raw_json FROM identity_external_identities WHERE id=$1",
      [identityId],
    ));
    if (!current) return null;
    const next = { ...current, last_login_at: this.nowIso() };
    await this.pool.query(
      "UPDATE identity_external_identities SET raw_json=$2, updated_at=$3 WHERE id=$1",
      [identityId, next, next.last_login_at],
    );
    return clone(next);
  }

  async createVerificationToken(token) {
    return this.insertToken("identity_verification_tokens", "vft", token);
  }

  async findVerificationTokenByHash(tokenHash) {
    return this.findToken("identity_verification_tokens", tokenHash);
  }

  async markVerificationTokenUsed(tokenId) {
    return this.markTokenUsed("identity_verification_tokens", tokenId);
  }

  async createPasswordResetToken(token) {
    return this.insertToken("identity_password_reset_tokens", "prt", token);
  }

  async findPasswordResetTokenByHash(tokenHash) {
    return this.findToken("identity_password_reset_tokens", tokenHash);
  }

  async markPasswordResetTokenUsed(tokenId) {
    return this.markTokenUsed("identity_password_reset_tokens", tokenId);
  }

  async createOfflineRecoveryTransaction(token) {
    return this.insertToken("identity_offline_recovery_transactions", "ort", token);
  }

  async findOfflineRecoveryTransactionByHash(tokenHash) {
    return this.findToken("identity_offline_recovery_transactions", tokenHash);
  }

  async markOfflineRecoveryTransactionUsed(tokenId) {
    return this.markTokenUsed("identity_offline_recovery_transactions", tokenId);
  }

  async createSupportRecoveryTransaction(input) {
    const now = this.nowIso();
    const record = supportRecoveryRecord(input, now);
    await this.pool.query(`
      INSERT INTO identity_support_recovery_transactions (id, user_id, grant_token_hash, raw_json, updated_at)
      VALUES ($1, $2, NULL, $3, $4)
    `, [record.id, record.user_id, record, now]);
    return clone(record);
  }

  async replaceActiveSupportRecovery(input, { sinceIso, maximum = 3 } = {}) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`identity-support-recovery:${input.userId}`]);
      const recent = await client.query(`
        SELECT COUNT(*)::integer AS count FROM identity_support_recovery_transactions
        WHERE user_id=$1 AND (raw_json->>'created_at')::timestamptz >= $2::timestamptz
      `, [input.userId, sinceIso]);
      if (Number(recent.rows[0]?.count || 0) >= maximum) throw new Error("SUPPORT_RECOVERY_RATE_LIMITED");
      const now = this.nowIso();
      const active = await client.query(`
        SELECT 1 FROM identity_support_recovery_transactions
        WHERE user_id=$1 AND raw_json->>'used_at' IS NULL AND raw_json->>'revoked_at' IS NULL
          AND (raw_json->>'expires_at')::timestamptz > now()
        LIMIT 1
      `, [input.userId]);
      if (active.rowCount) throw new Error("SUPPORT_RECOVERY_ALREADY_ACTIVE");
      const record = supportRecoveryRecord(input, now);
      await client.query(`
        INSERT INTO identity_support_recovery_transactions (id, user_id, grant_token_hash, raw_json, updated_at)
        VALUES ($1, $2, NULL, $3, $4)
      `, [record.id, record.user_id, record, now]);
      await client.query("COMMIT");
      return clone(record);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findActiveSupportRecoveryByUserId(userId) {
    return first(await this.pool.query(`
      SELECT raw_json FROM identity_support_recovery_transactions
      WHERE user_id=$1 AND raw_json->>'used_at' IS NULL AND raw_json->>'revoked_at' IS NULL
        AND (raw_json->>'expires_at')::timestamptz > now()
      ORDER BY updated_at DESC LIMIT 1
    `, [userId]));
  }

  async findSupportRecoveryByGrantHash(tokenHash) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_support_recovery_transactions WHERE grant_token_hash=$1",
      [tokenHash],
    ));
  }

  async updateSupportRecoveryTransaction(id, patch) {
    const current = first(await this.pool.query("SELECT raw_json FROM identity_support_recovery_transactions WHERE id=$1", [id]));
    if (!current) return null;
    const next = { ...current, ...patch, updated_at: this.nowIso() };
    await this.pool.query(`
      UPDATE identity_support_recovery_transactions
      SET grant_token_hash=$2, raw_json=$3, updated_at=$4 WHERE id=$1
    `, [id, next.grant_token_hash || null, next, next.updated_at]);
    return clone(next);
  }

  async consumeSupportRecoveryTransaction(id, patch) {
    const now = this.nowIso();
    const result = await this.pool.query(`
      UPDATE identity_support_recovery_transactions
      SET grant_token_hash=$2,
          raw_json=raw_json || $3::jsonb || jsonb_build_object('updated_at', $4::text),
          updated_at=$4
      WHERE id=$1 AND raw_json->>'used_at' IS NULL AND raw_json->>'revoked_at' IS NULL
        AND (raw_json->>'expires_at')::timestamptz > now()
      RETURNING raw_json
    `, [id, patch.grant_token_hash || null, JSON.stringify(patch), now]);
    return first(result);
  }

  async incrementSupportRecoveryAttempts(id) {
    const now = this.nowIso();
    const result = await this.pool.query(`
      UPDATE identity_support_recovery_transactions
      SET raw_json=jsonb_set(raw_json, '{attempts}', to_jsonb(COALESCE((raw_json->>'attempts')::integer, 0) + 1), true)
            || jsonb_build_object('updated_at', $2::text),
          updated_at=$2
      WHERE id=$1 AND raw_json->>'used_at' IS NULL AND raw_json->>'revoked_at' IS NULL
        AND (raw_json->>'expires_at')::timestamptz > now()
      RETURNING raw_json
    `, [id, now]);
    return first(result);
  }

  async revokeActiveSupportRecoveries(userId, reason = "superseded") {
    const now = this.nowIso();
    const result = await this.pool.query(`
      UPDATE identity_support_recovery_transactions
      SET raw_json=raw_json || jsonb_build_object('revoked_at', $2::text, 'revoked_reason', $3::text, 'updated_at', $2::text), updated_at=$2
      WHERE user_id=$1 AND raw_json->>'used_at' IS NULL AND raw_json->>'revoked_at' IS NULL
    `, [userId, now, reason]);
    return result.rowCount;
  }

  async countRecentSupportRecoveries(userId, sinceIso) {
    const result = await this.pool.query(`
      SELECT COUNT(*)::integer AS count FROM identity_support_recovery_transactions
      WHERE user_id=$1 AND (raw_json->>'created_at')::timestamptz >= $2::timestamptz
    `, [userId, sinceIso]);
    return Number(result.rows[0]?.count || 0);
  }

  async createSession({ userId, tokenHash, expiresAt, jwtId = null, status = "active", pendingExpiresAt = null }) {
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
    await this.pool.query(`
      INSERT INTO identity_sessions (id, user_id, token_hash, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [session.id, userId, tokenHash, session, now]);
    return clone(session);
  }

  async createLoginSession(input) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockAccountSessions(client, input.userId);
      const active = await client.query(`
        SELECT 1 FROM identity_sessions
        WHERE user_id=$1
          AND raw_json->>'revoked_at' IS NULL
          AND COALESCE(raw_json->>'status', 'active')='active'
          AND (raw_json->>'expires_at')::timestamptz > now()
        LIMIT 1
      `, [input.userId]);
      const now = this.nowIso();
      await client.query(`
        UPDATE identity_sessions
        SET raw_json = raw_json || jsonb_build_object(
              'status', 'revoked', 'revoked_at', $2::text,
              'revoked_reason', 'superseded_pending_login'
            ), updated_at=$2
        WHERE user_id=$1 AND raw_json->>'status'='pending' AND raw_json->>'revoked_at' IS NULL
      `, [input.userId, now]);
      const session = sessionRecord({
        ...input,
        status: active.rowCount ? "pending" : "active",
        pendingExpiresAt: active.rowCount ? input.pendingExpiresAt : null,
      }, now);
      await insertSession(client, session, now);
      await client.query("COMMIT");
      return clone(session);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findSessionById(sessionId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_sessions WHERE id=$1",
      [sessionId],
    ));
  }

  async findSessionByTokenHash(tokenHash) {
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_sessions WHERE token_hash=$1",
      [tokenHash],
    ));
  }

  async revokeSession(sessionId, reason = "logout", replacedBySessionId = null) {
    const current = await this.findSessionById(sessionId);
    if (!current) return null;
    const next = {
      ...current,
      status: "revoked",
      revoked_at: this.nowIso(),
      revoked_reason: reason,
      replaced_by_session_id: replacedBySessionId,
    };
    await this.pool.query(
      "UPDATE identity_sessions SET raw_json=$2, updated_at=$3 WHERE id=$1",
      [sessionId, next, next.revoked_at],
    );
    return clone(next);
  }

  async activatePendingSessionByTokenHash(tokenHash) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let result = await client.query(
        "SELECT raw_json FROM identity_sessions WHERE token_hash=$1",
        [tokenHash],
      );
      let pending = first(result);
      if (!pending) {
        await client.query("ROLLBACK");
        return null;
      }
      await lockAccountSessions(client, pending.user_id);
      result = await client.query(
        "SELECT raw_json FROM identity_sessions WHERE token_hash=$1 FOR UPDATE",
        [tokenHash],
      );
      pending = first(result);
      if (!isUsablePendingSession(pending, this.clock())) {
        await client.query("ROLLBACK");
        return null;
      }
      const now = this.nowIso();
      await client.query(`
        UPDATE identity_sessions
        SET raw_json = raw_json || jsonb_build_object(
              'status', 'revoked', 'revoked_at', $3::text,
              'revoked_reason', 'replaced', 'replaced_by_session_id', $2::text
            ), updated_at=$3
        WHERE user_id=$1 AND id<>$2
          AND raw_json->>'revoked_at' IS NULL
          AND COALESCE(raw_json->>'status', 'active')='active'
      `, [pending.user_id, pending.id, now]);
      const activated = {
        ...pending,
        status: "active",
        pending_expires_at: null,
        activated_at: now,
      };
      await client.query(
        "UPDATE identity_sessions SET raw_json=$2, updated_at=$3 WHERE id=$1",
        [pending.id, activated, now],
      );
      await client.query("COMMIT");
      return clone({ ...activated, replaced_session: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelPendingSessionByTokenHash(tokenHash) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let result = await client.query("SELECT raw_json FROM identity_sessions WHERE token_hash=$1", [tokenHash]);
      let pending = first(result);
      if (!pending) { await client.query("ROLLBACK"); return null; }
      await lockAccountSessions(client, pending.user_id);
      result = await client.query("SELECT raw_json FROM identity_sessions WHERE token_hash=$1 FOR UPDATE", [tokenHash]);
      pending = first(result);
      if (!isUsablePendingSession(pending, this.clock())) { await client.query("ROLLBACK"); return null; }
      const now = this.nowIso();
      const cancelled = { ...pending, status: "revoked", revoked_at: now, revoked_reason: "cancelled_pending_login" };
      await client.query("UPDATE identity_sessions SET raw_json=$2, updated_at=$3 WHERE id=$1", [pending.id, cancelled, now]);
      await client.query("COMMIT");
      return clone(cancelled);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async secureAccountByPendingTokenHash(tokenHash) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let result = await client.query(
        "SELECT raw_json FROM identity_sessions WHERE token_hash=$1",
        [tokenHash],
      );
      let pending = first(result);
      if (!pending) {
        await client.query("ROLLBACK");
        return null;
      }
      await lockAccountSessions(client, pending.user_id);
      result = await client.query(
        "SELECT raw_json FROM identity_sessions WHERE token_hash=$1 FOR UPDATE",
        [tokenHash],
      );
      pending = first(result);
      if (!isUsablePendingSession(pending, this.clock())) {
        await client.query("ROLLBACK");
        return null;
      }
      const now = this.nowIso();
      const revoked = await client.query(`
        UPDATE identity_sessions
        SET raw_json = raw_json || jsonb_build_object(
              'status', 'revoked', 'revoked_at', $2::text,
              'revoked_reason', 'account_security_requested',
              'replaced_by_session_id', $3::text
            ), updated_at=$2
        WHERE user_id=$1 AND id<>$3 AND raw_json->>'revoked_at' IS NULL
      `, [pending.user_id, now, pending.id]);
      const activated = {
        ...pending,
        status: "active",
        pending_expires_at: null,
        activated_at: now,
      };
      await client.query(
        "UPDATE identity_sessions SET raw_json=$2, updated_at=$3 WHERE id=$1",
        [pending.id, activated, now],
      );
      await client.query("COMMIT");
      return clone({ ...activated, revoked_sessions: revoked.rowCount });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeSessionsByUserId(userId) {
    const result = await this.pool.query(`
      UPDATE identity_sessions
      SET raw_json=jsonb_set(raw_json, '{revoked_at}', to_jsonb($2::text), true),
          updated_at=$2
      WHERE user_id=$1 AND raw_json->>'revoked_at' IS NULL
    `, [userId, this.nowIso()]);
    return result.rowCount;
  }

  async listKnowledgeChapterReads(accountId) {
    const result = await this.pool.query(`
      SELECT account_id, chapter_id, chapter_version, seen_at
      FROM identity_knowledge_chapter_reads
      WHERE account_id=$1
      ORDER BY seen_at DESC, chapter_id
    `, [accountId]);
    return result.rows.map((row) => ({
      ...row,
      seen_at: toIso(row.seen_at),
    }));
  }

  async markKnowledgeChapterRead(accountId, chapterId, chapterVersion) {
    const seenAt = this.nowIso();
    const result = await this.pool.query(`
      INSERT INTO identity_knowledge_chapter_reads
        (account_id, chapter_id, chapter_version, seen_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(account_id, chapter_id) DO UPDATE SET
        chapter_version=excluded.chapter_version,
        seen_at=excluded.seen_at
      RETURNING account_id, chapter_id, chapter_version, seen_at
    `, [accountId, chapterId, chapterVersion, seenAt]);
    const row = result.rows[0];
    return { ...row, seen_at: toIso(row.seen_at) };
  }

  async hasMigration(migrationId) {
    return (await this.pool.query(
      "SELECT 1 FROM identity_migrations WHERE migration_id=$1",
      [migrationId],
    )).rowCount > 0;
  }

  async importLegacyState(state, migrationId = "identity-sqlite-v1") {
    if (await this.hasMigration(migrationId)) return { imported: false, reason: "already_applied" };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = Number((await client.query(
        "SELECT COUNT(*) AS count FROM identity_user_accounts",
      )).rows[0].count);
      if (existing > 0) {
        throw new Error("IDENTITY_POSTGRES_NOT_EMPTY");
      }
      for (const account of state.userAccounts || []) {
        await client.query(`
          INSERT INTO identity_user_accounts
            (id, username_normalized, email_normalized, passkey_credential_id, raw_json, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          account.id,
          normalizeUsername(account.username),
          account.email ? normalizeEmail(account.email) : null,
          account.passkey_credential_id || null,
          account,
          account.updated_at || account.created_at || this.nowIso(),
        ]);
      }
      await importRawCollection(client, "identity_local_credentials", "user_id", state.localCredentials);
      await importExternalIdentities(client, state.externalIdentities);
      await importTokenCollection(client, "identity_verification_tokens", state.verificationTokens);
      await importTokenCollection(client, "identity_password_reset_tokens", state.passwordResetTokens);
      await importTokenCollection(client, "identity_offline_recovery_transactions", state.offlineRecoveryTransactions);
      await importSessions(client, state.sessions);
      await client.query(
        "INSERT INTO identity_migrations (migration_id) VALUES ($1)",
        [migrationId],
      );
      await client.query("COMMIT");
      return {
        imported: true,
        accounts: (state.userAccounts || []).length,
        sessions: (state.sessions || []).length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async insertToken(tableName, prefix, token) {
    const record = { id: createId(prefix), ...token };
    await this.pool.query(`
      INSERT INTO ${tableName} (id, token_hash, raw_json, updated_at)
      VALUES ($1, $2, $3, $4)
    `, [record.id, record.token_hash, record, this.nowIso()]);
    return clone(record);
  }

  async findToken(tableName, tokenHash) {
    return first(await this.pool.query(
      `SELECT raw_json FROM ${tableName} WHERE token_hash=$1`,
      [tokenHash],
    ));
  }

  async markTokenUsed(tableName, tokenId) {
    const current = first(await this.pool.query(
      `SELECT raw_json FROM ${tableName} WHERE id=$1`,
      [tokenId],
    ));
    if (!current) return null;
    const next = { ...current, used_at: this.nowIso() };
    await this.pool.query(
      `UPDATE ${tableName} SET raw_json=$2, updated_at=$3 WHERE id=$1`,
      [tokenId, next, next.used_at],
    );
    return clone(next);
  }

  async close() {
    await this.pool.end();
  }
}

async function upsertRaw(pool, tableName, idColumn, id, document, updatedAt) {
  await pool.query(`
    INSERT INTO ${tableName} (${idColumn}, raw_json, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (${idColumn}) DO UPDATE SET
      raw_json=EXCLUDED.raw_json,
      updated_at=EXCLUDED.updated_at
  `, [id, document, updatedAt]);
}

function sessionRecord({ userId, tokenHash, expiresAt, jwtId = null, status = "active", pendingExpiresAt = null }, now) {
  return {
    id: createId("ses"), user_id: userId, token_hash: tokenHash, jwt_id: jwtId,
    expires_at: expiresAt, status, pending_expires_at: pendingExpiresAt,
    revoked_at: null, revoked_reason: null, replaced_by_session_id: null, created_at: now,
  };
}

async function insertSession(client, session, now) {
  await client.query(`
    INSERT INTO identity_sessions (id, user_id, token_hash, raw_json, updated_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [session.id, session.user_id, session.token_hash, session, now]);
}

async function lockAccountSessions(client, userId) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`identity-session:${userId}`]);
}

function isUsablePendingSession(session, now = new Date()) {
  return Boolean(session && !session.revoked_at && session.status === "pending" && new Date(session.pending_expires_at).getTime() > now.getTime());
}

async function importRawCollection(client, tableName, idColumn, documents = []) {
  for (const document of documents) {
    const id = document[idColumn];
    if (!id) throw new Error(`Missing ${idColumn} while importing ${tableName}.`);
    await client.query(`
      INSERT INTO ${tableName} (${idColumn}, raw_json, updated_at)
      VALUES ($1, $2, $3)
    `, [id, document, document.updated_at || document.created_at || new Date().toISOString()]);
  }
}

async function importExternalIdentities(client, documents = []) {
  for (const document of documents) {
    await client.query(`
      INSERT INTO identity_external_identities (id, provider_key, raw_json, updated_at)
      VALUES ($1, $2, $3, $4)
    `, [
      document.id,
      externalKey(document.provider, document.provider_user_id),
      document,
      document.last_login_at || document.linked_at || new Date().toISOString(),
    ]);
  }
}

async function importTokenCollection(client, tableName, documents = []) {
  for (const document of documents) {
    await client.query(`
      INSERT INTO ${tableName} (id, token_hash, raw_json, updated_at)
      VALUES ($1, $2, $3, $4)
    `, [
      document.id,
      document.token_hash,
      document,
      document.used_at || document.created_at || new Date().toISOString(),
    ]);
  }
}

async function importSessions(client, documents = []) {
  for (const document of documents) {
    await client.query(`
      INSERT INTO identity_sessions (id, user_id, token_hash, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      document.id,
      document.user_id,
      document.token_hash,
      document,
      document.revoked_at || document.created_at || new Date().toISOString(),
    ]);
  }
}

function mapAccountConflict(error) {
  if (error.code !== "23505") return error;
  const constraint = String(error.constraint || "");
  if (constraint.includes("username")) return new Error("USERNAME_ALREADY_EXISTS");
  if (constraint.includes("email")) return new Error("EMAIL_ALREADY_EXISTS");
  if (constraint.includes("pkey")) return new Error("USER_ID_ALREADY_EXISTS");
  return error;
}

function first(result) {
  return result.rows[0] ? clone(result.rows[0].raw_json) : null;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function supportRecoveryRecord(input, now) {
  return {
    id: createId("srt"), user_id: input.userId, password_hash: input.passwordHash, expires_at: input.expiresAt,
    used_at: null, revoked_at: null, grant_token_hash: null, grant_expires_at: null,
    support_actor_id: input.supportActorId, support_actor_role: input.supportActorRole, reason: input.reason,
    action_id: input.actionId, delivery_status: input.deliveryStatus || "pending", email_deleted_at: input.emailDeletedAt || null,
    attempts: 0, created_at: now, updated_at: now,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function defaultNotificationPreferences() {
  return {
    thread_replies: false,
    direct_messages: false,
    support_replies: false,
    project_invitations: false,
  };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function externalKey(provider, providerUserId) {
  return `${provider}:${providerUserId}`;
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { PostgresIdentityRepository };
