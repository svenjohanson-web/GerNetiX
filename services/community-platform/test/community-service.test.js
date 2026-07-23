const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createConfig, createDefaultCommunityPlatform, createHttpApp } = require("../src");
const member = { user_id: "user-1" };
const operator = { user_id: "moderator-1", is_operator: true };

function createService() {
  return createDefaultCommunityPlatform(createConfig({ COMMUNITY_TRIAGE_SLA_HOURS: "24", COMMUNITY_PERSISTENCE_BACKEND: "memory" }));
}

test("uses a separate SQLite database by default and retains questions after a restart", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-community-"));
  const sqlitePath = path.join(temporaryDirectory, "community.sqlite");
  try {
    const config = createConfig({ COMMUNITY_SQLITE_PATH: sqlitePath });
    assert.equal(config.persistenceBackend, "sqlite");
    assert.equal(config.sqlitePath, sqlitePath);

    const firstService = createDefaultCommunityPlatform(config);
    const created = firstService.createQuestion({ title: "Dauerhafte Anfrage", body: "Soll nach dem Neustart bleiben." }, member);
    firstService.repository.store.close();

    const restartedService = createDefaultCommunityPlatform(config);
    assert.equal(restartedService.getQuestion(created.question_id, member).title, "Dauerhafte Anfrage");
    restartedService.repository.store.close();
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

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

test("lists only the requesting member's public and private questions when mine is requested", () => {
  const service = createService();
  const ownPublic = service.createQuestion({ title: "Mein öffentliches Projekt", body: "Öffentliche Frage" }, member);
  const ownPrivate = service.createQuestion({ title: "Mein privates Projekt", body: "Private Frage", visibility: "private" }, member);
  service.createQuestion({ title: "Fremdes öffentliches Projekt", body: "Andere Frage" }, { user_id: "user-2" });

  const items = service.listQuestions({ mine: "true" }, member).items;

  assert.deepEqual(new Set(items.map((item) => item.question_id)), new Set([ownPublic.question_id, ownPrivate.question_id]));
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

test("reports content-free operational counts for admin monitoring", () => {
  const service = createService();
  service.createQuestion({ title: "Öffentliche Anfrage", body: "Öffentlicher Inhalt" }, member);
  service.createQuestion({ title: "Private Anfrage", body: "Privater Inhalt", visibility: "private" }, member);

  const summary = service.operationsSummary();

  assert.equal(summary.persistence_backend, "memory");
  assert.equal(summary.questions.total, 3);
  assert.equal(summary.questions.public, 2);
  assert.equal(summary.questions.private, 1);
  assert.equal(summary.answers.total, 1);
  assert.equal(summary.knowledge_documents.total, 1);
  assert.doesNotMatch(JSON.stringify(summary), /Öffentlicher Inhalt|Privater Inhalt|user-1/);
});

test("protects the operational summary with the internal Community token", async () => {
  const service = createDefaultCommunityPlatform(createConfig({
    COMMUNITY_PERSISTENCE_BACKEND: "memory",
    COMMUNITY_INTERNAL_TOKEN: "internal-secret",
  }));
  const app = createHttpApp({ service });

  const denied = await requestJson(app, "/api/community/operations-summary");
  const allowed = await requestJson(app, "/api/community/operations-summary", {
    "x-gernetix-community-token": "internal-secret",
  });

  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.questions.total, 1);
  assert.doesNotMatch(JSON.stringify(allowed.body), /internal-secret|seed-expert/);
});

async function requestJson(app, url, headers = {}) {
  let status = 0;
  let body = "";
  await app({ method: "GET", url, headers: { host: "localhost", ...headers } }, {
    writeHead(code) { status = code; },
    end(value) { body = value || ""; },
  });
  return { status, body: JSON.parse(body) };
}
