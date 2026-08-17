import assert from "node:assert/strict";
import test from "node:test";

import { SPICE_PROVIDER_POLICY, assessSpiceProvider } from "../../free-simulation/spice-provider-feasibility.mjs";

const eligibleCandidate = Object.freeze({
  pinnedUpstreamRelease: true,
  reproducibleSelfBuild: true,
  licenseReviewed: true,
  dedicatedWorker: true,
  terminateOnTimeout: true,
  fixedMemory: true,
  generatedNetlistOnly: true,
  rawCommandInterface: false,
  networkAccess: false,
  persistentFileSystem: false,
  maxMemoryBytes: 64 * 1024 * 1024,
  maxRuntimeMs: 2_000,
});

test("FREE-007: Providerpolicy erlaubt weder Raw-SPICE noch ungebremste Ressourcen", () => {
  assert.equal(SPICE_PROVIDER_POLICY.rawSpiceAccepted, false);
  assert.equal(SPICE_PROVIDER_POLICY.generatedNetlistOnly, true);
  assert.equal(SPICE_PROVIDER_POLICY.limits.maxRuntimeMs, 2_000);
  assert.equal(SPICE_PROVIDER_POLICY.limits.maxMemoryBytes, 64 * 1024 * 1024);
  assert.equal(Object.isFrozen(SPICE_PROVIDER_POLICY.mandatoryGates), true);
});

test("FREE-007: nur vollständig isolierter, reproduzierbarer Provider besteht die Gates", () => {
  assert.deepEqual(assessSpiceProvider(eligibleCandidate), { ok: true, eligible: true, policyVersion: "1.0.0" });
});

test("FREE-007: inoffizieller Export-All-Prototyp wird kontrolliert abgelehnt", () => {
  const result = assessSpiceProvider({
    ...eligibleCandidate,
    pinnedUpstreamRelease: false,
    reproducibleSelfBuild: false,
    rawCommandInterface: true,
    fixedMemory: false,
    maxMemoryBytes: 256 * 1024 * 1024,
  });
  assert.equal(result.ok, false);
  assert.equal(result.eligible, false);
  assert.ok(result.errors.some((error) => error.gate === "rawCommandInterface"));
  assert.ok(result.errors.some((error) => error.code === "ELAB_SPICE_PROVIDER_MEMORY_LIMIT"));
});

