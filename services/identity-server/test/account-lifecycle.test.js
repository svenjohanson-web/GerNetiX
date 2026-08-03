const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultIdentityModule, InMemoryIdentityRepository, MockEmailService } = require("../src");
const {
  effectiveSubscriptionPlan,
} = require("../src/services/account-lifecycle");

test("persists lifecycle defaults and evaluates an expired Premium plan as Free", async () => {
  let now = new Date("2026-08-03T10:00:00.000Z");
  const clock = () => new Date(now);
  const repository = new InMemoryIdentityRepository(clock);
  const auth = createDefaultIdentityModule({
    repository,
    emailService: new MockEmailService({ log() {} }),
    clock,
  });
  const created = await auth.create_passkey_account("lifecycle-maker", {
    credentialId: "lifecycle-credential", publicKey: "lifecycle-public-key",
  });

  const stored = repository.findUserById(created.account.user_id);
  assert.equal(stored.lifecycle_state, "active");
  assert.equal(stored.last_meaningful_activity_at, "2026-08-03T10:00:00.000Z");
  assert.equal(stored.plan_valid_until, null);

  const premium = await auth.update_subscription_plan(created.account.user_id, "premium", {
    plan_valid_until: "2026-08-03T11:00:00.000Z",
  });
  assert.equal(premium.effective_subscription_plan, "premium");

  now = new Date("2026-08-03T12:00:00.000Z");
  const expired = repository.findUserById(created.account.user_id);
  assert.equal(effectiveSubscriptionPlan(expired, now), "free");
});

test("allows only explicit lifecycle transitions with required future deadlines", async () => {
  let now = new Date("2026-08-03T10:00:00.000Z");
  const clock = () => new Date(now);
  const repository = new InMemoryIdentityRepository(clock);
  const auth = createDefaultIdentityModule({ repository, clock });
  const created = await auth.create_passkey_account("transition-maker", {
    credentialId: "transition-credential", publicKey: "transition-public-key",
  });

  await assert.rejects(
    auth.transition_account_lifecycle(created.account.user_id, { to_state: "cold_archived" }),
    (error) => error.code === "account_archive_not_implemented",
  );
  await assert.rejects(
    auth.transition_account_lifecycle(created.account.user_id, { to_state: "inactive_grace" }),
    (error) => error.code === "invalid_lifecycle_timestamp",
  );

  const grace = await auth.transition_account_lifecycle(created.account.user_id, {
    to_state: "inactive_grace",
    grace_until: "2026-08-10T10:00:00.000Z",
  });
  assert.equal(grace.lifecycle_state, "inactive_grace");
  assert.equal(grace.grace_until, "2026-08-10T10:00:00.000Z");

  now = new Date("2026-08-10T10:00:01.000Z");
  await assert.rejects(
    auth.transition_account_lifecycle(created.account.user_id, { to_state: "cold_archived" }),
    (error) => error.code === "account_archive_not_implemented",
  );
  assert.equal(repository.findUserById(created.account.user_id).lifecycle_state, "inactive_grace");
});

test("records meaningful activity monotonically without changing lifecycle state", async () => {
  let now = new Date("2026-08-03T10:00:00.000Z");
  const clock = () => new Date(now);
  const repository = new InMemoryIdentityRepository(clock);
  const auth = createDefaultIdentityModule({ repository, clock });
  const created = await auth.create_passkey_account("activity-maker", {
    credentialId: "activity-credential", publicKey: "activity-public-key",
  });
  await auth.transition_account_lifecycle(created.account.user_id, {
    to_state: "inactive_grace", grace_until: "2026-08-20T10:00:00.000Z",
  });

  now = new Date("2026-08-04T12:00:00.000Z");
  const updated = await auth.record_meaningful_activity(created.account.user_id);
  assert.equal(updated.last_meaningful_activity_at, "2026-08-04T12:00:00.000Z");
  assert.equal(updated.lifecycle_state, "inactive_grace");

  now = new Date("2026-08-04T11:00:00.000Z");
  const unchanged = await auth.record_meaningful_activity(created.account.user_id);
  assert.equal(unchanged.last_meaningful_activity_at, "2026-08-04T12:00:00.000Z");
});

test("keeps the security-disabled login block independent from lifecycle state", async () => {
  const repository = new InMemoryIdentityRepository();
  const auth = createDefaultIdentityModule({ repository });
  const created = await auth.create_passkey_account("disabled-maker", {
    credentialId: "disabled-credential", publicKey: "disabled-public-key",
  });
  await repository.updateUserAccount(created.account.user_id, {
    status: "disabled",
    lifecycle_state: "cold_archived",
  });

  await assert.rejects(
    auth.login_passkey("disabled-maker", 1),
    (error) => error.code === "account_disabled" && error.status === 403,
  );
  assert.equal(await auth.resolve_session_token(created.session.token), null);
});
