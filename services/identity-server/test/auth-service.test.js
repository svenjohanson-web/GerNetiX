const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createDefaultIdentityModule,
  InMemoryIdentityRepository,
  MockEmailService,
} = require("../src");

function createModule(options = {}) {
  const emailService = new MockEmailService({ log() {} });
  const repository = new InMemoryIdentityRepository(options.clock);
  const auth = createDefaultIdentityModule({
    repository,
    emailService,
    appBaseUrl: "https://app.gernetix.test",
    clock: options.clock,
  });
  return { auth, emailService, repository };
}

test("local registration creates pending account, sends verification, verifies and logs in", async () => {
  const { auth, emailService } = createModule();

  const registered = await auth.register_local(
    "sven",
    "Sven@example.com",
    "correct horse battery",
    true,
    "correct horse battery",
  );

  assert.equal(registered.account.username, "sven");
  assert.equal(registered.account.status, "pending_verification");
  assert.equal(registered.account.email, undefined);
  assert.equal(emailService.sentMessages.length, 1);
  assert.match(emailService.sentMessages[0].link, /verify-email/);

  await assert.rejects(
    auth.login_local("sven", "correct horse battery"),
    /Account is not verified/,
  );

  const verified = await auth.verify_email(extractToken(emailService.sentMessages[0].link));
  assert.equal(verified.account.status, "verified");

  const login = await auth.login_local("sven@example.com", "correct horse battery");
  assert.equal(login.account.user_id, registered.account.user_id);
  assert.ok(login.session.token);
});

test("local registration enforces unique username and email", async () => {
  const { auth } = createModule();
  await auth.register_local("sven", "sven@example.com", "correct horse battery", true);

  await assert.rejects(
    auth.register_local("sven", "other@example.com", "correct horse battery", true),
    /Username is already in use/,
  );
  await assert.rejects(
    auth.register_local("other", "SVEN@example.com", "correct horse battery", true),
    /Email is already in use/,
  );
});

test("passkey account can add, verify, change and remove an optional contact email", async () => {
  const { auth, emailService, repository } = createModule();
  const created = await auth.create_passkey_account("contact-maker", {
    credentialId: "contact-passkey", publicKey: "contact-public-key", rpId: "pwa.gernetix.com",
  });

  assert.deepEqual(await auth.get_contact_notification_settings(created.account.user_id), {
    email: null,
    pending_email: null,
    status: "not_configured",
    notification_preferences: {
      thread_replies: false, direct_messages: false, support_replies: false, project_invitations: false,
    },
    community_email_suppression: { active: false },
  });
  await assert.rejects(
    auth.update_notification_preferences(created.account.user_id, { direct_messages: true }),
    (error) => error.code === "verified_contact_email_required",
  );

  const pending = await auth.request_contact_email_change(created.account.user_id, "Contact@Example.net");
  assert.equal(pending.status, "verification_pending");
  assert.equal(pending.pending_email, "contact@example.net");
  assert.equal(repository.findUserById(created.account.user_id).email, null);
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));

  const enabled = await auth.update_notification_preferences(created.account.user_id, {
    direct_messages: true,
    project_invitations: true,
  });
  assert.equal(enabled.email, "contact@example.net");
  assert.equal(enabled.status, "verified");
  assert.equal(enabled.notification_preferences.direct_messages, true);
  assert.equal(enabled.notification_preferences.project_invitations, true);

  const removed = await auth.remove_contact_email(created.account.user_id);
  assert.equal(removed.status, "not_configured");
  assert.equal(removed.email, null);
  assert.equal(removed.notification_preferences.direct_messages, false);
  assert.equal(repository.findUserByEmail("contact@example.net"), null);
});

test("contact email verification applies only to the currently pending request", async () => {
  const { auth, emailService } = createModule();
  const created = await auth.create_passkey_account("change-maker", {
    credentialId: "change-passkey", publicKey: "change-public-key", rpId: "pwa.gernetix.com",
  });
  await auth.request_contact_email_change(created.account.user_id, "first@example.net");
  const firstToken = extractToken(emailService.sentMessages.at(-1).link);
  await auth.request_contact_email_change(created.account.user_id, "second@example.net");
  const secondToken = extractToken(emailService.sentMessages.at(-1).link);

  await auth.verify_email(firstToken);
  assert.equal((await auth.get_contact_notification_settings(created.account.user_id)).email, null);
  await auth.verify_email(secondToken);
  assert.equal((await auth.get_contact_notification_settings(created.account.user_id)).email, "second@example.net");
});

test("classic email account keeps its required verified contact address", async () => {
  const { auth, emailService } = createModule();
  const registered = await auth.register_local("mail-login", "login@example.net", "correct horse battery", true);
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));
  await assert.rejects(
    auth.remove_contact_email(registered.account.user_id),
    (error) => error.code === "contact_email_required_for_login",
  );
});

test("community notification delivery respects preferences and is idempotent", async () => {
  const { auth, emailService, repository } = createModule();
  const created = await auth.create_passkey_account("notify-maker", {
    credentialId: "notify-passkey", publicKey: "notify-public-key", rpId: "pwa.gernetix.com",
  });
  await auth.request_contact_email_change(created.account.user_id, "notify@example.net");
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));
  await auth.update_notification_preferences(created.account.user_id, { direct_messages: true });
  const before = emailService.sentMessages.length;

  const event = {
    event_id: "community:direct:thread-1:notify-maker",
    recipient_user_id: created.account.user_id,
    category: "direct_messages",
    private_message_body: "must never be forwarded",
  };
  assert.equal((await auth.deliver_community_notification(event)).status, "sent");
  assert.equal((await auth.deliver_community_notification(event)).deduplicated, true);
  assert.equal(emailService.sentMessages.length, before + 1);
  assert.equal(emailService.sentMessages.at(-1).type, "community_notification");
  assert.equal(JSON.stringify(emailService.sentMessages.at(-1)).includes("must never be forwarded"), false);
  assert.equal(repository.findNotificationDelivery(event.event_id).status, "sent");

  const skipped = await auth.deliver_community_notification({
    event_id: "community:invite:project-1:notify-maker",
    recipient_user_id: created.account.user_id,
    category: "project_invitations",
  });
  assert.equal(skipped.status, "skipped");
  assert.equal(repository.findNotificationDelivery("community:invite:project-1:notify-maker").reason, "preference_disabled");
});

test("community notification delivery retries only a stale processing record", async () => {
  let now = new Date("2026-08-18T10:00:00.000Z");
  const clock = () => new Date(now);
  const { auth, emailService, repository } = createModule({ clock });
  const created = await auth.create_passkey_account("retry-notify-maker", {
    credentialId: "retry-notify-passkey", publicKey: "retry-notify-public-key",
  });
  await auth.request_contact_email_change(created.account.user_id, "retry-notify@example.net");
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));
  await auth.update_notification_preferences(created.account.user_id, { direct_messages: true });
  const event = { event_id: "community:retry:1", recipient_user_id: created.account.user_id, category: "direct_messages" };
  await repository.saveNotificationDelivery({ ...event, user_id: created.account.user_id, status: "processing", created_at: now.toISOString() });

  assert.equal((await auth.deliver_community_notification(event)).status, "processing");
  now = new Date("2026-08-18T10:06:00.000Z");
  assert.equal((await auth.deliver_community_notification(event)).status, "sent");
});

test("permanent community delivery failures suppress only the current verified address", async () => {
  const { auth, emailService, repository } = createModule();
  const created = await auth.create_passkey_account("suppressed-maker", {
    credentialId: "suppressed-passkey", publicKey: "suppressed-public-key",
  });
  await auth.request_contact_email_change(created.account.user_id, "suppressed@example.net");
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));
  await auth.update_notification_preferences(created.account.user_id, { direct_messages: true });
  emailService.send_community_notification_email = async () => {
    const error = new Error("provider response must not be stored");
    error.permanent = true;
    error.smtp_status = "5.1.1";
    throw error;
  };

  const first = await auth.deliver_community_notification({
    event_id: "community:suppression:sync", recipient_user_id: created.account.user_id, category: "direct_messages",
  });
  assert.deepEqual(first, { event_id: "community:suppression:sync", status: "skipped", reason: "address_suppressed" });
  const settings = await auth.get_contact_notification_settings(created.account.user_id);
  assert.equal(settings.email, "suppressed@example.net");
  assert.equal(settings.notification_preferences.direct_messages, true);
  assert.equal(settings.community_email_suppression.active, true);
  assert.equal(settings.community_email_suppression.smtp_status, "5.1.1");
  assert.doesNotMatch(JSON.stringify(repository.findUserById(created.account.user_id)), /provider response/);

  const before = emailService.sentMessages.length;
  const skipped = await auth.deliver_community_notification({
    event_id: "community:suppression:later", recipient_user_id: created.account.user_id, category: "direct_messages",
  });
  assert.equal(skipped.status, "skipped");
  assert.equal(repository.findNotificationDelivery("community:suppression:later").reason, "address_suppressed");
  assert.equal(emailService.sentMessages.length, before);

  await auth.request_contact_email_change(created.account.user_id, "suppressed@example.net");
  assert.equal((await auth.get_contact_notification_settings(created.account.user_id)).status, "verification_pending");
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));
  assert.deepEqual((await auth.get_contact_notification_settings(created.account.user_id)).community_email_suppression, { active: false });
});

test("asynchronous bounce reports require a sent event and cannot suppress a changed recipient", async () => {
  const { auth, emailService } = createModule();
  const created = await auth.create_passkey_account("async-bounce-maker", {
    credentialId: "async-bounce-passkey", publicKey: "async-bounce-public-key",
  });
  await auth.request_contact_email_change(created.account.user_id, "old-bounce@example.net");
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));
  await auth.update_notification_preferences(created.account.user_id, { direct_messages: true });
  await auth.deliver_community_notification({
    event_id: "community:bounce:old", recipient_user_id: created.account.user_id, category: "direct_messages",
  });

  await auth.request_contact_email_change(created.account.user_id, "new-bounce@example.net");
  await auth.verify_email(extractToken(emailService.sentMessages.at(-1).link));
  await assert.rejects(auth.suppress_community_email_delivery({
    event_id: "community:bounce:old", reason_code: "mailbox_not_found",
    source: "delivery_status_notification", smtp_status: "5.1.1",
  }), (error) => error.code === "delivery_recipient_changed");

  await auth.deliver_community_notification({
    event_id: "community:bounce:new", recipient_user_id: created.account.user_id, category: "direct_messages",
  });
  const result = await auth.suppress_community_email_delivery({
    event_id: "community:bounce:new", reason_code: "mailbox_disabled",
    source: "delivery_status_notification", smtp_status: "550",
  });
  assert.equal(result.suppression.active, true);
  assert.equal((await auth.get_contact_notification_settings(created.account.user_id)).community_email_suppression.reason_code, "mailbox_disabled");
  await assert.rejects(auth.suppress_community_email_delivery({
    event_id: "community:bounce:new", reason_code: "raw provider response",
    source: "delivery_status_notification", smtp_status: "550",
  }), (error) => error.code === "invalid_suppression_reason");
});

test("notification delivery retention removes only records older than the explicit cutoffs", async () => {
  const { auth, repository } = createModule({ clock: () => new Date("2026-08-18T10:00:00.000Z") });
  for (const delivery of [
    { event_id: "old-sent", user_id: "user-1", status: "sent", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
    { event_id: "old-failed", user_id: "user-1", status: "failed", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
    { event_id: "recent-sent", user_id: "user-1", status: "sent", created_at: "2026-08-18T10:00:00.000Z", updated_at: "2026-08-18T10:00:00.000Z" },
  ]) repository.notificationDeliveries.set(delivery.event_id, delivery);

  const purged = await auth.purge_community_notification_deliveries({
    terminal_before: "2026-07-19T00:00:00.000Z",
    failed_before: "2026-05-20T00:00:00.000Z",
  });
  assert.deepEqual(purged, { terminal: 1, failed: 1, total: 2 });
  assert.equal(repository.findNotificationDelivery("recent-sent").status, "sent");
});

test("authentication retention removes expired token records but preserves active tokens and grants", async () => {
  const { auth, repository } = createModule({ clock: () => new Date("2026-08-18T10:00:00.000Z") });
  const records = [
    [repository.verificationTokens, repository.verificationTokenIndex, { id: "verify-old", token_hash: "verify-old-hash", expires_at: "2026-01-01T00:00:00.000Z" }],
    [repository.verificationTokens, repository.verificationTokenIndex, { id: "verify-active", token_hash: "verify-active-hash", expires_at: "2026-09-01T00:00:00.000Z" }],
    [repository.passwordResetTokens, repository.passwordResetTokenIndex, { id: "reset-old", token_hash: "reset-old-hash", expires_at: "2026-01-01T00:00:00.000Z" }],
  ];
  for (const [map, index, record] of records) { map.set(record.id, record); index.set(record.token_hash, record.id); }
  repository.supportRecoveryTransactions.set("support-old", {
    id: "support-old", expires_at: "2026-01-01T00:00:00.000Z", grant_expires_at: null, grant_token_hash: null,
  });
  repository.supportRecoveryTransactions.set("support-active-grant", {
    id: "support-active-grant", expires_at: "2026-01-01T00:00:00.000Z", grant_expires_at: "2026-09-01T00:00:00.000Z", grant_token_hash: "grant-active",
  });
  repository.supportRecoveryGrantIndex.set("grant-active", "support-active-grant");

  const purged = await auth.purge_expired_authentication_records({
    token_before: "2026-08-11T00:00:00.000Z",
    support_recovery_before: "2026-07-19T00:00:00.000Z",
  });

  assert.deepEqual(purged, { verification_tokens: 1, password_reset_tokens: 1, support_recoveries: 1, total: 3 });
  assert.equal(repository.findVerificationTokenByHash("verify-old-hash"), null);
  assert.equal(repository.findVerificationTokenByHash("verify-active-hash").id, "verify-active");
  assert.equal(repository.findSupportRecoveryByGrantHash("grant-active").id, "support-active-grant");
});

test("local registration can use a stable account id for dev integrations", async () => {
  const { auth } = createModule();
  const registered = await auth.register_local(
    "demo",
    "demo@example.com",
    "correct horse battery",
    true,
    "correct horse battery",
    { user_id: "acct-demo", subscription_plan: "premium_demo" },
  );

  assert.equal(registered.account.user_id, "acct-demo");
  assert.equal(registered.account.subscription_plan, "premium_demo");
});

test("creates new customer accounts with a persisted Basis profile by default", async () => {
  const { auth, repository } = createModule();
  const registered = await auth.register_local(
    "basis-user",
    "basis@example.com",
    "correct horse battery",
    true,
  );
  const passkey = await auth.create_passkey_account("basis-passkey", {
    credentialId: "basis-credential",
    publicKey: "basis-public-key",
  });

  assert.equal(registered.account.subscription_plan, "free");
  assert.equal(passkey.account.subscription_plan, "free");
  assert.equal(repository.findUserById(registered.account.user_id).subscription_plan, "free");

  const updated = await auth.update_subscription_plan(registered.account.user_id, "premium");
  assert.equal(updated.subscription_plan, "premium");
  await assert.rejects(
    auth.update_subscription_plan(registered.account.user_id, "unknown"),
    /Subscription plan is not supported/,
  );
});

test("keeps one identity while a guest becomes a base account and then an ESP32 account", async () => {
  const { auth } = createModule();
  const guest = await auth.create_guest({ ttlMs: 60_000 });
  assert.equal(guest.account.account_type, "guest");

  const base = await auth.upgrade_guest_to_base(
    guest.account.user_id,
    "maker",
    "a long enough password",
      true,
      "passkey-credential-placeholder",
      true,
      "test-offline-recovery-set",
  );
  assert.equal(base.account.user_id, guest.account.user_id);
  assert.equal(base.account.account_type, "base");

  const esp32 = await auth.add_esp32_recovery_token(base.account.user_id, "board-1");
  assert.equal(esp32.account.account_type, "esp32");
  assert.equal(esp32.account.recovery_board_count, 1);

  await auth.add_esp32_recovery_token(base.account.user_id, "board-2");
  await auth.add_esp32_recovery_token(base.account.user_id, "board-3");
  await assert.rejects(auth.add_esp32_recovery_token(base.account.user_id, "board-4"), /At most three recovery boards/);

  const downgraded = await auth.remove_esp32_recovery_token(base.account.user_id, "board-1");
  assert.equal(downgraded.account.account_type, "esp32");
  const stillEsp32 = await auth.remove_esp32_recovery_token(base.account.user_id, "board-2");
  const baseAgain = await auth.remove_esp32_recovery_token(base.account.user_id, "board-3");
  assert.equal(stillEsp32.account.account_type, "esp32");
  assert.equal(baseAgain.account.account_type, "base");
});

test("allows a passkey base account without an optional offline recovery set", async () => {
  const { auth, repository } = createModule();
  const guest = await auth.create_guest({ ttlMs: 60_000 });

  const base = await auth.upgrade_guest_to_base(
    guest.account.user_id,
    "passkey-only-maker",
    "a long enough password",
    true,
    "passkey-credential-placeholder",
    false,
    "",
  );

  assert.equal(base.account.account_type, "base");
  const stored = repository.findUserById(base.account.user_id);
  assert.equal(stored.offline_recovery_set_confirmed_at, null);
  assert.equal(stored.offline_recovery_set_hash, null);
});

test("creates an offline recovery set once and stores only its hash", async () => {
  const { auth, repository } = createModule();
  const created = await auth.create_passkey_account("offline-recovery-maker", {
    credentialId: "credential-id", publicKey: "public-key", counter: 0, transports: ["internal"],
  });

  const result = await auth.create_offline_recovery_set(created.account.user_id);
  const stored = repository.findUserById(created.account.user_id);
  assert.match(result.recovery_set, /^[A-Za-z0-9_-]{4}(?:-[A-Za-z0-9_-]{4})+$/);
  assert.equal(result.account.offline_recovery_set_configured, true);
  assert.ok(stored.offline_recovery_set_confirmed_at);
  assert.ok(stored.offline_recovery_set_hash);
  assert.notEqual(stored.offline_recovery_set_hash, result.recovery_set);
  assert.equal(Object.hasOwn(result.account, "offline_recovery_set_hash"), false);
});

test("offline recovery replaces the passkey, consumes its own token and revokes old sessions", async () => {
  const { auth, repository } = createModule();
  const created = await auth.create_passkey_account("recoverable-maker", {
    credentialId: "old-credential-id", publicKey: "old-public-key", counter: 2, transports: ["internal"],
  });
  const recoverySet = await auth.create_offline_recovery_set(created.account.user_id);

  await assert.rejects(
    auth.start_offline_recovery("recoverable-maker", "wrong-recovery-set"),
    /Recovery set is invalid/,
  );

  const recovery = await auth.start_offline_recovery("recoverable-maker", recoverySet.recovery_set);
  const recoveryAccount = await auth.get_offline_recovery_account(recovery.recovery_token);
  assert.equal(recoveryAccount.id, created.account.user_id);
  assert.equal(repository.passwordResetTokens.size, 0);
  assert.equal(repository.offlineRecoveryTransactions.size, 1);

  const completed = await auth.complete_offline_recovery(recovery.recovery_token, {
    credentialId: "new-credential-id",
    publicKey: "new-public-key",
    counter: 0,
    transports: ["usb"],
  });
  const stored = repository.findUserById(created.account.user_id);

  assert.equal(completed.account.user_id, created.account.user_id);
  assert.equal(stored.passkey_credential_id, "new-credential-id");
  assert.equal(stored.passkey_public_key, "new-public-key");
  assert.equal(await auth.resolve_session_token(created.session.token), null);
  assert.equal((await auth.resolve_session_token(completed.session.token)).account.user_id, created.account.user_id);
  await assert.rejects(
    auth.complete_offline_recovery(recovery.recovery_token, { credentialId: "again", publicKey: "again" }),
    /Recovery token is invalid or expired/,
  );
});

test("support recovery stores neither delivery email nor temporary password and forces a new passkey", async () => {
  const { auth, emailService, repository } = createModule();
  const original = await auth.create_passkey_account("support-user", {
    credentialId: "old-passkey",
    publicKey: "old-public-key",
    rpId: "pwa.gernetix.com",
  });
  const issued = await auth.start_support_recovery({
    username: "support-user",
    email: "only-for-reset@example.net",
    supportActorId: "support-agent-1",
    supportActorRole: "support",
    reason: "verified_existing_support_callback",
    actionId: "11111111-1111-4111-8111-111111111111",
  });

  assert.equal(issued.email_deleted, true);
  const delivery = emailService.sentMessages.at(-1);
  assert.equal(delivery.email, "only-for-reset@example.net");
  const stored = repository.supportRecoveryTransactions.get(issued.recovery_id);
  assert.equal(stored.email_deleted_at.length > 10, true);
  assert.equal(stored.email, undefined);
  assert.equal(stored.temporary_password, undefined);
  assert.doesNotMatch(JSON.stringify(stored), /only-for-reset@example\.net/);
  assert.doesNotMatch(JSON.stringify(stored), new RegExp(delivery.temporary_password.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await assert.rejects(
    auth.start_support_recovery({
      username: "support-user", email: "second@example.net", supportActorId: "support-agent-1", supportActorRole: "support",
      reason: "verified_existing_support_callback", actionId: "11111111-1111-4111-8111-111111111112",
    }),
    (error) => error.code === "support_recovery_already_active" && error.status === 409,
  );

  await assert.rejects(auth.login_support_recovery("support-user", "ungueltiges-passwort"), /invalid or expired/i);
  const recovery = await auth.login_support_recovery("support-user", delivery.temporary_password);
  assert.equal(recovery.recovery_required, true);
  assert.equal(await auth.resolve_session_token(original.session.token), null);
  await assert.rejects(auth.login_support_recovery("support-user", delivery.temporary_password), /invalid or expired/i);

  const completed = await auth.complete_support_recovery(recovery.support_recovery_token, {
    credentialId: "new-passkey",
    publicKey: "new-public-key",
    rpId: "pwa.gernetix.com",
  });
  assert.ok(completed.session.token);
  assert.deepEqual((await auth.list_passkeys(original.account.user_id)).map((item) => item.credential_id), ["new-passkey"]);
  await assert.rejects(auth.get_support_recovery_account(recovery.support_recovery_token), /invalid or expired/i);
});

test("support recovery limits issuance and rejects an unprivileged actor role", async () => {
  const { auth, repository } = createModule();
  await auth.create_passkey_account("rate-user", { credentialId: "rate-passkey", publicKey: "rate-key", rpId: "pwa.gernetix.com" });
  const input = {
    username: "rate-user",
    email: "reset@example.net",
    supportActorId: "support-agent-1",
    supportActorRole: "support",
    reason: "verified_customer_contract_reference",
  };
  await assert.rejects(auth.start_support_recovery({ ...input, supportActorRole: "community_moderator", actionId: "20000000-0000-4000-8000-000000000000" }), /Support role is invalid/);
  for (let index = 1; index <= 3; index += 1) {
    await auth.start_support_recovery({ ...input, actionId: `30000000-0000-4000-8000-00000000000${index}` });
    repository.revokeActiveSupportRecoveries(repository.findUserByUsername("rate-user").id, "test_completed");
  }
  await assert.rejects(
    auth.start_support_recovery({ ...input, actionId: "30000000-0000-4000-8000-000000000004" }),
    (error) => error.code === "support_recovery_rate_limited" && error.status === 429,
  );
});

test("support recovery revokes the temporary password after five failed attempts", async () => {
  const { auth, emailService } = createModule();
  await auth.create_passkey_account("attempt-user", { credentialId: "attempt-passkey", publicKey: "attempt-key", rpId: "pwa.gernetix.com" });
  await auth.start_support_recovery({
    username: "attempt-user", email: "attempt@example.net", supportActorId: "support-agent-1", supportActorRole: "support",
    reason: "verified_operator_exception", actionId: "40000000-0000-4000-8000-000000000001",
  });
  const password = emailService.sentMessages.at(-1).temporary_password;
  for (let index = 0; index < 5; index += 1) await assert.rejects(auth.login_support_recovery("attempt-user", "ungueltiges-passwort"), /invalid or expired/i);
  await assert.rejects(auth.login_support_recovery("attempt-user", password), /invalid or expired/i);
});

test("creates and logs in to a passkey-only base account without a password", async () => {
  const { auth, repository } = createModule();
  const created = await auth.create_passkey_account("passkey-maker", {
    credentialId: "credential-id", publicKey: "public-key", counter: 4, transports: ["internal"],
  });
  assert.equal(created.account.account_type, "base");
  assert.equal(repository.findLocalCredentialByUserId(created.account.user_id), null);

  const candidate = await auth.get_passkey_login_candidate("passkey-maker");
  assert.equal(candidate.passkey_counter, 4);
  const login = await auth.login_passkey("passkey-maker", 5);
  assert.equal(login.account.user_id, created.account.user_id);
  assert.equal(repository.findUserById(created.account.user_id).passkey_counter, 5);
});

test("normalizes and persists the preferred account locale", async () => {
  const { auth, repository } = createModule();
  const guest = await auth.create_guest({ preferredLocale: "nl-NL" });
  assert.equal(guest.account.preferred_locale, "nl");
  assert.equal(repository.findUserById(guest.account.user_id).preferred_locale, "nl");

  const updated = await auth.update_preferred_locale(guest.account.user_id, "en-US");
  assert.equal(updated.preferred_locale, "en");
  assert.equal(repository.findUserById(guest.account.user_id).preferred_locale, "en");

  await assert.rejects(
    auth.update_preferred_locale(guest.account.user_id, "fr"),
    /Locale is not supported/,
  );
});

test("finds and logs in to a passkey account by credential id without a username", async () => {
  const { auth, repository } = createModule();
  const created = await auth.create_passkey_account("discoverable-passkey-maker", {
    credentialId: "discoverable-credential-id", publicKey: "public-key", counter: 4, transports: ["internal"],
  });
  const candidate = await auth.get_passkey_login_candidate_by_credential_id("discoverable-credential-id");
  assert.equal(candidate.id, created.account.user_id);
  const login = await auth.login_passkey_by_credential_id("discoverable-credential-id", 5);
  assert.equal(login.account.user_id, created.account.user_id);
  assert.equal(repository.findUserById(created.account.user_id).passkey_counter, 5);
});

test("sqlite identity persistence keeps local accounts across repository reloads", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-identity-"));
  const sqlitePath = path.join(tempDir, "identity.sqlite");
  const firstEmailService = new MockEmailService({ log() {} });
  const first = createDefaultIdentityModule({
    emailService: firstEmailService,
    persistenceBackend: "sqlite",
    sqlitePath,
    appBaseUrl: "https://app.gernetix.test",
  });

  const registered = await first.register_local(
    "persisted",
    "persisted@example.com",
    "correct horse battery",
    true,
    "correct horse battery",
    { user_id: "acct-persisted" },
  );
  await first.verify_email(extractToken(firstEmailService.sentMessages[0].link));
  await first.update_subscription_plan(registered.account.user_id, "premium", {
    plan_valid_until: "2099-12-31T23:59:59.000Z",
  });
  await first.update_account_preferences(registered.account.user_id, {
    welcome_guide_disabled: true,
  });
  await first.transition_account_lifecycle(registered.account.user_id, {
    to_state: "inactive_grace",
    grace_until: "2099-01-15T00:00:00.000Z",
  });

  const second = createDefaultIdentityModule({
    emailService: new MockEmailService({ log() {} }),
    persistenceBackend: "sqlite",
    sqlitePath,
    appBaseUrl: "https://app.gernetix.test",
  });
  const login = await second.login_local("persisted@example.com", "correct horse battery");
  const resolved = await second.resolve_session_token(login.session.token);

  assert.equal(registered.account.user_id, "acct-persisted");
  assert.equal(login.account.user_id, "acct-persisted");
  assert.equal(resolved.account.user_id, "acct-persisted");
  assert.equal(resolved.account.subscription_plan, "premium");
  assert.equal(resolved.account.plan_valid_until, "2099-12-31T23:59:59.000Z");
  assert.equal(resolved.account.welcome_guide_disabled, true);
  assert.equal(resolved.account.lifecycle_state, "inactive_grace");
  assert.equal(resolved.account.grace_until, "2099-01-15T00:00:00.000Z");
});

test("sqlite keeps community email suppression and recipient version across repository reloads", async () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-suppression-")), "identity.sqlite");
  const firstEmailService = new MockEmailService({ log() {} });
  const first = createDefaultIdentityModule({
    emailService: firstEmailService, persistenceBackend: "sqlite", sqlitePath,
    appBaseUrl: "https://app.gernetix.test",
  });
  const created = await first.create_passkey_account("sqlite-suppression", {
    credentialId: "sqlite-suppression-passkey", publicKey: "public-key",
  });
  await first.request_contact_email_change(created.account.user_id, "sqlite-suppression@example.net");
  await first.verify_email(extractToken(firstEmailService.sentMessages.at(-1).link));
  await first.update_notification_preferences(created.account.user_id, { direct_messages: true });
  firstEmailService.send_community_notification_email = async () => {
    throw Object.assign(new Error("private provider text"), { permanent: true, smtp_status: "550" });
  };
  await first.deliver_community_notification({
    event_id: "community:sqlite:suppression", recipient_user_id: created.account.user_id, category: "direct_messages",
  });

  const second = createDefaultIdentityModule({
    emailService: new MockEmailService({ log() {} }), persistenceBackend: "sqlite", sqlitePath,
    appBaseUrl: "https://app.gernetix.test",
  });
  const settings = await second.get_contact_notification_settings(created.account.user_id);
  assert.equal(settings.community_email_suppression.active, true);
  assert.equal(settings.community_email_suppression.smtp_status, "550");
  assert.equal(second.repository.findNotificationDelivery("community:sqlite:suppression").recipient_version.length > 10, true);
  assert.doesNotMatch(JSON.stringify(second.repository.findUserById(created.account.user_id)), /private provider text/);
});

test("sqlite persists authentication retention deletions across repository reloads", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-auth-retention-"));
  const sqlitePath = path.join(tempDir, "identity.sqlite");
  const first = createDefaultIdentityModule({ persistenceBackend: "sqlite", sqlitePath });
  const account = await first.create_passkey_account("retention-maker", {
    credentialId: "retention-credential", publicKey: "public-key", counter: 0, transports: ["internal"],
  });
  const verification = await first.repository.createVerificationToken({
    user_id: account.account.user_id, token_hash: "expired-verification", expires_at: "2026-01-01T00:00:00.000Z", used_at: null, created_at: "2025-12-31T00:00:00.000Z",
  });
  const reset = await first.repository.createPasswordResetToken({
    user_id: account.account.user_id, token_hash: "expired-reset", expires_at: "2026-01-01T00:00:00.000Z", used_at: null, created_at: "2025-12-31T00:00:00.000Z",
  });

  await first.purge_expired_authentication_records({
    token_before: "2026-08-11T00:00:00.000Z",
    support_recovery_before: "2026-07-19T00:00:00.000Z",
  });
  const second = createDefaultIdentityModule({ persistenceBackend: "sqlite", sqlitePath });
  assert.equal(second.repository.findVerificationTokenByHash(verification.token_hash), null);
  assert.equal(second.repository.findPasswordResetTokenByHash(reset.token_hash), null);
});

test("sqlite persistence retains only the offline recovery set hash", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-recovery-set-"));
  const sqlitePath = path.join(tempDir, "identity.sqlite");
  const first = createDefaultIdentityModule({ persistenceBackend: "sqlite", sqlitePath });
  const account = await first.create_passkey_account("persisted-recovery-maker", {
    credentialId: "credential-id", publicKey: "public-key", counter: 0, transports: ["internal"],
  });
  const recovery = await first.create_offline_recovery_set(account.account.user_id);
  const second = createDefaultIdentityModule({ persistenceBackend: "sqlite", sqlitePath });
  const stored = await second.get_passkey_login_candidate("persisted-recovery-maker");

  assert.ok(stored.offline_recovery_set_confirmed_at);
  assert.ok(stored.offline_recovery_set_hash);
  assert.notEqual(stored.offline_recovery_set_hash, recovery.recovery_set);
});

test("sqlite persistence retains pending offline recovery transactions across reloads", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-recovery-transaction-"));
  const sqlitePath = path.join(tempDir, "identity.sqlite");
  const first = createDefaultIdentityModule({ persistenceBackend: "sqlite", sqlitePath });
  const created = await first.create_passkey_account("persisted-recoverable-maker", {
    credentialId: "old-credential-id", publicKey: "old-public-key", counter: 0, transports: ["internal"],
  });
  const recoverySet = await first.create_offline_recovery_set(created.account.user_id);
  const recovery = await first.start_offline_recovery("persisted-recoverable-maker", recoverySet.recovery_set);

  const second = createDefaultIdentityModule({ persistenceBackend: "sqlite", sqlitePath });
  const completed = await second.complete_offline_recovery(recovery.recovery_token, {
    credentialId: "persisted-new-credential-id",
    publicKey: "persisted-new-public-key",
    counter: 0,
    transports: ["internal"],
  });
  const stored = await second.get_passkey_login_candidate("persisted-recoverable-maker");

  assert.equal(completed.account.user_id, created.account.user_id);
  assert.equal(stored.passkey_credential_id, "persisted-new-credential-id");
  assert.equal(await second.resolve_session_token(created.session.token), null);
});

test("social login creates exactly one internal account and reuses it on next login", async () => {
  const { auth } = createModule();

  const first = await auth.login_external("google", {
    provider: "google",
    provider_user_id: "google-123",
    email: "person@example.com",
    email_verified: true,
    username: "person",
  });

  assert.equal(first.account.status, "verified");
  assert.ok(first.account.user_id);
  assert.equal(first.account.email, undefined);

  const second = await auth.login_external("google", {
    provider: "google",
    provider_user_id: "google-123",
    email: "person@example.com",
    email_verified: true,
  });

  assert.equal(second.account.user_id, first.account.user_id);
  assert.equal(second.requires_session_takeover, true);
  assert.ok(second.pending_login_token);
});

test("persists the account-bound welcome guide preference", async () => {
  const { auth, repository } = createModule();
  const created = await auth.create_passkey_account("guided-maker", {
    credentialId: "guided-credential",
    publicKey: "guided-public-key",
  });

  assert.equal(created.account.welcome_guide_disabled, false);
  const hidden = await auth.update_account_preferences(created.account.user_id, {
    welcome_guide_disabled: true,
  });
  assert.equal(hidden.welcome_guide_disabled, true);
  assert.equal(repository.findUserById(created.account.user_id).welcome_guide_disabled, true);

  const visibleAgain = await auth.update_account_preferences(created.account.user_id, {
    welcome_guide_disabled: false,
  });
  assert.equal(visibleAgain.welcome_guide_disabled, false);
  await assert.rejects(
    auth.update_account_preferences(created.account.user_id, { welcome_guide_disabled: "yes" }),
    /must be boolean/,
  );
});

test("interactive login requires an explicit takeover and atomically revokes the previous session", async () => {
  const { auth, emailService } = createModule();
  await auth.register_local("single-session", "single@example.com", "correct horse battery", true);
  await auth.verify_email(extractToken(emailService.sentMessages[0].link));

  const first = await auth.login_local("single-session", "correct horse battery");
  const pending = await auth.login_local("single-session", "correct horse battery");

  assert.equal(pending.requires_session_takeover, true);
  assert.equal(await auth.resolve_session_token(pending.pending_login_token), null);
  assert.equal((await auth.resolve_session_token(first.session.token)).account.user_id, first.account.user_id);

  const takenOver = await auth.complete_session_takeover(pending.pending_login_token);
  assert.equal(takenOver.replaced_session, true);
  assert.equal(await auth.resolve_session_token(first.session.token), null);
  assert.equal((await auth.resolve_session_token(takenOver.session.token)).account.user_id, first.account.user_id);
  assert.deepEqual(await auth.describe_session_token(first.session.token), {
    status: "revoked",
    reason: "replaced",
    expires_at: first.session.expires_at,
  });
});

test("cancelling a pending takeover preserves the active session", async () => {
  const { auth, emailService } = createModule();
  await auth.register_local("cancel-session", "cancel@example.com", "correct horse battery", true);
  await auth.verify_email(extractToken(emailService.sentMessages[0].link));
  const first = await auth.login_local("cancel-session", "correct horse battery");
  const pending = await auth.login_local("cancel-session", "correct horse battery");

  assert.deepEqual(await auth.cancel_session_takeover(pending.pending_login_token), { cancelled: true });
  assert.equal((await auth.resolve_session_token(first.session.token)).account.user_id, first.account.user_id);
  await assert.rejects(auth.complete_session_takeover(pending.pending_login_token), /invalid or expired/i);
});

test("securing an account revokes every other session without locking out a passkey-only account", async () => {
  const { auth, emailService } = createModule();
  await auth.register_local("secure-session", "secure@example.com", "correct horse battery", true);
  await auth.verify_email(extractToken(emailService.sentMessages[0].link));
  const first = await auth.login_local("secure-session", "correct horse battery");
  const pending = await auth.login_local("secure-session", "correct horse battery");

  const secured = await auth.secure_account_from_pending_login(pending.pending_login_token);
  assert.equal(secured.secured, true);
  assert.equal(secured.recovery_required, false);
  assert.equal(await auth.resolve_session_token(first.session.token), null);
  assert.equal((await auth.resolve_session_token(pending.pending_login_token)).account.user_id, first.account.user_id);
});

test("unverified external email creates pending account without productive session", async () => {
  const { auth, emailService } = createModule();

  const result = await auth.login_external("github", {
    provider: "github",
    provider_user_id: "gh-123",
    email: "pending@example.com",
    email_verified: false,
  });

  assert.equal(result.account.status, "pending_verification");
  assert.equal(result.session, null);
  assert.equal(result.requires_email_verification, true);
  assert.equal(emailService.sentMessages.length, 1);
});

test("password reset is neutral and invalidates token after use", async () => {
  const { auth, emailService } = createModule();
  const registered = await auth.register_local(
    "resetuser",
    "reset@example.com",
    "correct horse battery",
    true,
  );
  await auth.verify_email(extractToken(emailService.sentMessages[0].link));

  const unknown = await auth.request_password_reset("missing@example.com");
  assert.equal(unknown.accepted, true);
  assert.equal(unknown.reset_token_for_tests, undefined);

  const reset = await auth.request_password_reset("reset@example.com");
  assert.equal(reset.accepted, true);
  assert.equal(reset.reset_token_for_tests, undefined);

  const resetToken = extractToken(emailService.sentMessages.at(-1).link);
  await auth.reset_password(resetToken, "new correct horse battery");
  await assert.rejects(
    auth.reset_password(resetToken, "another correct horse"),
    /Password reset token is invalid or expired/,
  );

  const login = await auth.login_local("resetuser", "new correct horse battery");
  assert.ok(login.session.token);
});

test("logout revokes session by id or raw token without exposing provider ids", async () => {
  const { auth, emailService } = createModule();
  const registered = await auth.register_local("logoutuser", "logout@example.com", "correct horse battery", true);
  await auth.verify_email(extractToken(emailService.sentMessages[0].link));
  const login = await auth.login_local("logoutuser", "correct horse battery");

  assert.equal(login.account.email, undefined);
  assert.equal(login.account.provider_user_id, undefined);

  const result = await auth.logout(login.session.token);
  assert.equal(result.logged_out, true);
});

test("social login does not silently link to an existing email account", async () => {
  const { auth, emailService } = createModule();
  await auth.register_local("localuser", "same@example.com", "correct horse battery", true);
  await auth.verify_email(extractToken(emailService.sentMessages[0].link));

  await assert.rejects(
    auth.login_external("google", {
      provider: "google",
      provider_user_id: "google-new",
      email: "same@example.com",
      email_verified: true,
    }),
    /Explicit account linking is required/,
  );
});

function extractToken(link) {
  return new URL(link).searchParams.get("token");
}
