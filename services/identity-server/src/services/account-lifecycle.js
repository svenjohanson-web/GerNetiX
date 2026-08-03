const { AuthError } = require("../errors");

const ACCOUNT_LIFECYCLE_STATE = Object.freeze({
  ACTIVE: "active",
  DOWNGRADE_GRACE: "downgrade_grace",
  OVER_QUOTA: "over_quota",
  INACTIVE_GRACE: "inactive_grace",
  COLD_ARCHIVED: "cold_archived",
  PENDING_DELETION: "pending_deletion",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [ACCOUNT_LIFECYCLE_STATE.ACTIVE]: new Set([
    ACCOUNT_LIFECYCLE_STATE.DOWNGRADE_GRACE,
    ACCOUNT_LIFECYCLE_STATE.OVER_QUOTA,
    ACCOUNT_LIFECYCLE_STATE.INACTIVE_GRACE,
  ]),
  [ACCOUNT_LIFECYCLE_STATE.DOWNGRADE_GRACE]: new Set([
    ACCOUNT_LIFECYCLE_STATE.ACTIVE,
    ACCOUNT_LIFECYCLE_STATE.OVER_QUOTA,
  ]),
  [ACCOUNT_LIFECYCLE_STATE.OVER_QUOTA]: new Set([
    ACCOUNT_LIFECYCLE_STATE.ACTIVE,
    ACCOUNT_LIFECYCLE_STATE.DOWNGRADE_GRACE,
    ACCOUNT_LIFECYCLE_STATE.INACTIVE_GRACE,
  ]),
  [ACCOUNT_LIFECYCLE_STATE.INACTIVE_GRACE]: new Set([
    ACCOUNT_LIFECYCLE_STATE.ACTIVE,
    ACCOUNT_LIFECYCLE_STATE.COLD_ARCHIVED,
  ]),
  [ACCOUNT_LIFECYCLE_STATE.COLD_ARCHIVED]: new Set([
    ACCOUNT_LIFECYCLE_STATE.ACTIVE,
    ACCOUNT_LIFECYCLE_STATE.PENDING_DELETION,
  ]),
  [ACCOUNT_LIFECYCLE_STATE.PENDING_DELETION]: new Set([
    ACCOUNT_LIFECYCLE_STATE.ACTIVE,
    ACCOUNT_LIFECYCLE_STATE.COLD_ARCHIVED,
  ]),
});

function normalizeLifecycleState(value, fallback = ACCOUNT_LIFECYCLE_STATE.ACTIVE) {
  const state = String(value || "").trim().toLowerCase();
  return Object.values(ACCOUNT_LIFECYCLE_STATE).includes(state) ? state : fallback;
}

function effectiveSubscriptionPlan(account, now = new Date()) {
  const configured = normalizeSubscriptionPlan(account?.subscription_plan);
  if (configured === "free") return "free";
  const validUntil = account?.plan_valid_until;
  if (!validUntil) return configured;
  return Date.parse(validUntil) > now.getTime() ? configured : "free";
}

function normalizeSubscriptionPlan(value, fallback = "free") {
  const plan = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return ["free", "premium", "premium_demo"].includes(plan) ? plan : fallback;
}

function lifecycleTransitionPatch(account, transition, now = new Date()) {
  const currentState = normalizeLifecycleState(account?.lifecycle_state);
  const nextState = normalizeLifecycleState(transition?.to_state || transition?.toState, "");
  if (!nextState) throw new AuthError("invalid_lifecycle_state", "Lifecycle state is not supported.", 400);
  if ([ACCOUNT_LIFECYCLE_STATE.COLD_ARCHIVED, ACCOUNT_LIFECYCLE_STATE.PENDING_DELETION].includes(nextState)) {
    throw new AuthError(
      "account_archive_not_implemented",
      "Cold-Archive- und Löschtransitionen bleiben gesperrt, bis ein verifiziertes Archivmanifest und ein Restore-Nachweis angebunden sind.",
      409,
    );
  }

  if (nextState !== currentState && !ALLOWED_TRANSITIONS[currentState]?.has(nextState)) {
    throw new AuthError("invalid_lifecycle_transition", `Lifecycle transition from '${currentState}' to '${nextState}' is not allowed.`, 409);
  }

  const nowIso = now.toISOString();
  const graceUntil = optionalTimestamp(transition?.grace_until ?? transition?.graceUntil, "grace_until");
  const coldArchiveAt = optionalTimestamp(transition?.cold_archive_at ?? transition?.coldArchiveAt, "cold_archive_at");
  const deleteAfter = optionalTimestamp(transition?.delete_after ?? transition?.deleteAfter, "delete_after");

  if ([ACCOUNT_LIFECYCLE_STATE.DOWNGRADE_GRACE, ACCOUNT_LIFECYCLE_STATE.INACTIVE_GRACE].includes(nextState)) {
    requireFutureTimestamp(graceUntil, "grace_until", now);
  }
  if (nextState === ACCOUNT_LIFECYCLE_STATE.PENDING_DELETION) {
    requireFutureTimestamp(deleteAfter, "delete_after", now);
  }

  const patch = {
    lifecycle_state: nextState,
    lifecycle_state_changed_at: nextState === currentState
      ? account.lifecycle_state_changed_at || nowIso
      : nowIso,
    grace_until: null,
    cold_archive_at: null,
    delete_after: null,
  };

  if ([ACCOUNT_LIFECYCLE_STATE.DOWNGRADE_GRACE, ACCOUNT_LIFECYCLE_STATE.INACTIVE_GRACE].includes(nextState)) {
    patch.grace_until = graceUntil;
  }
  if (nextState === ACCOUNT_LIFECYCLE_STATE.COLD_ARCHIVED) {
    patch.cold_archive_at = coldArchiveAt || nowIso;
  }
  if (nextState === ACCOUNT_LIFECYCLE_STATE.PENDING_DELETION) {
    patch.cold_archive_at = account.cold_archive_at || coldArchiveAt || nowIso;
    patch.delete_after = deleteAfter;
  }
  return patch;
}

function optionalTimestamp(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new AuthError("invalid_lifecycle_timestamp", `${fieldName} must be a valid timestamp.`, 400);
  }
  return timestamp.toISOString();
}

function requireFutureTimestamp(value, fieldName, now) {
  if (!value || Date.parse(value) <= now.getTime()) {
    throw new AuthError("invalid_lifecycle_timestamp", `${fieldName} must be in the future.`, 400);
  }
}

module.exports = {
  ACCOUNT_LIFECYCLE_STATE,
  effectiveSubscriptionPlan,
  lifecycleTransitionPatch,
  normalizeLifecycleState,
  normalizeSubscriptionPlan,
  optionalTimestamp,
};
