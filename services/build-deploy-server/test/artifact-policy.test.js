"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createArtifactPolicySource } = require("../src/modules/artifact-contract");
const { ArtifactRetentionScheduler } = require("../src/modules/artifact-retention-scheduler");
const { BuildDeployService } = require("../src/services/build-deploy-service");

test("validated policy overrides change retention without trusting worker metadata", () => {
  const source = createArtifactPolicySource({
    "firmware.elf": { retentionDays: 2 },
    "firmware.bin": { retentionDays: 7 },
  });
  assert.equal(source.get("firmware.elf").retentionDays, 2);
  assert.equal(source.get("firmware.bin").retentionDays, 7);
  assert.equal(source.get("build.log").retentionDays, 14);
  assert.equal(source.allowsForProfile("firmware.bin", "standard"), true);
  assert.equal(source.allowsForProfile("firmware.elf", "standard"), false);
  assert.equal(source.allowsForProfile("firmware.elf", "debug"), true);
  assert.throws(() => createArtifactPolicySource({ "firmware.elf": { retentionDays: 0 } }), /Aufbewahrungsdauer/);
  assert.throws(() => createArtifactPolicySource({ "firmware.bin": { artifactClass: "symbols" } }), /Nicht konfigurierbare/);
  assert.throws(() => createArtifactPolicySource({ "private.key": { retentionDays: 7 } }), /Unbekanntes Artefakt/);
});

test("retention scheduler exposes an explicit independently runnable prune contract", async () => {
  let calls = 0;
  const scheduler = new ArtifactRetentionScheduler({
    artifactStore: { async pruneExpired() { calls += 1; return { deleted_count: 3 }; } },
    intervalMs: 1000,
  });
  assert.deepEqual(await scheduler.runOnce(), { deleted_count: 3 });
  assert.equal(calls, 1);
  assert.equal(scheduler.start(), scheduler);
  scheduler.close();
});

test("build policy summary exposes the effective server-side retention and cache settings", () => {
  const service = new BuildDeployService({
    packageStore: { incrementalCacheTtlMs: 604800000, incrementalCachePruneIntervalMs: 3600000 },
    artifactPolicySource: createArtifactPolicySource({ "firmware.elf": { retentionDays: 5 } }),
  });
  const summary = service.policySummary();
  assert.equal(summary.policy_id, "build_artifact_and_cache_policy");
  assert.deepEqual(summary.build_profiles, ["standard", "debug"]);
  assert.equal(summary.artifacts.find((item) => item.file_name === "firmware.elf").retention_days, 5);
  assert.equal(summary.artifacts.find((item) => item.file_name === "firmware.elf").standard_build, false);
  assert.equal(summary.incremental_cache.ttl_ms, 604800000);
});
