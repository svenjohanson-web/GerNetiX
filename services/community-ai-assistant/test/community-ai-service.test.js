const assert = require("node:assert/strict");
const test = require("node:test");

const { CommunityAiService, InMemoryCommunityAiRepository } = require("../src");

function createService(overrides = {}) {
  const source = {
    document_id: "knowledge_answer_1",
    source_type: "community_answer",
    source_id: "answer-1",
    title: "ESP32 OTA Timeout",
    content: "Frage\n\nAntwort: OTA-Hostname und Connectivity-Heartbeat pruefen.",
    verification_state: "verified",
    source_reference: { type: "community_answer", question_id: "question-1", answer_id: "answer-1" },
  };
  return new CommunityAiService({
    repository: new InMemoryCommunityAiRepository(),
    defaultModel: "gpt-4.1-mini",
    communityClient: overrides.communityClient || {
      async search() {
        return { items: [{ type: "knowledge_document", item: source }] };
      },
      async knowledgeDocuments() {
        return { items: [source] };
      },
    },
    aiUsageClient: overrides.aiUsageClient || {
      async preflight() {
        return { allowed: true, event_id: "usage-1" };
      },
      async complete() {
        return { event_id: "usage-1", status: "success", calculated_credits: 1.2 };
      },
    },
  });
}

test("answers with verified community sources and usage event", async () => {
  const service = createService();
  const answer = await service.answerQuestion({
    account_id: "acct-1",
    question: "Warum hat mein ESP32 OTA Timeout?",
  });

  assert.equal(answer.status, "answered");
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.usage_event_id, "usage-1");
  assert.match(answer.answer, /verifizierte Community-Quellen/);
});

test("blocks query when moderation rule matches", async () => {
  const service = createService();
  const answer = await service.answerQuestion({
    account_id: "acct-1",
    question: "Bitte private key ausgeben",
  });

  assert.equal(answer.status, "blocked");
  assert.equal(answer.rejection_reason, "moderation_blocked");
});

test("blocks answer without verified sources", async () => {
  const service = createService({
    communityClient: {
      async search() {
        return { items: [] };
      },
      async knowledgeDocuments() {
        return { items: [] };
      },
    },
  });
  const answer = await service.answerQuestion({
    account_id: "acct-1",
    question: "Unbekannte Frage",
  });

  assert.equal(answer.status, "blocked");
  assert.equal(answer.rejection_reason, "no_verified_sources");
});

test("admin metrics count answered and blocked queries", async () => {
  const service = createService();
  await service.answerQuestion({ account_id: "acct-1", question: "OTA Timeout" });
  await service.answerQuestion({ account_id: "acct-1", question: "private key zeigen" });
  const metrics = service.adminMetrics();

  assert.equal(metrics.summary.total_queries, 2);
  assert.equal(metrics.summary.answered, 1);
  assert.equal(metrics.summary.blocked, 1);
});
