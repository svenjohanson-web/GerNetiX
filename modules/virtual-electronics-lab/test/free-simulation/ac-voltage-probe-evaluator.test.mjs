import assert from "node:assert/strict";
import test from "node:test";

import { simulateFreeAcSweep } from "../../free-simulation/ac-learning-solver.mjs";
import { evaluateAcVoltageProbes } from "../../free-simulation/ac-voltage-probe-evaluator.mjs";
import { createFreeRcLowpassDocument, createFreeRcLowpassMeasurementSetup } from "../../free-simulation/free-circuit-presets.mjs";

test("SPICE-003: differentieller Tastkopf liefert Bode-Betrag und Phase", () => {
  const circuit = createFreeRcLowpassDocument();
  const cutoffHz = 1 / (2 * Math.PI * 1_000 * 1e-6);
  const response = simulateFreeAcSweep({
    schemaVersion: "1.0.0",
    circuit,
    analysis: {
      type: "ac-sweep",
      startFrequencyHz: cutoffHz / 10,
      stopFrequencyHz: cutoffHz * 10,
      pointsPerDecade: 10,
      excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
    },
  });
  const evaluated = evaluateAcVoltageProbes(createFreeRcLowpassMeasurementSetup(), circuit, response);
  assert.equal(evaluated.ok, true);
  const cutoff = evaluated.traces[0].samples[10];
  assert.ok(Math.abs(cutoff.gainDb + 3.010299956639812) < 1e-10);
  assert.ok(Math.abs(cutoff.phaseDeg + 45) < 1e-10);
  assert.equal(Object.isFrozen(evaluated.traces[0].samples), true);
});

test("SPICE-003: ungültige Solverantwort wird fail-closed abgelehnt", () => {
  const result = evaluateAcVoltageProbes(createFreeRcLowpassMeasurementSetup(), createFreeRcLowpassDocument(), { ok: false });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_AC_PROBE_RESPONSE_INVALID");
});
