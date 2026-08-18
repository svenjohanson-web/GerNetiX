"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createCommunityNotificationOutboxWorker } = require("../src/services/community-notification-outbox-worker");

test("community notification worker completes sent and preference-skipped events", async () => {
  const requests = [];
  const events = [
    { event_id: "event-1", recipient_user_id: "user-1", category: "direct_messages", attempts: 1 },
    { event_id: "event-2", recipient_user_id: "user-2", category: "thread_replies", attempts: 1 },
  ];
  const worker = createCommunityNotificationOutboxWorker({
    communityJson: async (path, options) => {
      requests.push([path, options?.body]);
      return path.endsWith("/claim") ? { events } : {};
    },
    deliver: async (event) => ({ status: event.event_id === "event-1" ? "sent" : "skipped" }),
    logger: { warn() {} },
  });

  const result = await worker.flush();

  assert.deepEqual(result, { claimed: 2, delivered: 2, retried: 0 });
  assert.deepEqual(requests.slice(1).map(([path, body]) => [path.split("/").at(-1), body.outcome]), [
    ["complete", "sent"], ["complete", "skipped"],
  ]);
});

test("community notification worker retries failed delivery without forwarding private content", async () => {
  const requests = [];
  const event = { event_id: "event-private", recipient_user_id: "user-1", category: "support_replies", attempts: 3 };
  const worker = createCommunityNotificationOutboxWorker({
    communityJson: async (path, options) => {
      requests.push([path, options?.body]);
      return path.endsWith("/claim") ? { events: [event] } : {};
    },
    deliver: async (received) => {
      assert.deepEqual(received, event);
      return { status: "failed", private_message: "must not be forwarded" };
    },
    logger: { warn() {} },
  });

  const result = await worker.flush();
  const retry = requests.at(-1);

  assert.deepEqual(result, { claimed: 1, delivered: 0, retried: 1 });
  assert.match(retry[0], /event-private\/retry$/);
  assert.deepEqual(retry[1], { attempts: 3, error_code: "identity_delivery_failed" });
  assert.doesNotMatch(JSON.stringify(requests), /must not be forwarded/);
});
