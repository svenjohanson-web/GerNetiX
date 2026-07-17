const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createWebPushService } = require("../src/services/web-push-service");

function subscription(endpoint) {
  return { endpoint, keys: { p256dh: "public-key", auth: "auth-key" } };
}

test("delivers a project notification only to that account and project's PWA subscriptions", async () => {
  const sent = [];
  const service = createWebPushService({
    sqlitePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-web-push-")), "identity.sqlite"),
    publicKey: "public", privateKey: "private", subject: "mailto:push@example.test",
    webPushClient: { setVapidDetails() {}, async sendNotification(item, payload) { sent.push({ item, payload: JSON.parse(payload) }); } },
  });
  service.subscribeProject("acct-owner", "project-a", subscription("https://push.example/owner-phone"));
  service.subscribeProject("acct-owner", "project-b", subscription("https://push.example/owner-tablet"));
  service.subscribeProject("acct-other", "project-a", subscription("https://push.example/other-phone"));

  const result = await service.notifyProject("acct-owner", "project-a", { title: "Hallo Welt", body: "vom Board" });

  assert.deepEqual(result, { enabled: true, delivered: 1 });
  assert.deepEqual(sent.map((entry) => entry.item.endpoint), ["https://push.example/owner-phone"]);
  assert.equal(sent.every((entry) => entry.payload.title === "Hallo Welt"), true);
});

test("does not broadcast when no explicit account recipients are configured", async () => {
  const sent = [];
  const service = createWebPushService({
    sqlitePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-web-push-")), "identity.sqlite"),
    publicKey: "public", privateKey: "private", subject: "mailto:push@example.test",
    webPushClient: { setVapidDetails() {}, async sendNotification(item) { sent.push(item); } },
  });
  service.subscribeProject("acct-owner", "project-a", subscription("https://push.example/owner-phone"));

  const result = await service.notifyAccounts([], { title: "Sicherheitsalarm" });

  assert.deepEqual(result, { enabled: true, delivered: 0 });
  assert.deepEqual(sent, []);
});
