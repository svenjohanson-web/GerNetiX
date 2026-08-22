const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createSmtpConfigStore } = require("../src/services/smtp-config-store");
const { SmtpEmailService } = require("../src/services/smtp-email-service");
const { ConfigurableEmailService } = require("../src/services/configurable-email-service");

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

test("community SMTP notification contains only a generic protected-inbox hint", async () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-smtp-")), "identity.sqlite");
  const store = createSmtpConfigStore({ sqlitePath, encryptionKey: Buffer.alloc(32, 5).toString("base64") });
  store.update({ username: "noreply@example.test", from_address: "noreply@example.test", password: "mail-secret" });
  const sent = [];
  const service = new SmtpEmailService({ configStore: store, transportFactory: () => ({
    sendMail: async (message) => { sent.push(message); return { messageId: "community-message-1" }; },
  }) });

  await service.send_community_notification_email("member@example.test", {
    category: "direct_messages", locale: "de", link: "https://pwa.gernetix.com/app/messages/",
  });
  assert.match(sent[0].subject, /Direktnachricht/);
  assert.match(sent[0].text, /keinen privaten Nachrichtentext/);
  assert.match(sent[0].text, /\/app\/messages\//);
  assert.doesNotMatch(sent[0].text, /Projektname|Nachrichteninhalt|Absender:/);
});

test("SMTP failures expose only normalized permanent or temporary delivery metadata", async () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-smtp-")), "identity.sqlite");
  const store = createSmtpConfigStore({ sqlitePath, encryptionKey: Buffer.alloc(32, 3).toString("base64") });
  store.update({ username: "noreply@example.test", from_address: "noreply@example.test", password: "mail-secret" });
  let providerError = Object.assign(new Error("550 private provider detail recipient@example.test"), {
    responseCode: 550, response: "550 5.1.1 private provider detail recipient@example.test",
  });
  const service = new SmtpEmailService({ configStore: store, transportFactory: () => ({
    sendMail: async () => { throw providerError; },
  }) });

  await assert.rejects(service.send_community_notification_email("recipient@example.test", {}), (error) => {
    assert.equal(error.code, "smtp_permanent_delivery_failure");
    assert.equal(error.permanent, true);
    assert.equal(error.smtp_status, "5.1.1");
    assert.doesNotMatch(error.message, /recipient@example|private provider/);
    return true;
  });

  providerError = Object.assign(new Error("temporary"), { responseCode: 451, response: "451 4.2.0 temporary" });
  await assert.rejects(service.send_community_notification_email("recipient@example.test", {}), (error) => {
    assert.equal(error.code, "smtp_temporary_delivery_failure");
    assert.equal(error.permanent, false);
    assert.equal(error.smtp_status, "4.2.0");
    return true;
  });
});

test("an SMTP result that rejects the sole recipient is treated as permanent", async () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-smtp-")), "identity.sqlite");
  const store = createSmtpConfigStore({ sqlitePath, encryptionKey: Buffer.alloc(32, 4).toString("base64") });
  store.update({ username: "noreply@example.test", from_address: "noreply@example.test", password: "mail-secret" });
  const service = new SmtpEmailService({ configStore: store, transportFactory: () => ({
    sendMail: async () => ({ accepted: [], rejected: ["recipient@example.test"], response: "550 5.1.1 rejected" }),
  }) });
  await assert.rejects(service.send_community_notification_email("recipient@example.test", {}), (error) => {
    assert.equal(error.permanent, true);
    assert.equal(error.smtp_status, "5.1.1");
    return true;
  });
});

test("Support-Recovery fails closed without SMTP instead of retaining the address in a mock outbox", async () => {
  let fallbackCalls = 0;
  const service = new ConfigurableEmailService({
    smtpEmailService: { configured: () => false },
    fallbackEmailService: { send_support_temporary_password_email: async () => { fallbackCalls += 1; } },
  });
  await assert.rejects(
    service.send_support_temporary_password_email("temporary@example.net", "sven02", "temporary-password-long", new Date().toISOString()),
    /SMTP-Mailversand ist fuer Support-Recovery nicht konfiguriert/,
  );
  assert.equal(fallbackCalls, 0);
});
