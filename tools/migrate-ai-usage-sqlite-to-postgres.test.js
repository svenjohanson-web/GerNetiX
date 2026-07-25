const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  readLegacyAiUsageState,
  requiredSecret,
} = require("./migrate-ai-usage-sqlite-to-postgres");

test("reads complete AI Usage documents from the shared legacy SQLite", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ai-usage-migration-")), "legacy.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE service_documents (
      service_key TEXT, collection_name TEXT, document_id TEXT, document_json TEXT
    )
  `);
  db.prepare("INSERT INTO service_documents VALUES (?,?,?,?)").run(
    "ai-usage-server",
    "credit_accounts",
    "acct-1",
    JSON.stringify({ account_id: "acct-1", plan_id: "plan.free" }),
  );
  db.prepare("INSERT INTO service_documents VALUES (?,?,?,?)").run(
    "ai-usage-server",
    "policy",
    "policy",
    JSON.stringify({ document_id: "policy", value: { policy_id: "policy-1" } }),
  );
  db.close();

  const state = readLegacyAiUsageState(sqlitePath);
  assert.equal(state.creditAccounts[0].account_id, "acct-1");
  assert.equal(state.policy.policy_id, "policy-1");
});

test("requires an AI Usage PostgreSQL password", () => {
  assert.throws(() => requiredSecret(""), /AI_USAGE_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});
