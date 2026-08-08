"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { checkSnapshot } = require("../integrity/check-snapshot");

function validSnapshot() {
  return {
    accounts: [{ account_id: "account-a" }],
    projects: [{ project_id: "project-a", owner_account_id: "account-a" }],
    build_jobs: [{ build_job_id: "build-a", project_id: "project-a", idempotency_key: "op-a", status: "running" }],
    ledger_entries: [{ ledger_entry_id: "ledger-a", account_id: "account-a", operation_id: "ai-op-a" }],
    telemetry_events: [{ event_id: "event-a", account_id: "account-a", project_id: "project-a", device_id: "device-a", message_id: "message-a" }],
  };
}

test("accepts a consistent post-run snapshot", () => {
  assert.deepEqual(checkSnapshot(validSnapshot()), { ok: true, issues: [] });
});

test("detects cross-account telemetry", () => {
  const snapshot = validSnapshot();
  snapshot.telemetry_events[0].account_id = "account-b";
  assert.deepEqual(checkSnapshot(snapshot).issues.map(({ code }) => code), ["telemetry_ownership_mismatch"]);
});

test("detects duplicate active builds and ledger operations", () => {
  const snapshot = validSnapshot();
  snapshot.build_jobs.push({ build_job_id: "build-b", project_id: "project-a", idempotency_key: "op-a", status: "queued" });
  snapshot.ledger_entries.push({ ledger_entry_id: "ledger-b", account_id: "account-a", operation_id: "ai-op-a" });
  assert.deepEqual(checkSnapshot(snapshot).issues.map(({ code }) => code), [
    "duplicate_active_build",
    "duplicate_ledger_operation",
  ]);
});

test("requires duplicate telemetry to be marked as deduplicated", () => {
  const snapshot = validSnapshot();
  snapshot.telemetry_events.push({
    event_id: "event-b",
    account_id: "account-a",
    project_id: "project-a",
    device_id: "device-a",
    message_id: "message-a",
    deduplicated: true,
  });
  assert.equal(checkSnapshot(snapshot).ok, true);
  delete snapshot.telemetry_events[1].deduplicated;
  assert.equal(checkSnapshot(snapshot).issues[0].code, "telemetry_duplicate_not_deduplicated");
});
