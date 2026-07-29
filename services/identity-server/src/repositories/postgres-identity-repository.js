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
  }) {
    const now = this.nowIso();
    const account = {
      id: String(id || "").trim() || createId("usr"),
      username,
      email: email ? normalizeEmail(email) : null,
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
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_user_accounts WHERE passkey_credential_id=$1",
      [value],
    ));
  }

  async findUserByEmail(email) {
    if (!email) return null;
    return first(await this.pool.query(
      "SELECT raw_json FROM identity_user_accounts WHERE email_normalized=$1",
      [normalizeEmail(email)],
    ));
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

  async createSession({ userId, tokenHash, expiresAt, jwtId = null }) {
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
    await this.pool.query(`
      INSERT INTO identity_sessions (id, user_id, token_hash, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [session.id, userId, tokenHash, session, now]);
    return clone(session);
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

  async revokeSession(sessionId) {
    const current = await this.findSessionById(sessionId);
    if (!current) return null;
    const next = { ...current, revoked_at: this.nowIso() };
    await this.pool.query(
      "UPDATE identity_sessions SET raw_json=$2, updated_at=$3 WHERE id=$1",
      [sessionId, next, next.revoked_at],
    );
    return clone(next);
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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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
