const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createSmtpConfigStore } = require("../src/services/smtp-config-store");
const { SmtpEmailService } = require("../src/services/smtp-email-service");

test("SMTP config encrypts the password and never returns it publicly", async () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-smtp-")), "identity.sqlite");
  const store = createSmtpConfigStore({ sqlitePath, encryptionKey: Buffer.alloc(32, 7).toString("base64") });
  const config = store.update({ username: "noreply@example.test", from_address: "noreply@example.test", security_alert_recipient: "security@example.test", password: "mail-secret" });

  assert.equal(config.has_password, true);
  assert.equal(Object.hasOwn(config, "password"), false);
  assert.equal(config.security_alert_recipient, "security@example.test");
  assert.equal(store.deliveryConfig().password, "mail-secret");
});

test("SMTP mail service uses encrypted configuration for verification mail", async () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-smtp-")), "identity.sqlite");
  const store = createSmtpConfigStore({ sqlitePath, encryptionKey: Buffer.alloc(32, 9).toString("base64") });
  store.update({ username: "noreply@example.test", from_address: "noreply@example.test", password: "mail-secret" });
  const sent = [];
  const service = new SmtpEmailService({ configStore: store, transportFactory: (options) => ({
    verify: async () => { assert.equal(options.auth.pass, "mail-secret"); },
    sendMail: async (message) => { sent.push(message); return { messageId: "message-1" }; },
  }) });

  await service.testConnection();
  const result = await service.send_verification_email("colleague@example.test", "https://gernetix.test/verify-email?token=secret");

  assert.equal(result.message_id, "message-1");
  assert.equal(sent[0].from, "noreply@example.test");
  assert.match(sent[0].text, /verify-email/);
});
