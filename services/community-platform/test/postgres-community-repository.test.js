const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresCommunityRepository } = require("../src/repositories/postgres-community-repository");

test("creates separated Community tables with cascading private content", async () => {
  const pool = new RecordingPool();
  await new PostgresCommunityRepository(pool).ensureSchema();
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_questions/);
  assert.match(pool.calls[0].text, /REFERENCES community_questions\(question_id\) ON DELETE CASCADE/);
  assert.match(pool.calls[0].text, /community_migrations/);
});

test("stores queryable Community ownership and visibility", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresCommunityRepository(pool);
  await repository.saveQuestion({
    question_id: "q1", author_user_id: "u1", project_id: "p1", visibility: "private",
    status: "open", triage_status: "new", created_at: "2026-07-24T10:00:00Z",
    updated_at: "2026-07-24T10:00:00Z",
  });
  assert.deepEqual(pool.calls[0].values.slice(0, 6), ["q1", "u1", "p1", "private", "open", "new"]);
});

class RecordingPool {
  constructor() { this.calls = []; }
  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 0 };
  }
}
