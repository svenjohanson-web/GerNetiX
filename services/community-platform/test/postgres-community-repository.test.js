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
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS community_notification_outbox/);
  assert.match(pool.calls[0].text, /FOR UPDATE SKIP LOCKED|idx_community_notification_outbox_ready/);
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

test("stores a message and its minimized notification event in one PostgreSQL transaction", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresCommunityRepository(pool);
  const now = "2026-08-18T10:00:00.000Z";
  await repository.createMessageThreadBundle({
    thread: { thread_id: "thread-1", thread_kind: "direct", created_by_user_id: "user-1", created_at: now, updated_at: now, archived_at: null },
    members: [{ thread_id: "thread-1", user_id: "user-1", member_role: "owner", joined_at: now }],
    message: { message_id: "message-1", thread_id: "thread-1", author_user_id: "user-1", body: "private", created_at: now },
    inboxEntries: [{ inbox_entry_id: "inbox-1", recipient_user_id: "user-2", entry_kind: "thread", thread_id: "thread-1", state: "unread", created_at: now }],
    outboxEvents: [{ event_id: "event-1", recipient_user_id: "user-2", category: "direct_messages", status: "pending", attempts: 0, next_attempt_at: now, created_at: now, updated_at: now }],
  });

  assert.equal(pool.calls[0].text, "BEGIN");
  assert.match(pool.calls.map((call) => call.text).join("\n"), /INSERT INTO community_notification_outbox/);
  assert.equal(pool.calls.at(-1).text, "COMMIT");
  const outboxCall = pool.calls.find((call) => /INSERT INTO community_notification_outbox/.test(call.text));
  assert.doesNotMatch(JSON.stringify(outboxCall.values), /private/);
});

test("claims notification events with a lease and PostgreSQL skip-locked semantics", async () => {
  const pool = new RecordingPool([{ rows: [] }]);
  await new PostgresCommunityRepository(pool).claimNotificationOutbox({
    now: "2026-08-18T10:00:00.000Z",
    leaseUntil: "2026-08-18T10:01:00.000Z",
    limit: 25,
  });
  assert.match(pool.calls[0].text, /FOR UPDATE SKIP LOCKED/);
  assert.match(pool.calls[0].text, /status='leased'/);
});

test("purges only expired delivered and dead-letter notification rows", async () => {
  const pool = new RecordingPool([{ rows: [{ delivered: 2, dead_letter: 1, total: 3 }] }]);
  const result = await new PostgresCommunityRepository(pool).purgeNotificationOutbox({
    deliveredBefore: "2026-07-19T00:00:00.000Z",
    deadLetterBefore: "2026-05-20T00:00:00.000Z",
  });
  assert.deepEqual(result, { delivered: 2, dead_letter: 1, total: 3 });
  assert.match(pool.calls[0].text, /DELETE FROM community_notification_outbox/);
  assert.match(pool.calls[0].text, /status='delivered'/);
  assert.match(pool.calls[0].text, /status='dead_letter'/);
  assert.deepEqual(pool.calls[0].values, ["2026-07-19T00:00:00.000Z", "2026-05-20T00:00:00.000Z"]);
});

class RecordingPool {
  constructor(results = []) { this.calls = []; this.results = results; }
  async connect() { return this; }
  release() {}
  async query(text, values = []) {
    this.calls.push({ text, values });
    return this.results.shift() || { rows: [], rowCount: 0 };
  }
}
