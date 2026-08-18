const test = require("node:test");
const assert = require("node:assert/strict");
const { PostgresIdentityRepository } = require("../src/repositories/postgres-identity-repository");

test("postgres identity repository creates its normalized account and session schema", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresIdentityRepository(pool);

  await repository.ensureSchema();

  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS identity_user_accounts/);
  assert.match(pool.calls[0].text, /username_normalized text NOT NULL UNIQUE/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS identity_sessions/);
  assert.match(pool.calls[0].text, /token_hash text NOT NULL UNIQUE/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS identity_knowledge_chapter_reads/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS identity_passkey_credentials/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS identity_support_recovery_transactions/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS identity_notification_deliveries/);
  assert.match(pool.calls[0].text, /PRIMARY KEY \(account_id, chapter_id\)/);
});

test("postgres notification retention deletes only terminal and stale failed delivery records", async () => {
  const pool = new RecordingPool([{ rows: [{ terminal: 2, failed: 1, total: 3 }] }]);
  const result = await new PostgresIdentityRepository(pool).purgeNotificationDeliveries({
    terminalBefore: "2026-07-19T00:00:00.000Z",
    failedBefore: "2026-05-20T00:00:00.000Z",
  });
  assert.deepEqual(result, { terminal: 2, failed: 1, total: 3 });
  assert.match(pool.calls[0].text, /DELETE FROM identity_notification_deliveries/);
  assert.match(pool.calls[0].text, /status IN \('sent', 'skipped'\)/);
  assert.deepEqual(pool.calls[0].values, ["2026-07-19T00:00:00.000Z", "2026-05-20T00:00:00.000Z"]);
});

test("postgres authentication retention uses token expiry and preserves a later support grant expiry", async () => {
  const pool = new RecordingPool([{ rows: [{ verification_tokens: 2, password_reset_tokens: 1, support_recoveries: 1 }] }]);
  const result = await new PostgresIdentityRepository(pool).purgeExpiredAuthenticationRecords({
    tokenBefore: "2026-08-11T00:00:00.000Z",
    supportRecoveryBefore: "2026-07-19T00:00:00.000Z",
  });
  assert.deepEqual(result, { verification_tokens: 2, password_reset_tokens: 1, support_recoveries: 1, total: 4 });
  assert.match(pool.calls[0].text, /DELETE FROM identity_verification_tokens/);
  assert.match(pool.calls[0].text, /DELETE FROM identity_password_reset_tokens/);
  assert.match(pool.calls[0].text, /DELETE FROM identity_support_recovery_transactions/);
  assert.match(pool.calls[0].text, /GREATEST[\s\S]*grant_expires_at/);
  assert.deepEqual(pool.calls[0].values, ["2026-08-11T00:00:00.000Z", "2026-07-19T00:00:00.000Z"]);
});

test("postgres support recovery serializes parallel issuance per account", async () => {
  const calls = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (/SELECT COUNT/.test(text)) return { rows: [{ count: 0 }], rowCount: 1 };
      if (/SELECT 1 FROM identity_support_recovery_transactions/.test(text)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    },
    release() { calls.push({ text: "RELEASE", values: [] }); },
  };
  const repository = new PostgresIdentityRepository({ connect: async () => client }, () => new Date("2026-08-18T12:00:00.000Z"));
  const transaction = await repository.replaceActiveSupportRecovery({
    userId: "acct-1", passwordHash: "hash", expiresAt: "2026-08-18T12:15:00.000Z",
    supportActorId: "support-1", supportActorRole: "support", reason: "verified", actionId: "action-1",
  }, { sinceIso: "2026-08-17T12:00:00.000Z", maximum: 3 });

  assert.equal(transaction.user_id, "acct-1");
  assert.ok(calls.some((call) => /pg_advisory_xact_lock/.test(call.text)));
  assert.ok(calls.some((call) => /SELECT 1 FROM identity_support_recovery_transactions/.test(call.text)));
  assert.ok(calls.some((call) => /INSERT INTO identity_support_recovery_transactions/.test(call.text)));
  assert.ok(calls.some((call) => call.text === "COMMIT"));
});

test("postgres identity repository writes normalized lookup values and JSON documents", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresIdentityRepository(pool, () => new Date("2026-07-23T10:00:00.000Z"));

  const account = await repository.createUserAccount({
    id: "acct-1",
    username: "Maker-One",
    email: "Maker@Example.COM",
    status: "verified",
    preferredLocale: "nl",
    subscriptionPlan: "free",
  });
  const session = await repository.createSession({
    userId: account.id,
    tokenHash: "hashed-token",
    expiresAt: "2026-07-24T10:00:00.000Z",
  });

  assert.equal(account.email, "maker@example.com");
  assert.equal(pool.calls[0].values[1], "maker-one");
  assert.equal(pool.calls[0].values[2], "maker@example.com");
  assert.equal(pool.calls[0].values[4].preferred_locale, "nl");
  assert.equal(pool.calls[0].values[4].subscription_plan, "free");
  assert.equal(pool.calls[0].values[4].plan_valid_until, null);
  assert.equal(pool.calls[0].values[4].last_meaningful_activity_at, "2026-07-23T10:00:00.000Z");
  assert.equal(pool.calls[0].values[4].lifecycle_state, "active");
  assert.equal(pool.calls[1].values[1], "acct-1");
  assert.equal(pool.calls[1].values[2], "hashed-token");
  assert.equal(session.user_id, "acct-1");
});

test("postgres identity repository maps unique account constraints to stable auth errors", async () => {
  const pool = {
    async query() {
      const error = new Error("duplicate");
      error.code = "23505";
      error.constraint = "identity_user_accounts_username_normalized_key";
      throw error;
    },
  };
  const repository = new PostgresIdentityRepository(pool);

  await assert.rejects(
    repository.createUserAccount({ id: "acct-1", username: "maker", email: null, status: "verified" }),
    /USERNAME_ALREADY_EXISTS/,
  );
});

test("postgres identity repository upserts account-bound knowledge chapter read versions", async () => {
  const pool = {
    calls: [],
    async query(text, values = []) {
      this.calls.push({ text, values });
      return {
        rows: [{
          account_id: values[0],
          chapter_id: values[1],
          chapter_version: values[2],
          seen_at: new Date(values[3]),
        }],
        rowCount: 1,
      };
    },
  };
  const repository = new PostgresIdentityRepository(pool, () => new Date("2026-07-24T20:00:00.000Z"));
  const read = await repository.markKnowledgeChapterRead("acct-1", "yaml-basics", "2026-07-24.1");

  assert.equal(read.seen_at, "2026-07-24T20:00:00.000Z");
  assert.match(pool.calls[0].text, /INSERT INTO identity_knowledge_chapter_reads/);
  assert.match(pool.calls[0].text, /ON CONFLICT\(account_id, chapter_id\) DO UPDATE/);
  assert.deepEqual(pool.calls[0].values.slice(0, 3), ["acct-1", "yaml-basics", "2026-07-24.1"]);
});

class RecordingPool {
  constructor(results = []) {
    this.calls = [];
    this.results = results;
  }

  async query(text, values = []) {
    this.calls.push({ text, values });
    return this.results.shift() || { rows: [], rowCount: 1 };
  }
}
