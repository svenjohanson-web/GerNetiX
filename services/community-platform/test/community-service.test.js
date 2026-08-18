const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { Readable } = require("node:stream");

const { createConfig, createDefaultCommunityPlatform, createHttpApp } = require("../src");
const member = { user_id: "user-1" };
const operator = { user_id: "moderator-1", is_operator: true };
const supportAdmin = { actor_id: "admin-support-1", is_admin: true, capabilities: ["admin_community_support"] };
const moderationAdmin = { actor_id: "admin-moderator-1", is_admin: true, capabilities: ["admin_community_moderation"] };

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
    assert.deepEqual((await restartedService.dashboardSummary(member)).messages, { unread: 0, threads: 1 });
    assert.deepEqual((await restartedService.dashboardSummary({ user_id: "user-2" })).messages, { unread: 1, threads: 1 });
    await assert.rejects(
      restartedService.getMessageThread(thread.thread_id, { user_id: "user-3" }),
      /nicht zugreifbar/,
    );
    restartedService.repository.store.close();
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("persists only minimized personal notification events across a SQLite restart", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-community-notification-outbox-"));
  const sqlitePath = path.join(temporaryDirectory, "community.sqlite");
  try {
    const config = createConfig({ COMMUNITY_SQLITE_PATH: sqlitePath });
    const firstService = await createDefaultCommunityPlatform(config);
    await firstService.createDirectThread({
      recipient_user_id: "user-2",
      sender_label: "Ada",
      subject: "Privater Betreff",
      body: "Sehr privater Nachrichtentext",
    }, member);
    firstService.repository.store.close();

    const restartedService = await createDefaultCommunityPlatform(config);
    const claimed = await restartedService.claimNotificationOutbox({ limit: 10, lease_seconds: 60 });
    assert.equal(claimed.events.length, 1);
    assert.deepEqual(Object.keys(claimed.events[0]).sort(), ["attempts", "category", "event_id", "recipient_user_id"]);
    assert.equal(claimed.events[0].recipient_user_id, "user-2");
    assert.equal(claimed.events[0].category, "direct_messages");
    assert.doesNotMatch(JSON.stringify(claimed), /Privater Betreff|Sehr privater Nachrichtentext|Ada/);

    await restartedService.completeNotificationOutbox(claimed.events[0].event_id, { outcome: "sent" });
    assert.equal((await restartedService.claimNotificationOutbox({ limit: 10 })).events.length, 0);
    restartedService.repository.store.close();
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("creates reply and invitation outbox events with bounded retry and dead-letter state", async () => {
  const service = await createService();
  const thread = await service.createDirectThread({ recipient_user_id: "user-2", body: "Hallo" }, member);
  const initial = await service.claimNotificationOutbox({ limit: 10 });
  await service.completeNotificationOutbox(initial.events[0].event_id, { outcome: "skipped" });
  await service.appendThreadMessage(thread.thread_id, { body: "Antwort" }, { user_id: "user-2" });
  await service.createProjectInvitation({ recipient_user_id: "user-3", project_id: "project-1" }, member);

  const claimed = await service.claimNotificationOutbox({ limit: 10 });
  assert.deepEqual(claimed.events.map((event) => event.category).sort(), ["project_invitations", "thread_replies"]);
  const reply = claimed.events.find((event) => event.category === "thread_replies");
  await service.retryNotificationOutbox(reply.event_id, { attempts: reply.attempts, error_code: "identity unavailable\nprivate detail" });
  const stored = service.repository.notificationOutbox.get(reply.event_id);
  assert.equal(stored.status, "retry");
  assert.equal(stored.last_error_code, "identity_unavailable_private_detail");
  assert.equal(stored.lease_until, null);
  for (let attempt = 2; attempt <= 8; attempt += 1) {
    service.repository.notificationOutbox.get(reply.event_id).next_attempt_at = "2000-01-01T00:00:00.000Z";
    const retryClaim = (await service.claimNotificationOutbox({ limit: 1 })).events[0];
    await service.retryNotificationOutbox(retryClaim.event_id, { attempts: retryClaim.attempts, error_code: "delivery_failed" });
  }
  assert.equal(service.repository.notificationOutbox.get(reply.event_id).status, "dead_letter");
});

test("notification retention is dormant by default and purges only expired terminal outbox rows when enabled", async () => {
  const dormant = await createService();
  dormant.repository.notificationOutbox.set("old-delivered", {
    event_id: "old-delivered", status: "delivered", delivered_at: "2000-01-01T00:00:00.000Z", updated_at: "2000-01-01T00:00:00.000Z",
  });
  const dormantClaim = await dormant.claimNotificationOutbox();
  assert.equal(dormantClaim.retention.enabled, false);
  assert.equal(dormant.repository.notificationOutbox.has("old-delivered"), true);

  const enabled = await createDefaultCommunityPlatform(createConfig({
    COMMUNITY_PERSISTENCE_BACKEND: "memory",
    COMMUNITY_NOTIFICATION_RETENTION_ENABLED: "1",
    COMMUNITY_NOTIFICATION_DELIVERED_RETENTION_DAYS: "30",
    COMMUNITY_NOTIFICATION_DEAD_LETTER_RETENTION_DAYS: "90",
  }));
  for (const event of [
    { event_id: "old-delivered", status: "delivered", delivered_at: "2000-01-01T00:00:00.000Z", updated_at: "2000-01-01T00:00:00.000Z" },
    { event_id: "old-dead", status: "dead_letter", updated_at: "2000-01-01T00:00:00.000Z" },
    { event_id: "pending", status: "pending", next_attempt_at: "2999-01-01T00:00:00.000Z", created_at: "2000-01-01T00:00:00.000Z", updated_at: "2000-01-01T00:00:00.000Z" },
  ]) enabled.repository.notificationOutbox.set(event.event_id, event);

  const claim = await enabled.claimNotificationOutbox();
  assert.deepEqual(claim.retention, { enabled: true, purged: { delivered: 1, dead_letter: 1, total: 2 } });
  assert.equal(enabled.repository.notificationOutbox.has("pending"), true);
});

test("protects notification outbox leases from regular Community actors", async () => {
  const service = await createDefaultCommunityPlatform(createConfig({
    COMMUNITY_PERSISTENCE_BACKEND: "memory",
    COMMUNITY_INTERNAL_TOKEN: "internal-secret",
  }));
  await service.createDirectThread({ recipient_user_id: "user-2", body: "Hallo" }, member);
  const app = createHttpApp({ service });

  const denied = await requestAppJson(app, "POST", "/api/community/notification-outbox/claim", {
    headers: { "x-gernetix-community-token": "internal-secret", "x-gernetix-community-actor": "user-1" },
    body: {},
  });
  assert.equal(denied.status, 403);
  const claimed = await requestAppJson(app, "POST", "/api/community/notification-outbox/claim", {
    headers: { "x-gernetix-community-token": "internal-secret" }, body: {},
  });
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.events.length, 1);
});

test("retains community marketplace listings after a SQLite restart", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-community-marketplace-"));
  const sqlitePath = path.join(temporaryDirectory, "community.sqlite");
  try {
    const config = createConfig({ COMMUNITY_SQLITE_PATH: sqlitePath });
    const firstService = await createDefaultCommunityPlatform(config);
    const listing = await firstService.createMarketplaceListing({
      title: "ESP32-S3-Board",
      description: "Gebraucht, vollständig funktionsfähig.",
      category: "boards",
      condition: "good",
      price_cents: 1800,
      pickup_location: "Berlin",
      shipping_available: true,
    }, member);
    firstService.repository.store.close();

    const restartedService = await createDefaultCommunityPlatform(config);
    const restored = await restartedService.getMarketplaceListing(listing.listing_id, member);
    assert.equal(restored.title, "ESP32-S3-Board");
    assert.equal(restored.price_cents, 1800);
    assert.equal(restored.condition, "good");
    restartedService.repository.store.close();
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("retains project ideas and their discussion after a SQLite restart", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-community-ideas-"));
  const sqlitePath = path.join(temporaryDirectory, "community.sqlite");
  try {
    const config = createConfig({ COMMUNITY_SQLITE_PATH: sqlitePath });
    const firstService = await createDefaultCommunityPlatform(config);
    const idea = await firstService.createProjectIdea({
      title: "Modulare Pflanzenstation", pitch: "Eine offene Station für verschiedene Sensoren.",
      description: "Module sollen ohne Löten austauschbar sein.", stage: "concept", looking_for: ["feedback", "hardware"],
    }, member);
    await firstService.createProjectIdeaComment(idea.idea_id, { body: "Ich könnte die Steckverbinder testen." }, { user_id: "user-2" });
    firstService.repository.store.close();

    const restartedService = await createDefaultCommunityPlatform(config);
    const restored = await restartedService.getProjectIdea(idea.idea_id, member);
    assert.equal(restored.title, "Modulare Pflanzenstation");
    assert.equal(restored.comments[0].body, "Ich könnte die Steckverbinder testen.");
    restartedService.repository.store.close();
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("retains community project showcases and immutable source copies after a SQLite restart", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-community-showcase-"));
  const sqlitePath = path.join(temporaryDirectory, "community.sqlite");
  try {
    const config = createConfig({ COMMUNITY_SQLITE_PATH: sqlitePath });
    const firstService = await createDefaultCommunityPlatform(config);
    const showcase = await firstService.createProjectShowcase({
      title: "Wetteranzeige", summary: "Eine kompakte Anzeige für Innen- und Außentemperatur.",
      story: "Das Projekt entstand aus einem alten Display.", hardware_items: ["ESP32", "I²C-Display"],
      project_snapshot: { snapshot_id: "showcase-snapshot", project_title: "Wetteranzeige", sources: [{ path: "src/main.cpp", content: "void setup() {}" }] },
    }, member);
    firstService.repository.store.close();

    const restartedService = await createDefaultCommunityPlatform(config);
    const restored = await restartedService.getProjectShowcase(showcase.showcase_id, member);
    assert.equal(restored.hardware_items[1], "I²C-Display");
    assert.deepEqual(restored.project_snapshot.sources.map((source) => source.path), ["src/main.cpp"]);
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

test("publishes used electronics as an unverified community classified listing", async () => {
  const service = await createService();
  const listing = await service.createMarketplaceListing({
    title: "ESP32 und Feuchtesensor",
    description: "Gebrauchtes Set aus einem abgeschlossenen Projekt.",
    category: "bundles",
    condition: "very_good",
    price_cents: 2450,
    pickup_location: "Köln",
    shipping_available: true,
    tags: ["ESP32", "Sensor"],
    author_label: "Ada",
  }, member);

  assert.equal(listing.verification_state, "community_unverified");
  assert.equal(listing.sale_type, "used_electronics");
  assert.equal(listing.price_cents, 2450);
  assert.equal(listing.project_snapshot, undefined);
  const publicItems = await service.listMarketplaceListings({}, { user_id: "user-2" });
  assert.equal(publicItems.items[0].author_label, "Ada");
  assert.equal(publicItems.items[0].pickup_location, "Köln");
  await assert.rejects(
    service.updateMarketplaceListing(listing.listing_id, { state: "sold" }, { user_id: "user-2" }),
    /nicht gefunden/,
  );
  const sold = await service.updateMarketplaceListing(listing.listing_id, { state: "sold" }, member);
  assert.equal(sold.state, "sold");
  assert.equal((await service.listMarketplaceListings({}, { user_id: "user-2" })).items.length, 0);
});

test("publishes project ideas separately from sales and supports public discussion", async () => {
  const service = await createService();
  const idea = await service.createProjectIdea({
    title: "Barrierefreier Löthelfer",
    pitch: "Ein motorisierter Bauteilhalter für Menschen mit eingeschränkter Handbewegung.",
    description: "Der Halter soll über große Tasten positioniert werden.",
    motivation: "Elektronikprojekte sollen zugänglicher werden.",
    stage: "rough_idea",
    looking_for: ["feedback", "collaborators"],
    tags: ["Barrierefreiheit", "Motorik"],
    author_label: "Ada",
  }, member);
  const comment = await service.createProjectIdeaComment(idea.idea_id, { author_label: "Bob", body: "Ich helfe beim Gehäuse." }, { user_id: "user-2" });

  assert.equal(idea.price_cents, undefined);
  assert.equal(comment.author_user_id, undefined);
  const detail = await service.getProjectIdea(idea.idea_id, { user_id: "user-3" });
  assert.equal(detail.comment_count, 1);
  assert.equal(detail.comments[0].author_label, "Bob");
  assert.deepEqual(detail.looking_for, ["feedback", "collaborators"]);
});

test("publishes completed projects separately from ideas and hides the snapshot in lists", async () => {
  const service = await createService();
  const showcase = await service.createProjectShowcase({
    title: "Lötstation-Timer", summary: "Warnt, wenn die Station zu lange eingeschaltet bleibt.",
    story: "Nach mehreren vergessenen Abenden entstand der automatische Timer.",
    hardware_items: ["ESP32-C3", "Relais"], tags: ["Sicherheit"], author_label: "Ada",
    project_snapshot: { snapshot_id: "showcase-1", project_title: "Lötstation-Timer", sources: [{ path: "src/main.cpp", content: "void loop() {}" }] },
  }, member);
  assert.equal(showcase.project_snapshot, undefined);
  assert.equal(showcase.verification_state, "community_unverified");
  const list = await service.listProjectShowcases({}, { user_id: "user-2" });
  assert.equal(list.items[0].source_count, 1);
  const detail = await service.getProjectShowcase(showcase.showcase_id, { user_id: "user-2" });
  assert.equal(detail.project_snapshot.sources[0].content, "void loop() {}");
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

test("allows the separate admin support role to process support requests without becoming an Identity operator", async () => {
  const service = await createService();
  const supportThread = await service.createSupportRequest({ subject: "Board startet nicht", body: "Bitte prüfen." }, member);
  const directThread = await service.createDirectThread({ recipient_user_id: "user-2", body: "Private Direktnachricht" }, member);

  const queue = await service.listAdminSupportThreads(supportAdmin);
  assert.deepEqual(queue.items.map((item) => item.thread_id), [supportThread.thread_id]);
  await assert.rejects(service.getAdminSupportThread(directThread.thread_id, supportAdmin), /Support-Anfrage/);

  const reply = await service.appendAdminSupportMessage(supportThread.thread_id, { body: "Wir schauen uns das an." }, supportAdmin);
  assert.equal(reply.author_label, "GerNetiX Support");
  assert.match(reply.author_user_id, /^admin:/);
  assert.equal((await service.getMessageThread(supportThread.thread_id, member)).messages.at(-1).body, "Wir schauen uns das an.");
  assert.equal((await service.listInbox(member)).unread_count, 1);
  await assert.rejects(service.listAdminSupportThreads(member), /nicht freigegeben/);
});

test("keeps community support and moderation capabilities separate for admin actors", async () => {
  const service = await createService();
  const privateQuestion = await service.createQuestion({ title: "Privates Projekt", body: "Bitte helfen.", visibility: "private" }, member);
  const triaged = await service.triageAdminQuestion(privateQuestion.question_id, { priority: "high" }, supportAdmin);
  assert.equal(triaged.triaged_by, "GerNetiX Support");
  const answer = await service.createAdminAnswer(privateQuestion.question_id, { body: "Bitte die Spannungsversorgung prüfen." }, supportAdmin);
  assert.match(answer.author_user_id, /^admin:/);
  await assert.rejects(service.verifyAdminAnswer(answer.answer_id, {}, supportAdmin), /nicht freigegeben/);
  assert.equal((await service.verifyAdminAnswer(answer.answer_id, {}, moderationAdmin)).verification_state, "verified");

  const thread = await service.createDirectThread({ recipient_user_id: "user-2", body: "Bitte melden" }, member);
  const report = await service.reportMessage(thread.thread_id, thread.latest_message.message_id, { reason: "Prüfen" }, { user_id: "user-2" });
  await assert.rejects(service.listAdminMessageReports(supportAdmin), /nicht freigegeben/);
  const reports = await service.listAdminMessageReports(moderationAdmin);
  assert.equal(reports.items[0].report_id, report.report_id);
  assert.equal(reports.items[0].reported_message.body, "Bitte melden");
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

test("returns a compact dashboard summary scoped to the authenticated member", async () => {
  const service = await createService();
  await service.createQuestion({ title: "Meine offene Frage", body: "Inhalt", visibility: "public" }, member);
  const closed = await service.createQuestion({ title: "Meine erledigte Frage", body: "Inhalt", visibility: "private" }, member);
  await service.repository.saveQuestion({ ...closed, status: "resolved" });
  await service.createQuestion({ title: "Fremde Frage", body: "Fremder Inhalt", visibility: "private" }, { user_id: "user-2" });
  const thread = await service.createDirectThread({
    recipient_user_id: "user-2", sender_label: "Ada", subject: "Projekt", body: "Hallo",
  }, member);
  await service.appendThreadMessage(thread.thread_id, { sender_label: "Bob", body: "Antwort" }, { user_id: "user-2" });

  const summary = await service.dashboardSummary(member);
  const strangerSummary = await service.dashboardSummary({ user_id: "user-3" });

  assert.deepEqual(summary, {
    available: true,
    total: 2,
    public: { open: 1, closed: 0 },
    private: { open: 0, closed: 1 },
    messages: { unread: 1, threads: 1 },
  });
  assert.deepEqual(strangerSummary, {
    available: true,
    total: 0,
    public: { open: 0, closed: 0 },
    private: { open: 0, closed: 0 },
    messages: { unread: 0, threads: 0 },
  });
  assert.doesNotMatch(JSON.stringify(summary), /Inhalt|Fremde Frage|user-2/);
});

test("exposes only the calling member's compact dashboard summary through HTTP", async () => {
  const service = await createService();
  await service.createQuestion({ title: "Nur für mich", body: "Privat", visibility: "private" }, member);
  const app = createHttpApp({ service });

  const owner = await requestJson(app, "/api/community/dashboard-summary", {
    "x-gernetix-community-actor": "user-1",
  });
  const stranger = await requestJson(app, "/api/community/dashboard-summary", {
    "x-gernetix-community-actor": "user-2",
  });

  assert.equal(owner.status, 200);
  assert.equal(owner.body.total, 1);
  assert.equal(stranger.status, 200);
  assert.equal(stranger.body.total, 0);
  assert.deepEqual(Object.keys(owner.body).sort(), ["available", "messages", "private", "public", "total"]);
  assert.doesNotMatch(JSON.stringify(owner.body), /Nur für mich|Privat|user-1/);
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
  assert.deepEqual(response.body, {
    project_snapshot_attachment: true,
    community_marketplace: true,
  });
});

test("exposes used-electronics listings and owner-only sale status through HTTP", async () => {
  const app = createHttpApp({ service: await createService() });
  const ownerHeaders = { "x-gernetix-community-actor": "user-1" };
  const created = await requestAppJson(app, "POST", "/api/community/marketplace/listings", {
    headers: ownerHeaders,
    body: { title: "I²C-Display", description: "Gebraucht und funktionsfähig.", category: "displays", condition: "good", price_cents: 900 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.sale_type, "used_electronics");

  await assert.rejects(
    requestAppJson(app, "PATCH", `/api/community/marketplace/listings/${created.body.listing_id}`, {
      headers: { "x-gernetix-community-actor": "user-2" }, body: { state: "sold" },
    }),
    /nicht gefunden/,
  );
  const sold = await requestAppJson(app, "PATCH", `/api/community/marketplace/listings/${created.body.listing_id}`, {
    headers: ownerHeaders, body: { state: "sold" },
  });
  assert.equal(sold.status, 200);
  assert.equal(sold.body.state, "sold");
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

test("protects the separate Community admin API with its own token and capability actor", async () => {
  const service = await createService();
  service.adminToken = "community-admin-secret";
  const app = createHttpApp({ service });
  const thread = await service.createSupportRequest({ subject: "Admin HTTP", body: "Bitte öffnen" }, member);
  const actor = Buffer.from(JSON.stringify({ actor_id: "admin-1", role: "support", capabilities: ["admin_community_support"] })).toString("base64url");

  const denied = await requestAppJson(app, "GET", "/api/community/admin/support-threads");
  assert.equal(denied.status, 401);
  const allowed = await requestAppJson(app, "GET", "/api/community/admin/support-threads", {
    headers: {
      "x-gernetix-community-admin-token": "community-admin-secret",
      "x-gernetix-community-admin-actor": actor,
    },
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.items[0].thread_id, thread.thread_id);
  const reply = await requestAppJson(app, "POST", `/api/community/admin/support-threads/${thread.thread_id}/messages`, {
    headers: {
      "x-gernetix-community-admin-token": "community-admin-secret",
      "x-gernetix-community-admin-actor": actor,
    },
    body: { body: "Über den getrennten Admin-Zugang." },
  });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.author_label, "GerNetiX Support");
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
