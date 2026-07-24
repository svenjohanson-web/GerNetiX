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
});

test("postgres identity repository writes normalized lookup values and JSON documents", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresIdentityRepository(pool, () => new Date("2026-07-23T10:00:00.000Z"));

  const account = await repository.createUserAccount({
    id: "acct-1",
    username: "Maker-One",
    email: "Maker@Example.COM",
    status: "verified",
  });
  const session = await repository.createSession({
    userId: account.id,
    tokenHash: "hashed-token",
    expiresAt: "2026-07-24T10:00:00.000Z",
  });

  assert.equal(account.email, "maker@example.com");
  assert.equal(pool.calls[0].values[1], "maker-one");
  assert.equal(pool.calls[0].values[2], "maker@example.com");
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

class RecordingPool {
  constructor() {
    this.calls = [];
  }

  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 1 };
  }
}
