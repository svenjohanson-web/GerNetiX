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

function createModule() {
  const emailService = new MockEmailService({ log() {} });
  const repository = new InMemoryIdentityRepository();
  const auth = createDefaultIdentityModule({
    repository,
    emailService,
    appBaseUrl: "https://app.gernetix.test",
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

test("local registration can use a stable account id for dev integrations", async () => {
  const { auth } = createModule();
  const registered = await auth.register_local(
    "demo",
    "demo@example.com",
    "correct horse battery",
    true,
    "correct horse battery",
    { user_id: "acct-demo" },
  );

  assert.equal(registered.account.user_id, "acct-demo");
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
  const recoveryAccount = auth.get_offline_recovery_account(recovery.recovery_token);
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
  assert.equal(auth.resolve_session_token(created.session.token), null);
  assert.equal(auth.resolve_session_token(completed.session.token).account.user_id, created.account.user_id);
  await assert.rejects(
    auth.complete_offline_recovery(recovery.recovery_token, { credentialId: "again", publicKey: "again" }),
    /Recovery token is invalid or expired/,
  );
});

test("creates and logs in to a passkey-only base account without a password", async () => {
  const { auth, repository } = createModule();
  const created = await auth.create_passkey_account("passkey-maker", {
    credentialId: "credential-id", publicKey: "public-key", counter: 4, transports: ["internal"],
  });
  assert.equal(created.account.account_type, "base");
  assert.equal(repository.findLocalCredentialByUserId(created.account.user_id), null);

  const candidate = auth.get_passkey_login_candidate("passkey-maker");
  assert.equal(candidate.passkey_counter, 4);
  const login = await auth.login_passkey("passkey-maker", 5);
  assert.equal(login.account.user_id, created.account.user_id);
  assert.equal(repository.findUserById(created.account.user_id).passkey_counter, 5);
});

test("finds and logs in to a passkey account by credential id without a username", async () => {
  const { auth, repository } = createModule();
  const created = await auth.create_passkey_account("discoverable-passkey-maker", {
    credentialId: "discoverable-credential-id", publicKey: "public-key", counter: 4, transports: ["internal"],
  });
  const candidate = auth.get_passkey_login_candidate_by_credential_id("discoverable-credential-id");
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

  const second = createDefaultIdentityModule({
    emailService: new MockEmailService({ log() {} }),
    persistenceBackend: "sqlite",
    sqlitePath,
    appBaseUrl: "https://app.gernetix.test",
  });
  const login = await second.login_local("persisted@example.com", "correct horse battery");
  const resolved = second.resolve_session_token(login.session.token);

  assert.equal(registered.account.user_id, "acct-persisted");
  assert.equal(login.account.user_id, "acct-persisted");
  assert.equal(resolved.account.user_id, "acct-persisted");
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
  const stored = second.get_passkey_login_candidate("persisted-recovery-maker");

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
  const stored = second.get_passkey_login_candidate("persisted-recoverable-maker");

  assert.equal(completed.account.user_id, created.account.user_id);
  assert.equal(stored.passkey_credential_id, "persisted-new-credential-id");
  assert.equal(second.resolve_session_token(created.session.token), null);
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
  assert.notEqual(second.session.id, first.session.id);
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
