const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PostgresAiUsageRepository,
} = require("../src/repositories/postgres-ai-usage-repository");
const { createConfig } = require("../src/config");

test("uses the dedicated PostgreSQL database as the runtime default", () => {
  const config = createConfig({});
  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.database, "gernetix_ai_usage");
  assert.equal(config.postgres.user, "gernetix_ai_usage");
});

test("creates normalized AI Usage PostgreSQL tables and the default policy", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresAiUsageRepository(pool);
  await repository.ensureSchema();

  assert.match(pool.calls[0].text, /ai_usage_credit_accounts/);
  assert.match(pool.calls[0].text, /ai_usage_ledger_entries/);
  assert.match(pool.calls[0].text, /ai_usage_events/);
  assert.match(pool.calls[0].text, /ai_usage_admin_audit_events/);
  assert.match(pool.calls[0].text, /ai_usage_migrations/);
  assert.match(pool.calls[1].text, /ai_usage_policy/);
  assert.match(pool.calls[1].text, /DO NOTHING/);
});

test("stores and reads complete AI Usage account documents", async () => {
  const account = { account_id: "acct-1", plan_id: "plan.free", total_granted_credits: 100 };
  const pool = new RecordingPool([{ raw_json: account }]);
  const repository = new PostgresAiUsageRepository(pool);

  await repository.saveCreditAccount(account);
  assert.deepEqual(await repository.findCreditAccount("acct-1"), account);
  assert.equal(pool.calls[0].values[0], "acct-1");
  assert.equal(pool.calls[0].values[2], account);
});

class RecordingPool {
  constructor(rows = []) {
    this.rows = rows;
    this.calls = [];
  }

  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: this.rows, rowCount: this.rows.length };
  }
}
