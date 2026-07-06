const assert = require("node:assert/strict");
const test = require("node:test");

const { createConfig, createDefaultCommunityPlatform } = require("../src");

function createService() {
  return createDefaultCommunityPlatform(createConfig({ COMMUNITY_TRIAGE_SLA_HOURS: "24" }));
}

test("creates and triages community question with SLA metadata", () => {
  const service = createService();
  const question = service.createQuestion({
    title: "ESP32 startet nach Flash nicht",
    body: "Nach dem Flashen bleibt die serielle Ausgabe leer.",
    author_user_id: "user-1",
    tags: ["esp32", "flash"],
  });
  const triaged = service.triageQuestion(question.question_id, {
    triage_status: "needs_expert_answer",
    priority: "high",
    triaged_by: "moderator-1",
  });

  assert.equal(question.triage_status, "new");
  assert.ok(question.triage_due_at);
  assert.equal(triaged.triage_status, "needs_expert_answer");
  assert.equal(triaged.priority, "high");
});

test("verifies answer and publishes knowledge document", () => {
  const service = createService();
  const question = service.createQuestion({ title: "OTA Timeout", body: "OTA bricht ab." });
  const answer = service.createAnswer(question.question_id, { body: "Hostname und Heartbeat pruefen." });
  const verified = service.verifyAnswer(answer.answer_id, { verified_by: "expert-1" });
  const fetched = service.getQuestion(question.question_id);
  const documents = service.listKnowledgeDocuments({ verification_state: "verified" });

  assert.equal(verified.verification_state, "verified");
  assert.equal(fetched.status, "answered");
  assert.equal(fetched.verified_answer_count, 1);
  assert.equal(documents.items.some((document) => document.source_id === answer.answer_id), true);
});

test("changing verified answer requires reverification", () => {
  const service = createService();
  const question = service.createQuestion({ title: "WLAN Problem", body: "Board offline." });
  const answer = service.createAnswer(question.question_id, { body: "SSID pruefen." });
  service.verifyAnswer(answer.answer_id, { verified_by: "expert-1" });
  const changed = service.updateAnswer(answer.answer_id, { body: "SSID und AP-Modus pruefen." });

  assert.equal(changed.verification_state, "requires_reverification");
  assert.equal(changed.needs_reverification, true);
});

test("search returns questions answers and knowledge documents", () => {
  const service = createService();
  const result = service.search({ q: "OTA" });

  assert.equal(result.items.length > 0, true);
  assert.equal(result.items.some((item) => item.type === "knowledge_document"), true);
});
