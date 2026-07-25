const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresStateStore } = require("../persistence/postgres-state-store");

class FakePool {
  constructor() { this.rows = new Map(); }
  async query(sql, values = []) {
    if (/SELECT state_json,state_ciphertext/.test(sql)) {
      const row = this.rows.get(values[0]);
      return { rows: row ? [row] : [] };
    }
    if (/INSERT INTO runtime_state_documents/.test(sql)) {
      this.rows.set(values[0], { state_json: values[1], state_ciphertext: values[2] });
    }
    return { rows: [], rowCount: 0 };
  }
  async end() {}
}

test("encrypts secret runtime state in PostgreSQL and restores it", async () => {
  const pool = new FakePool();
  const encryptionKey = Buffer.alloc(32, 5).toString("base64");
  const store = await PostgresStateStore.create({
    pool,
    namespace: "llm-routing-config",
    defaultState: { config: null },
    encryptionKey,
  });
  await store.save({ config: { apiKey: "secret" } });

  const persisted = pool.rows.get("llm-routing-config");
  assert.equal(persisted.state_json, null);
  assert.ok(persisted.state_ciphertext);
  assert.doesNotMatch(persisted.state_ciphertext, /secret/);

  const reopened = await PostgresStateStore.create({
    pool,
    namespace: "llm-routing-config",
    defaultState: { config: null },
    encryptionKey,
  });
  assert.deepEqual(reopened.load(), { config: { apiKey: "secret" } });
});
