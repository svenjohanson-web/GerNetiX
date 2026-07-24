const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { readLegacyCommunityState, requiredSecret } = require("./migrate-community-sqlite-to-postgres");

test("reads typed Community SQLite documents", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "community-migration-")), "community.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec("CREATE TABLE community_questions (question_id TEXT PRIMARY KEY, raw_json TEXT NOT NULL)");
  db.prepare("INSERT INTO community_questions VALUES (?,?)").run(
    "q1",
    JSON.stringify({ question_id: "q1", author_user_id: "u1", visibility: "private" }),
  );
  db.close();
  const state = readLegacyCommunityState(sqlitePath);
  assert.equal(state.questions[0].question_id, "q1");
});

test("requires a Community PostgreSQL password", () => {
  assert.throws(() => requiredSecret(""), /COMMUNITY_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});
