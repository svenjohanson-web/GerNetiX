"use strict";

class PostgresDeviceManagementRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresDeviceManagementRepository(pool);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS device_management_devices (
        device_id text PRIMARY KEY,
        serial_number text NOT NULL,
        hardware_profile_id text NOT NULL,
        authenticity_status text NOT NULL,
        lifecycle_state text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_device_management_devices_serial
        ON device_management_devices (serial_number);

      CREATE TABLE IF NOT EXISTS device_management_credentials (
        device_id text PRIMARY KEY REFERENCES device_management_devices(device_id) ON DELETE CASCADE,
        credential_id text NOT NULL UNIQUE,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS device_management_challenges (
        challenge_id text PRIMARY KEY,
        device_id text NOT NULL REFERENCES device_management_devices(device_id) ON DELETE CASCADE,
        expires_at text NOT NULL,
        used_at text,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS device_management_pairing_sessions (
        pairing_session_id text PRIMARY KEY,
        account_id text NOT NULL,
        device_id text NOT NULL REFERENCES device_management_devices(device_id) ON DELETE CASCADE,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_device_management_pairing_device
        ON device_management_pairing_sessions (device_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS device_management_provisioning_tokens (
        provisioning_token_id text PRIMARY KEY,
        account_id text NOT NULL,
        token_hash_sha256 text NOT NULL UNIQUE,
        status text NOT NULL,
        expires_at text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS device_management_account_devices (
        account_device_id text PRIMARY KEY,
        account_id text NOT NULL,
        device_id text NOT NULL REFERENCES device_management_devices(device_id) ON DELETE CASCADE,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_device_management_account_devices_account
        ON device_management_account_devices (account_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_device_management_account_devices_device
        ON device_management_account_devices (device_id);

      CREATE TABLE IF NOT EXISTS device_management_purchase_contexts (
        purchase_context_id text PRIMARY KEY,
        account_id text NOT NULL,
        support_basis text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_device_management_purchase_contexts_account
        ON device_management_purchase_contexts (account_id, updated_at);

      CREATE TABLE IF NOT EXISTS device_management_consents (
        consent_id text PRIMARY KEY,
        account_id text NOT NULL,
        granted_to_role text NOT NULL,
        purpose text NOT NULL,
        valid_from text NOT NULL,
        valid_until text NOT NULL,
        revoked_at text,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_device_management_consents_lookup
        ON device_management_consents (account_id, granted_to_role, purpose);

      CREATE TABLE IF NOT EXISTS device_management_audit_events (
        audit_event_id text PRIMARY KEY,
        account_id text,
        occurred_at text NOT NULL,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_device_management_audit_account
        ON device_management_audit_events (account_id, occurred_at);

      CREATE TABLE IF NOT EXISTS device_management_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async saveDevice(device) {
    await this.pool.query(`
      INSERT INTO device_management_devices
        (device_id, serial_number, hardware_profile_id, authenticity_status, lifecycle_state, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (device_id) DO UPDATE SET
        serial_number=EXCLUDED.serial_number,
        hardware_profile_id=EXCLUDED.hardware_profile_id,
        authenticity_status=EXCLUDED.authenticity_status,
        lifecycle_state=EXCLUDED.lifecycle_state,
        raw_json=EXCLUDED.raw_json,
        updated_at=now()
    `, [device.device_id, device.serial_number, device.hardware_profile_id,
      device.authenticity_status, device.lifecycle_state, device]);
    return clone(device);
  }

  async findDevice(deviceId) {
    return first(await this.pool.query("SELECT raw_json FROM device_management_devices WHERE device_id=$1", [deviceId]));
  }

  async listDevices(filter = {}) {
    if (filter.authenticity_status) {
      return rows(await this.pool.query(
        "SELECT raw_json FROM device_management_devices WHERE authenticity_status=$1 ORDER BY updated_at DESC",
        [filter.authenticity_status],
      ));
    }
    return rows(await this.pool.query("SELECT raw_json FROM device_management_devices ORDER BY updated_at DESC"));
  }

  async saveCredential(deviceId, credential) {
    const sanitized = sanitizeCredential({ ...credential, device_id: deviceId });
    await this.pool.query(`
      INSERT INTO device_management_credentials (device_id, credential_id, status, raw_json)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (device_id) DO UPDATE SET
        credential_id=EXCLUDED.credential_id, status=EXCLUDED.status,
        raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [deviceId, sanitized.credential_id, sanitized.status, sanitized]);
    return clone(sanitized);
  }

  async findCredential(deviceId) {
    return first(await this.pool.query("SELECT raw_json FROM device_management_credentials WHERE device_id=$1", [deviceId]));
  }

  async saveChallenge(challenge) {
    await this.pool.query(`
      INSERT INTO device_management_challenges (challenge_id, device_id, expires_at, used_at, raw_json)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (challenge_id) DO UPDATE SET
        expires_at=EXCLUDED.expires_at, used_at=EXCLUDED.used_at,
        raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [challenge.challenge_id, challenge.device_id, challenge.expires_at, challenge.used_at, challenge]);
    return clone(challenge);
  }

  async findChallenge(challengeId) {
    return first(await this.pool.query("SELECT raw_json FROM device_management_challenges WHERE challenge_id=$1", [challengeId]));
  }

  async markChallengeUsed(challengeId) {
    const challenge = await this.findChallenge(challengeId);
    if (!challenge) return null;
    challenge.used_at = new Date().toISOString();
    return this.saveChallenge(challenge);
  }

  async savePairingSession(session) {
    await this.pool.query(`
      INSERT INTO device_management_pairing_sessions
        (pairing_session_id, account_id, device_id, status, raw_json)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (pairing_session_id) DO UPDATE SET
        status=EXCLUDED.status, raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [session.pairing_session_id, session.account_id, session.device_id, session.status, session]);
    return clone(session);
  }

  async findPairingSession(sessionId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM device_management_pairing_sessions WHERE pairing_session_id=$1",
      [sessionId],
    ));
  }

  async listPairingSessionsForDevice(deviceId) {
    return rows(await this.pool.query(
      "SELECT raw_json FROM device_management_pairing_sessions WHERE device_id=$1 ORDER BY updated_at DESC",
      [deviceId],
    ));
  }

  async saveProvisioningToken(token) {
    await this.pool.query(`
      INSERT INTO device_management_provisioning_tokens
        (provisioning_token_id, account_id, token_hash_sha256, status, expires_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (provisioning_token_id) DO UPDATE SET
        status=EXCLUDED.status, raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [token.provisioning_token_id, token.account_id, token.token_hash_sha256,
      token.status, token.expires_at, token]);
    return clone(token);
  }

  async findProvisioningTokenByHash(tokenHash) {
    return first(await this.pool.query(
      "SELECT raw_json FROM device_management_provisioning_tokens WHERE token_hash_sha256=$1",
      [tokenHash],
    ));
  }

  async saveAccountDevice(accountDevice) {
    await this.pool.query(`
      INSERT INTO device_management_account_devices (account_device_id, account_id, device_id, raw_json)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (account_device_id) DO UPDATE SET
        account_id=EXCLUDED.account_id, device_id=EXCLUDED.device_id,
        raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [accountDevice.account_device_id, accountDevice.account_id, accountDevice.device_id, accountDevice]);
    return clone(accountDevice);
  }

  async listAccountDevices(accountId) {
    return rows(await this.pool.query(
      "SELECT raw_json FROM device_management_account_devices WHERE account_id=$1 ORDER BY updated_at",
      [accountId],
    ));
  }

  async listAllAccountDevices() {
    return rows(await this.pool.query("SELECT raw_json FROM device_management_account_devices ORDER BY updated_at"));
  }

  async findAccountIdsByDeviceId(deviceId) {
    const result = await this.pool.query(
      "SELECT DISTINCT account_id FROM device_management_account_devices WHERE device_id=$1 ORDER BY account_id",
      [deviceId],
    );
    return result.rows.map((row) => row.account_id);
  }

  async findAccountDevice(accountId, accountDeviceId) {
    return first(await this.pool.query(`
      SELECT raw_json FROM device_management_account_devices
      WHERE account_id=$1 AND account_device_id=$2
    `, [accountId, accountDeviceId]));
  }

  async deleteAccountDevice(accountId, accountDeviceId) {
    return first(await this.pool.query(`
      DELETE FROM device_management_account_devices
      WHERE account_id=$1 AND account_device_id=$2 RETURNING raw_json
    `, [accountId, accountDeviceId]));
  }

  async savePurchaseContext(accountId, context) {
    const value = { ...context, account_id: accountId };
    await this.pool.query(`
      INSERT INTO device_management_purchase_contexts
        (purchase_context_id, account_id, support_basis, raw_json)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (purchase_context_id) DO UPDATE SET
        account_id=EXCLUDED.account_id, support_basis=EXCLUDED.support_basis,
        raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [value.purchase_context_id, accountId, value.support_basis, value]);
    return clone(value);
  }

  async listPurchaseContexts(accountId) {
    return rows(await this.pool.query(
      "SELECT raw_json FROM device_management_purchase_contexts WHERE account_id=$1 ORDER BY updated_at",
      [accountId],
    ));
  }

  async findPurchaseContext(accountId, purchaseContextId) {
    return first(await this.pool.query(`
      SELECT raw_json FROM device_management_purchase_contexts
      WHERE account_id=$1 AND purchase_context_id=$2
    `, [accountId, purchaseContextId]));
  }

  async createConsent(consent) {
    await this.pool.query(`
      INSERT INTO device_management_consents
        (consent_id, account_id, granted_to_role, purpose, valid_from, valid_until, revoked_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (consent_id) DO UPDATE SET
        revoked_at=EXCLUDED.revoked_at, raw_json=EXCLUDED.raw_json, updated_at=now()
    `, [consent.consent_id, consent.account_id, consent.granted_to_role, consent.purpose,
      consent.valid_from, consent.valid_until, consent.revoked_at, consent]);
    return clone(consent);
  }

  async findConsent(consentId) {
    return first(await this.pool.query("SELECT raw_json FROM device_management_consents WHERE consent_id=$1", [consentId]));
  }

  async revokeConsent(consentId) {
    const consent = await this.findConsent(consentId);
    if (!consent) return null;
    consent.revoked_at = new Date().toISOString();
    return this.createConsent(consent);
  }

  async findValidConsent({ accountId, role, purpose, at = new Date() }) {
    const candidates = rows(await this.pool.query(`
      SELECT raw_json FROM device_management_consents
      WHERE account_id=$1 AND purpose=$2
        AND granted_to_role IN ($3, 'any_internal_role')
        AND revoked_at IS NULL
    `, [accountId, purpose, role]));
    return candidates.find((consent) => (
      new Date(consent.valid_from).getTime() <= at.getTime()
      && new Date(consent.valid_until).getTime() > at.getTime()
    )) || null;
  }

  async addAuditEvent(event) {
    const auditEvent = {
      occurred_at: new Date().toISOString(),
      ...event,
    };
    await this.pool.query(`
      INSERT INTO device_management_audit_events
        (audit_event_id, account_id, occurred_at, raw_json)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (audit_event_id) DO NOTHING
    `, [auditEvent.audit_event_id, auditEvent.account_id || null, auditEvent.occurred_at, auditEvent]);
    return clone(auditEvent);
  }

  async listAuditEvents(filter = {}) {
    if (filter.account_id) {
      return rows(await this.pool.query(
        "SELECT raw_json FROM device_management_audit_events WHERE account_id=$1 ORDER BY occurred_at",
        [filter.account_id],
      ));
    }
    return rows(await this.pool.query("SELECT raw_json FROM device_management_audit_events ORDER BY occurred_at"));
  }

  async importLegacyState(state, migrationId = "device-management-sqlite-v1") {
    const client = typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      const applied = await client.query(
        "SELECT 1 FROM device_management_migrations WHERE migration_id=$1",
        [migrationId],
      );
      if (applied.rowCount) {
        await client.query("ROLLBACK");
        return { imported: false, reason: "already_applied" };
      }
      const occupied = await client.query(`
        SELECT
          (SELECT count(*) FROM device_management_devices)
          + (SELECT count(*) FROM device_management_credentials)
          + (SELECT count(*) FROM device_management_challenges)
          + (SELECT count(*) FROM device_management_pairing_sessions)
          + (SELECT count(*) FROM device_management_provisioning_tokens)
          + (SELECT count(*) FROM device_management_account_devices)
          + (SELECT count(*) FROM device_management_purchase_contexts)
          + (SELECT count(*) FROM device_management_consents)
          + (SELECT count(*) FROM device_management_audit_events) AS count
      `);
      if (Number(occupied.rows[0]?.count || 0) > 0) {
        throw new Error("Device-Management-PostgreSQL-Ziel ist belegt, aber der Migrationsmarker fehlt.");
      }
      const repository = new PostgresDeviceManagementRepository(client);
      for (const item of state.devices || []) await repository.saveDevice(item);
      for (const item of state.credentials || []) await repository.saveCredential(item.device_id, item);
      for (const item of state.challenges || []) await repository.saveChallenge(item);
      for (const item of state.pairingSessions || []) await repository.savePairingSession(item);
      for (const item of state.provisioningTokens || []) await repository.saveProvisioningToken(item);
      for (const item of state.accountDevices || []) await repository.saveAccountDevice(item);
      for (const item of state.purchaseContexts || []) await repository.savePurchaseContext(item.account_id, item);
      for (const item of state.consents || []) await repository.createConsent(item);
      for (const item of state.auditEvents || []) await repository.addAuditEvent(item);
      await client.query(
        "INSERT INTO device_management_migrations (migration_id) VALUES ($1)",
        [migrationId],
      );
      await client.query("COMMIT");
      return {
        imported: true,
        counts: Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value.length])),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      if (client !== this.pool) client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

function rows(result) {
  return result.rows.map((row) => clone(row.raw_json));
}

function first(result) {
  return result.rows[0] ? clone(result.rows[0].raw_json) : null;
}

function sanitizeCredential(credential) {
  const value = { ...credential };
  for (const field of ["secret", "device_secret", "one_time_device_secret", "secret_sha256"]) delete value[field];
  return value;
}

function clone(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

module.exports = { PostgresDeviceManagementRepository };
