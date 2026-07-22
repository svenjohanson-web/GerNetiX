const assert = require("node:assert/strict");
const test = require("node:test");

const { createConfig, createDefaultCommunityPlatform } = require("../src");
const member = { user_id: "user-1" };
const operator = { user_id: "moderator-1", is_operator: true };

function createService() {
  return createDefaultCommunityPlatform(createConfig({ COMMUNITY_TRIAGE_SLA_HOURS: "24" }));
}

test("creates and triages community question with SLA metadata", () => {
  const service = createService();
  const question = service.createQuestion({ title: "ESP32 startet nach Flash nicht", body: "Nach dem Flashen bleibt die serielle Ausgabe leer.", tags: ["esp32", "flash"] }, member);
  const triaged = service.triageQuestion(question.question_id, { triage_status: "needs_expert_answer", priority: "high", triaged_by: "moderator-1" }, operator);

  assert.equal(question.triage_status, "new");
  assert.ok(question.triage_due_at);
  assert.equal(triaged.triage_status, "needs_expert_answer");
  assert.equal(triaged.priority, "high");
});

test("verifies an operator answer and publishes knowledge", () => {
  const service = createService();
  const question = service.createQuestion({ title: "OTA Timeout", body: "OTA bricht ab." }, member);
  const answer = service.createAnswer(question.question_id, { body: "Hostname und Heartbeat pruefen." }, operator);
  const verified = service.verifyAnswer(answer.answer_id, { verified_by: "expert-1" }, operator);
  const fetched = service.getQuestion(question.question_id, member);

  assert.equal(verified.verification_state, "verified");
  assert.equal(fetched.status, "answered");
  assert.equal(fetched.verified_answer_count, 1);
});

test("keeps private requests visible only to the requester and GerNetiX", () => {
  const service = createService();
  const question = service.createQuestion({ title: "Mein Projekt", body: "Bitte persoenlich begleiten.", visibility: "private" }, member);

  assert.equal(service.listQuestions({}, { user_id: "user-2" }).items.some((item) => item.question_id === question.question_id), false);
  assert.equal(service.getQuestion(question.question_id, operator).visibility, "private");
  assert.throws(() => service.getQuestion(question.question_id, { user_id: "user-2" }), /privat/);
});

test("does not let other members alter a reply", () => {
  const service = createService();
  const question = service.createQuestion({ title: "OTA", body: "Hilfe" }, member);
  const answer = service.createAnswer(question.question_id, { body: "Pruefen" }, operator);
  assert.throws(() => service.updateAnswer(answer.answer_id, { body: "Manipuliert" }, { user_id: "user-2" }), /darf nicht/);
});

test("never publishes private guidance into searchable knowledge", () => {
  const service = createService();
  const question = service.createQuestion({ title: "Privates Projekt", body: "Nur fuer mich", visibility: "private" }, member);
  const answer = service.createAnswer(question.question_id, { body: "Persoenliche Antwort" }, operator);
  service.verifyAnswer(answer.answer_id, {}, operator);
  assert.equal(service.search({ q: "Persoenliche" }, { user_id: "user-2" }).items.length, 0);
  assert.equal(service.listKnowledgeDocuments({}, member).items.some((item) => item.question_id === question.question_id), false);
});
