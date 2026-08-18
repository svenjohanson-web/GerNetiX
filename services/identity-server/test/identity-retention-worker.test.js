"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createIdentityRetentionCleanup, createIdentityRetentionWorker } = require("../src/services/identity-retention-worker");

test("runtime wiring keeps both retention policies disabled by default", () => {
  const workspace = path.resolve(__dirname, "../../..");
  const envExample = fs.readFileSync(path.join(workspace, ".env.vps.example"), "utf8");
  const compose = fs.readFileSync(path.join(workspace, "compose.vps.yaml"), "utf8");
  const server = fs.readFileSync(path.join(__dirname, "../src/dev-server.js"), "utf8");
  assert.match(envExample, /^COMMUNITY_NOTIFICATION_RETENTION_ENABLED=0$/m);
  assert.match(envExample, /^IDENTITY_TOKEN_RETENTION_ENABLED=0$/m);
  assert.match(compose, /IDENTITY_TOKEN_RETENTION_ENABLED: \$\{IDENTITY_TOKEN_RETENTION_ENABLED:-0\}/);
  assert.match(server, /identityRetentionWorker\.start\(\)/);
});

test("identity retention cleanup is dormant unless each policy is explicitly enabled", async () => {
  const calls = [];
  const cleanup = createIdentityRetentionCleanup({
    getAuth: () => ({
      purge_community_notification_deliveries: async (input) => { calls.push(["notifications", input]); return { total: 1 }; },
      purge_expired_authentication_records: async (input) => { calls.push(["tokens", input]); return { total: 2 }; },
    }),
    env: {},
    clock: () => new Date("2026-08-18T00:00:00.000Z").getTime(),
  });

  const result = await cleanup();
  assert.equal(result.notification_deliveries.enabled, false);
  assert.equal(result.authentication_records.enabled, false);
  assert.deepEqual(calls, []);
});

test("identity retention cleanup applies bounded explicit cutoffs independently", async () => {
  const calls = [];
  const cleanup = createIdentityRetentionCleanup({
    getAuth: () => ({
      purge_community_notification_deliveries: async (input) => { calls.push(["notifications", input]); return { total: 1 }; },
      purge_expired_authentication_records: async (input) => { calls.push(["tokens", input]); return { total: 2 }; },
    }),
    env: {
      COMMUNITY_NOTIFICATION_RETENTION_ENABLED: "1",
      COMMUNITY_NOTIFICATION_DELIVERED_RETENTION_DAYS: "30",
      COMMUNITY_NOTIFICATION_DEAD_LETTER_RETENTION_DAYS: "90",
      IDENTITY_TOKEN_RETENTION_ENABLED: "1",
      IDENTITY_EXPIRED_TOKEN_RETENTION_DAYS: "7",
      IDENTITY_SUPPORT_RECOVERY_RETENTION_DAYS: "30",
    },
    clock: () => new Date("2026-08-18T00:00:00.000Z").getTime(),
  });

  const result = await cleanup();
  assert.equal(result.notification_deliveries.enabled, true);
  assert.equal(result.authentication_records.enabled, true);
  assert.deepEqual(calls, [
    ["notifications", { terminal_before: "2026-07-19T00:00:00.000Z", failed_before: "2026-05-20T00:00:00.000Z" }],
    ["tokens", { token_before: "2026-08-11T00:00:00.000Z", support_recovery_before: "2026-07-19T00:00:00.000Z" }],
  ]);
});

test("identity retention worker deduplicates concurrent cleanup runs", async () => {
  let cleanupCalls = 0;
  let release;
  const worker = createIdentityRetentionWorker({
    cleanup: () => new Promise((resolve) => { cleanupCalls += 1; release = resolve; }),
    logger: { warn() {} },
  });

  const first = worker.run();
  const second = worker.run();
  assert.equal(first, second);
  await Promise.resolve();
  release({ authentication_records: { enabled: false } });
  assert.deepEqual(await first, { authentication_records: { enabled: false } });
  assert.equal(cleanupCalls, 1);
});

test("identity retention worker reports cleanup failures without terminating", async () => {
  const warnings = [];
  const worker = createIdentityRetentionWorker({
    cleanup: async () => { throw new Error("database unavailable\nprivate detail"); },
    logger: { warn(message) { warnings.push(message); } },
  });

  assert.deepEqual(await worker.run(), { unavailable: true });
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /\n/);
});
