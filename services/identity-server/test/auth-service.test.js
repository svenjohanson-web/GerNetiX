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
