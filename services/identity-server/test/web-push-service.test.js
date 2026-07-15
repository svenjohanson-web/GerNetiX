const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createWebPushService } = require("../src/services/web-push-service");

function subscription(endpoint) {
  return { endpoint, keys: { p256dh: "public-key", auth: "auth-key" } };
}

test("delivers an account notification only to that account's PWA subscriptions", async () => {
  const sent = [];
  const service = createWebPushService({
    sqlitePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-web-push-")), "identity.sqlite"),
    publicKey: "public", privateKey: "private", subject: "mailto:push@example.test",
    webPushClient: { setVapidDetails() {}, async sendNotification(item, payload) { sent.push({ item, payload: JSON.parse(payload) }); } },
  });
  service.subscribe("acct-owner", subscription("https://push.example/owner-phone"));
  service.subscribe("acct-other", subscription("https://push.example/other-phone"));
  service.subscribe("acct-owner", subscription("https://push.example/owner-tablet"));

  const result = await service.notifyAccount("acct-owner", { title: "Hallo Welt", body: "vom Board" });

  assert.deepEqual(result, { enabled: true, delivered: 2 });
  assert.deepEqual(sent.map((entry) => entry.item.endpoint).sort(), ["https://push.example/owner-phone", "https://push.example/owner-tablet"]);
  assert.equal(sent.every((entry) => entry.payload.title === "Hallo Welt"), true);
});

test("does not broadcast when no explicit account recipients are configured", async () => {
  const sent = [];
  const service = createWebPushService({
    sqlitePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-web-push-")), "identity.sqlite"),
    publicKey: "public", privateKey: "private", subject: "mailto:push@example.test",
    webPushClient: { setVapidDetails() {}, async sendNotification(item) { sent.push(item); } },
  });
  service.subscribe("acct-owner", subscription("https://push.example/owner-phone"));

  const result = await service.notifyAccounts([], { title: "Sicherheitsalarm" });

  assert.deepEqual(result, { enabled: true, delivered: 0 });
  assert.deepEqual(sent, []);
});
