const assert = require("node:assert/strict");
const test = require("node:test");
const { createPrivateCommunityNotifier, EMAIL_SUBJECT } = require("../src/services/private-community-notifier");

test("notifies operators without exposing private request contents", async () => {
  const emailCalls = [];
  const pushCalls = [];
  const events = [];
  const notify = createPrivateCommunityNotifier({
    smtpConfigStore: { deliveryConfig: () => ({ security_alert_recipient: "operator@example.test" }) },
    smtpEmailService: { configured: () => true, send: async (...args) => { emailCalls.push(args); } },
    webPushService: { enabled: true, notifyAccounts: async (...args) => { pushCalls.push(args); return { enabled: true, delivered: 1 }; } },
    recordSystemEvent: async (event) => { events.push(event); return true; },
    operatorAccountIds: ["operator-1", "operator-1"],
    logger: { warn() {} },
  });

  const result = await notify({ questionId: "question-private-7" });

  assert.deepEqual(result, { email: { sent: true }, push: { enabled: true, delivered: 1 }, event_recorded: true });
  assert.deepEqual(emailCalls[0].slice(0, 2), ["operator@example.test", EMAIL_SUBJECT]);
  assert.match(emailCalls[0][2], /private Projektbegleitung/i);
  assert.deepEqual(pushCalls[0][0], ["operator-1"]);
  assert.deepEqual(pushCalls[0][1], {
    title: "Neue private Projektbegleitung",
    body: "Eine neue private Anfrage wartet auf deine Antwort.",
    url: "/app/community/",
  });
  assert.deepEqual(events[0].details, { community_request_id: "question-private-7", visibility: "private" });
  assert.equal(events[0].message, "Neue private Projektbegleitung liegt vor.");
});

test("keeps private request creation available when a notification channel fails", async () => {
  const warnings = [];
  const notify = createPrivateCommunityNotifier({
    smtpConfigStore: { deliveryConfig: () => ({ security_alert_recipient: "operator@example.test" }) },
    smtpEmailService: { configured: () => true, send: async () => { throw new Error("smtp unavailable"); } },
    webPushService: { enabled: true, notifyAccounts: async () => { throw new Error("push unavailable"); } },
    recordSystemEvent: async () => { throw new Error("admin unavailable"); },
    operatorAccountIds: ["operator-1"],
    logger: { warn(message) { warnings.push(message); } },
  });

  const result = await notify({ questionId: "question-private-8" });

  assert.deepEqual(result, {
    email: { sent: false, failed: true },
    push: { enabled: true, delivered: 0, failed: true },
    event_recorded: false,
  });
  assert.equal(warnings.length, 3);
});
