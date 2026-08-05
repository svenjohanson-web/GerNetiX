const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresCommunityRepository } = require("../src/repositories/postgres-community-repository");

test("creates separated Community tables with cascading private content", async () => {
  const pool = new RecordingPool();
  await new PostgresCommunityRepository(pool).ensureSchema();
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_questions/);
  assert.match(pool.calls[0].text, /REFERENCES community_questions\(question_id\) ON DELETE CASCADE/);
  assert.match(pool.calls[0].text, /community_migrations/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_message_threads/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_message_thread_members/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_messages/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_inbox_entries/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_broadcasts/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_message_blocks/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_message_reports/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_marketplace_listings/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_project_ideas/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_project_idea_comments/);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_project_showcases/);
  assert.match(pool.calls[0].text, /REFERENCES community_project_ideas\(idea_id\) ON DELETE CASCADE/);
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

test("aggregates the account dashboard summary in SQL without loading content rows", async () => {
  const pool = new RecordingPool([
    { rows: [{ total: 3, public_open: 1, public_closed: 1, private_open: 1, private_closed: 0 }] },
    { rows: [{ threads: 2, unread: 1 }] },
  ]);
  const repository = new PostgresCommunityRepository(pool);

  const summary = await repository.dashboardSummary("account-1");

  assert.deepEqual(summary, {
    questions: {
      total: 3,
      public: { open: 1, closed: 1 },
      private: { open: 1, closed: 0 },
    },
    messages: { unread: 1, threads: 2 },
  });
  assert.equal(pool.calls.length, 2);
  assert.deepEqual(pool.calls.map((call) => call.values), [["account-1"], ["account-1"]]);
  assert.match(pool.calls[0].text, /COUNT\(\*\).*FILTER/s);
  assert.doesNotMatch(pool.calls[0].text, /raw_json/);
  assert.match(pool.calls[1].text, /COUNT\(DISTINCT m\.thread_id\)/);
  assert.doesNotMatch(pool.calls[1].text, /raw_json|community_messages/);
});

class RecordingPool {
  constructor(results = []) { this.calls = []; this.results = results; }
  async query(text, values = []) {
    this.calls.push({ text, values });
    return this.results.shift() || { rows: [], rowCount: 0 };
  }
}
