import assert from "node:assert/strict";
import test from "node:test";

import { createFreeDcDividerDocument, createFreeRcChargeDocument } from "../../free-simulation/free-circuit-presets.mjs";
import { executeLearningSimulationRequest } from "../../free-simulation/simulation-request-runtime.mjs";

test("SPICE-001: gemeinsamer Dispatcher führt DC-Auftrag über vorhandenen Adapter aus", () => {
  const result = executeLearningSimulationRequest({
    schemaVersion: "1.0.0",
    circuit: createFreeDcDividerDocument(),
    analysis: { type: "dc-operating-point" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.analysis, "dc-operating-point");
  assert.equal(Object.isFrozen(result.result), true);
});

test("SPICE-001: gemeinsamer Dispatcher führt Transientenauftrag über vorhandenen Solver aus", () => {
  const result = executeLearningSimulationRequest({
    schemaVersion: "1.0.0",
    circuit: createFreeRcChargeDocument(),
    analysis: { type: "transient", timeStepS: 0.0001, stopTimeS: 0.001 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.analysis, "transient-step-response");
  assert.equal(result.result.sampleCount, 11);
  assert.equal(Object.isFrozen(result.result.samples), true);
});

test("SPICE-001: ungültiger Auftrag erreicht keinen Solver", () => {
  const result = executeLearningSimulationRequest({
    schemaVersion: "1.0.0",
    circuit: createFreeDcDividerDocument(),
    analysis: { type: "ac-sweep" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorSource, "simulation-request-contract");
  assert.equal(result.errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");
});

test("SPICE-002: gemeinsamer Dispatcher führt AC-Auftrag über den komplexen Lernsolver aus", () => {
  const result = executeLearningSimulationRequest({
    schemaVersion: "1.0.0",
    circuit: createFreeRcChargeDocument(),
    analysis: {
      type: "ac-sweep",
      startFrequencyHz: 10,
      stopFrequencyHz: 100_000,
      pointsPerDecade: 10,
      excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.analysis, "ac-sweep");
  assert.equal(result.result.sampleCount, 41);
});
