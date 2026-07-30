const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { Readable } = require("node:stream");

const { createConfig, createDefaultCommunityPlatform, createHttpApp } = require("../src");
const member = { user_id: "user-1" };
const operator = { user_id: "moderator-1", is_operator: true };

async function createService() {
  return createDefaultCommunityPlatform(createConfig({ COMMUNITY_TRIAGE_SLA_HOURS: "24", COMMUNITY_PERSISTENCE_BACKEND: "memory" }));
}

test("uses a separate SQLite database by default and retains questions after a restart", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-community-"));
  const sqlitePath = path.join(temporaryDirectory, "community.sqlite");
  try {
    const config = createConfig({ COMMUNITY_SQLITE_PATH: sqlitePath });
    assert.equal(config.persistenceBackend, "sqlite");
    assert.equal(config.sqlitePath, sqlitePath);

    const firstService = await createDefaultCommunityPlatform(config);
    const created = await firstService.createQuestion({ title: "Dauerhafte Anfrage", body: "Soll nach dem Neustart bleiben." }, member);
    firstService.repository.store.close();

    const restartedService = await createDefaultCommunityPlatform(config);
    assert.equal((await restartedService.getQuestion(created.question_id, member)).title, "Dauerhafte Anfrage");
    restartedService.repository.store.close();
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("retains private message threads and read state after a SQLite restart", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-community-messages-"));
  const sqlitePath = path.join(temporaryDirectory, "community.sqlite");
  try {
    const config = createConfig({ COMMUNITY_SQLITE_PATH: sqlitePath });
    const firstService = await createDefaultCommunityPlatform(config);
    const thread = await firstService.createDirectThread({
      recipient_user_id: "user-2",
      sender_label: "Ada",
      subject: "Dauerhafte Unterhaltung",
      body: "Bleibt diese Nachricht erhalten?",
    }, member);
    await firstService.appendThreadMessage(
      thread.thread_id,
      { sender_label: "Bob", body: "Ja, auch nach einem Neustart." },
      { user_id: "user-2" },
    );
    await firstService.markThreadRead(thread.thread_id, member);
    firstService.repository.store.close();

    const restartedService = await createDefaultCommunityPlatform(config);
    const conversation = await restartedService.getMessageThread(thread.thread_id, member);
    assert.deepEqual(
      conversation.messages.map((message) => message.body),
      ["Bleibt diese Nachricht erhalten?", "Ja, auch nach einem Neustart."],
    );
    assert.equal((await restartedService.listMessageThreads(member)).unread_count, 0);
    assert.equal((await restartedService.listMessageThreads({ user_id: "user-2" })).unread_count, 1);
    await assert.rejects(
      restartedService.getMessageThread(thread.thread_id, { user_id: "user-3" }),
      /nicht zugreifbar/,
    );
    restartedService.repository.store.close();
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("creates and triages community question with SLA metadata", async () => {
  const service = await createService();
  const question = await service.createQuestion({ title: "ESP32 startet nach Flash nicht", body: "Nach dem Flashen bleibt die serielle Ausgabe leer.", tags: ["esp32", "flash"] }, member);
  const triaged = await service.triageQuestion(question.question_id, { triage_status: "needs_expert_answer", priority: "high", triaged_by: "moderator-1" }, operator);

  assert.equal(question.triage_status, "new");
  assert.ok(question.triage_due_at);
  assert.equal(triaged.triage_status, "needs_expert_answer");
  assert.equal(triaged.priority, "high");
});

test("verifies an operator answer and publishes knowledge", async () => {
  const service = await createService();
  const question = await service.createQuestion({ title: "OTA Timeout", body: "OTA bricht ab." }, member);
  const answer = await service.createAnswer(question.question_id, { body: "Hostname und Heartbeat pruefen." }, operator);
  const verified = await service.verifyAnswer(answer.answer_id, { verified_by: "expert-1" }, operator);
  const fetched = await service.getQuestion(question.question_id, member);

  assert.equal(verified.verification_state, "verified");
  assert.equal(fetched.status, "answered");
  assert.equal(fetched.verified_answer_count, 1);
});

test("keeps private requests visible only to the requester and GerNetiX", async () => {
  const service = await createService();
  const question = await service.createQuestion({ title: "Mein Projekt", body: "Bitte persoenlich begleiten.", visibility: "private" }, member);

  assert.equal((await service.listQuestions({}, { user_id: "user-2" })).items.some((item) => item.question_id === question.question_id), false);
  assert.equal((await service.getQuestion(question.question_id, operator)).visibility, "private");
  await assert.rejects(service.getQuestion(question.question_id, { user_id: "user-2" }), /privat/);
});

test("keeps an explicitly attached project copy immutable and bounded for a public community question", async () => {
  const service = await createService();
  const question = await service.createQuestion({
    title: "Mein Taster reagiert nicht",
    body: "Wo liegt der Fehler?",
    project_id: "",
    project_snapshot: {
      snapshot_id: "snapshot-1",
      project_title: "Taster",
      sources: [{ path: "src/main.cpp", content: "const char* password = [ENTFERNT];" }],
    },
  }, member);

  const visible = await service.getQuestion(question.question_id, { user_id: "user-2" });
  assert.equal(visible.project_id, "");
  assert.equal(visible.project_snapshot.project_title, "Taster");
  assert.deepEqual(visible.project_snapshot.sources.map((source) => source.path), ["src/main.cpp"]);
  assert.equal(visible.project_snapshot.sources[0].content, "const char* password = [ENTFERNT];");
});

test("lists only the requesting member's public and private questions when mine is requested", async () => {
  const service = await createService();
  const ownPublic = await service.createQuestion({ title: "Mein öffentliches Projekt", body: "Öffentliche Frage" }, member);
  const ownPrivate = await service.createQuestion({ title: "Mein privates Projekt", body: "Private Frage", visibility: "private" }, member);
  await service.createQuestion({ title: "Fremdes öffentliches Projekt", body: "Andere Frage" }, { user_id: "user-2" });

  const items = (await service.listQuestions({ mine: "true" }, member)).items;

  assert.deepEqual(new Set(items.map((item) => item.question_id)), new Set([ownPublic.question_id, ownPrivate.question_id]));
});

test("does not let other members alter a reply", async () => {
  const service = await createService();
  const question = await service.createQuestion({ title: "OTA", body: "Hilfe" }, member);
  const answer = await service.createAnswer(question.question_id, { body: "Pruefen" }, operator);
  await assert.rejects(service.updateAnswer(answer.answer_id, { body: "Manipuliert" }, { user_id: "user-2" }), /darf nicht/);
});

test("delivers a direct message only to its recipient and tracks unread state", async () => {
  const service = await createService();
  const message = await service.sendDirectMessage({ recipient_user_id: "user-2", sender_label: "Ada", body: "Hallo" }, member);
  assert.equal((await service.listInbox({ user_id: "user-2" })).unread_count, 1);
  assert.equal((await service.listInbox({ user_id: "user-3" })).items.length, 0);
  await service.markInboxRead(message.inbox_item_id, { user_id: "user-2" });
  assert.equal((await service.listInbox({ user_id: "user-2" })).unread_count, 0);
});

test("creates private message threads with replies and isolated read state", async () => {
  const service = await createService();
  const thread = await service.createDirectThread({
    recipient_user_id: "user-2", sender_label: "Ada", subject: "Projekt", body: "Hallo",
  }, member);

  assert.equal((await service.listMessageThreads({ user_id: "user-2" })).unread_count, 1);
  await assert.rejects(
    service.getMessageThread(thread.thread_id, { user_id: "user-3" }),
    /nicht zugreifbar/,
  );
  await service.appendThreadMessage(thread.thread_id, { sender_label: "Bob", body: "Antwort" }, { user_id: "user-2" });
  const visible = await service.getMessageThread(thread.thread_id, member);
  assert.deepEqual(visible.messages.map((message) => message.body), ["Hallo", "Antwort"]);
  await service.markThreadRead(thread.thread_id, member);
  assert.equal((await service.listMessageThreads(member)).unread_count, 0);
});

test("blocks delivery in both directions and allows unblocking", async () => {
  const service = await createService();
  await service.blockMessageUser({ blocked_user_id: "user-2" }, member);
  await assert.rejects(
    service.createDirectThread({ recipient_user_id: "user-2", body: "Nicht zustellen" }, member),
    /keine Nachrichten zugestellt/,
  );
  await assert.rejects(
    service.createDirectThread({ recipient_user_id: "user-1", body: "Auch nicht zurück" }, { user_id: "user-2" }),
    /keine Nachrichten zugestellt/,
  );
  assert.equal((await service.listMessageBlocks(member)).items.length, 1);
  await service.unblockMessageUser("user-2", member);
  assert.equal((await service.createDirectThread({ recipient_user_id: "user-2", body: "Jetzt wieder" }, member)).thread_kind, "direct");
});

test("lets participants report a concrete message and rejects outsiders", async () => {
  const service = await createService();
  const thread = await service.createDirectThread({ recipient_user_id: "user-2", body: "Problematisch" }, member);
  const report = await service.reportMessage(thread.thread_id, thread.latest_message.message_id, { reason: "Unerwünschter Inhalt" }, { user_id: "user-2" });
  assert.equal(report.status, "open");
  await assert.rejects(
    service.reportMessage(thread.thread_id, thread.latest_message.message_id, { reason: "Fremd" }, { user_id: "user-3" }),
    /nicht zugreifbar/,
  );
});

test("limits message volume per account and time window", async () => {
  const service = await createDefaultCommunityPlatform(createConfig({
    COMMUNITY_PERSISTENCE_BACKEND: "memory",
    COMMUNITY_MESSAGE_RATE_LIMIT: "1",
    COMMUNITY_MESSAGE_RATE_WINDOW_SECONDS: "600",
  }));
  const thread = await service.createDirectThread({ recipient_user_id: "user-2", body: "Erste Nachricht" }, member);
  await assert.rejects(
    service.appendThreadMessage(thread.thread_id, { body: "Zu schnell" }, member),
    (error) => error.code === "message_rate_limited" && error.status === 429,
  );
});

test("routes private support requests into the configured support mailbox", async () => {
  const service = await createDefaultCommunityPlatform(createConfig({
    COMMUNITY_PERSISTENCE_BACKEND: "memory",
    COMMUNITY_SUPPORT_USER_IDS: "support-1,support-2",
  }));
  const thread = await service.createSupportRequest({ subject: "Board startet nicht", body: "Bitte prüfen." }, member);
  assert.equal(thread.mailbox_kind, "support");
  assert.equal((await service.listMessageThreads({ user_id: "support-1" })).unread_count, 1);
  assert.equal((await service.getMessageThread(thread.thread_id, { user_id: "support-2" })).messages[0].body, "Bitte prüfen.");
  await assert.rejects(service.getMessageThread(thread.thread_id, { user_id: "user-3" }), /nicht zugreifbar/);
});

test("archives threads per member and soft-deletes only own messages", async () => {
  const service = await createService();
  const thread = await service.createDirectThread({ recipient_user_id: "user-2", body: "Entfernen" }, member);
  await service.archiveMessageThread(thread.thread_id, member);
  assert.equal((await service.listMessageThreads(member)).items.length, 0);
  assert.equal((await service.listMessageThreads(member, { folder: "archived" })).items.length, 1);
  assert.equal((await service.listMessageThreads({ user_id: "user-2" })).items.length, 1);
  await service.restoreMessageThread(thread.thread_id, member);
  await assert.rejects(service.deleteThreadMessage(thread.thread_id, thread.latest_message.message_id, { user_id: "user-2" }), /nicht löschen/);
  await service.deleteThreadMessage(thread.thread_id, thread.latest_message.message_id, member);
  assert.equal((await service.getMessageThread(thread.thread_id, member)).messages.length, 0);
});

test("lets operators review and resolve message reports", async () => {
  const service = await createService();
  const thread = await service.createDirectThread({ recipient_user_id: "user-2", body: "Melden" }, member);
  const report = await service.reportMessage(thread.thread_id, thread.latest_message.message_id, { reason: "Prüfen" }, { user_id: "user-2" });
  await assert.rejects(service.listMessageReports({}, member), /vorbehalten/);
  assert.equal((await service.listMessageReports({}, operator)).items.length, 1);
  const resolved = await service.resolveMessageReport(report.report_id, { resolution_note: "Geprüft" }, operator);
  assert.equal(resolved.status, "resolved");
  assert.equal((await service.listMessageReports({}, operator)).items.length, 0);
});

test("limits broadcasts to operators and keeps project invitations structured", async () => {
  const service = await createService();
  await assert.rejects(service.createBroadcast({ recipient_user_ids: ["user-2"], subject: "Neu", body: "Info" }, member), /vorbehalten/);
  await service.createBroadcast({ recipient_user_ids: ["user-2"], subject: "Neu", body: "Info" }, operator);
  const invitation = await service.createProjectInvitation({ recipient_user_id: "user-2", project_id: "project-1", role: "collaborate" }, member);
  const inbox = await service.listInbox({ user_id: "user-2" });
  assert.equal(inbox.items.some((item) => item.type === "broadcast"), true);
  assert.deepEqual(invitation.action, { project_id: "project-1", role: "collaborate", status: "pending" });
});

test("never publishes private guidance into searchable knowledge", async () => {
  const service = await createService();
  const question = await service.createQuestion({ title: "Privates Projekt", body: "Nur fuer mich", visibility: "private" }, member);
  const answer = await service.createAnswer(question.question_id, { body: "Persoenliche Antwort" }, operator);
  await service.verifyAnswer(answer.answer_id, {}, operator);
  assert.equal((await service.search({ q: "Persoenliche" }, { user_id: "user-2" })).items.length, 0);
  assert.equal((await service.listKnowledgeDocuments({}, member)).items.some((item) => item.question_id === question.question_id), false);
});

test("reports content-free operational counts for admin monitoring", async () => {
  const service = await createService();
  await service.createQuestion({ title: "Öffentliche Anfrage", body: "Öffentlicher Inhalt" }, member);
  await service.createQuestion({ title: "Private Anfrage", body: "Privater Inhalt", visibility: "private" }, member);

  const summary = await service.operationsSummary();

  assert.equal(summary.persistence_backend, "memory");
  assert.equal(summary.questions.total, 3);
  assert.equal(summary.questions.public, 2);
  assert.equal(summary.questions.private, 1);
  assert.equal(summary.answers.total, 1);
  assert.equal(summary.knowledge_documents.total, 1);
  assert.doesNotMatch(JSON.stringify(summary), /Öffentlicher Inhalt|Privater Inhalt|user-1/);
});

test("protects the operational summary with the internal Community token", async () => {
  const service = await createDefaultCommunityPlatform(createConfig({
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

test("advertises support for immutable project copies", async () => {
  const service = await createService();
  const app = createHttpApp({ service });

  const response = await requestJson(app, "/api/community/capabilities");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { project_snapshot_attachment: true });
});

test("exposes thread creation, replies and read state through the Community HTTP contract", async () => {
  const app = createHttpApp({ service: await createService() });
  const senderHeaders = { "x-gernetix-community-actor": "user-1" };
  const recipientHeaders = { "x-gernetix-community-actor": "user-2" };

  const created = await requestAppJson(app, "POST", "/api/community/message-threads", {
    headers: senderHeaders,
    body: { recipient_user_id: "user-2", sender_label: "Ada", subject: "Projekt", body: "Hallo" },
  });
  assert.equal(created.status, 201);

  const replied = await requestAppJson(app, "POST", `/api/community/message-threads/${created.body.thread_id}/messages`, {
    headers: recipientHeaders,
    body: { sender_label: "Bob", body: "Antwort" },
  });
  assert.equal(replied.status, 201);

  const inbox = await requestAppJson(app, "GET", "/api/community/message-threads", { headers: senderHeaders });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.body.unread_count, 1);
  assert.equal(inbox.body.items[0].message_count, 2);

  const read = await requestAppJson(app, "POST", `/api/community/message-threads/${created.body.thread_id}/read`, {
    headers: senderHeaders,
  });
  assert.equal(read.status, 200);
  assert.equal(read.body.state, "read");
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

async function requestAppJson(app, method, url, options = {}) {
  let status = 0;
  let responseBody = "";
  const requestBody = options.body === undefined ? "" : JSON.stringify(options.body);
  const req = Readable.from(requestBody ? [requestBody] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost", ...(options.headers || {}) };
  await app(req, {
    writeHead(code) { status = code; },
    end(value) { responseBody = value || ""; },
  });
  return { status, body: responseBody ? JSON.parse(responseBody) : null };
}
