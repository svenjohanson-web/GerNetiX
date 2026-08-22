import assert from "node:assert/strict";
import test from "node:test";

import {
  AC_RESULT_EVALUATOR_MODEL,
  evaluateAcResult,
} from "../../free-simulation/ac-result-evaluator.mjs";
import { SIMULATION_REQUEST_CONTRACT } from "../../free-simulation/simulation-request-contract.mjs";

function trace(samples, overrides = {}) {
  return { probeId: "probe-1", label: "Ausgang", samples, ...overrides };
}

function result(samples) {
  return evaluateAcResult({ ok: true, traces: [trace(samples)] });
}

test("AC-001: Modellvertrag ist unveränderlich und dokumentiert die Interpolation", () => {
  assert.equal(Object.isFrozen(AC_RESULT_EVALUATOR_MODEL), true);
  assert.equal(AC_RESULT_EVALUATOR_MODEL.threeDbDrop, 3);
  assert.match(AC_RESULT_EVALUATOR_MODEL.interpolation, /log10-frequency/);
});

test("AC-001: Sample-Grenze ist an den zentralen AC-Simulationsvertrag gekoppelt", () => {
  assert.equal(
    AC_RESULT_EVALUATOR_MODEL.maxSamplesPerTrace,
    SIMULATION_REQUEST_CONTRACT.acSweepLimits.maxSamples,
  );
});

test("AC-001: Start, Stopp und Maximum werden aus der Spur übernommen", () => {
  const output = result([
    { frequencyHz: 10, gainDb: -0.1, phaseDeg: -1 },
    { frequencyHz: 100, gainDb: 2, phaseDeg: -10 },
    { frequencyHz: 1_000, gainDb: 0, phaseDeg: -45 },
  ]);
  assert.equal(output.ok, true);
  assert.deepEqual(output.result.traces[0].start, { frequencyHz: 10, gainDb: -0.1, phaseDeg: -1 });
  assert.deepEqual(output.result.traces[0].stop, { frequencyHz: 1_000, gainDb: 0, phaseDeg: -45 });
  assert.deepEqual(output.result.traces[0].maximum, { frequencyHz: 100, gainDb: 2, phaseDeg: -10 });
});

test("AC-001: erster -3-dB-Durchgang wird logarithmisch interpoliert", () => {
  const output = result([
    { frequencyHz: 10, gainDb: 0, phaseDeg: 0 },
    { frequencyHz: 100, gainDb: 0, phaseDeg: -10 },
    { frequencyHz: 1_000, gainDb: -6, phaseDeg: -70 },
    { frequencyHz: 10_000, gainDb: -20, phaseDeg: -90 },
  ]);
  const edge = output.result.traces[0].threeDb;
  assert.equal(output.ok, true);
  assert.equal(edge.thresholdDb, -3);
  assert.equal(edge.frequencyHz, 316.22776601683796);
  assert.equal(edge.phaseDeg, -40);
  assert.match(edge.interpolation, /log10-frequency/);
});

test("AC-001: exakter Schwellenwert wird ohne künstliche Verschiebung übernommen", () => {
  const output = result([
    { frequencyHz: 10, gainDb: 3, phaseDeg: 0 },
    { frequencyHz: 100, gainDb: 0, phaseDeg: -30 },
  ]);
  assert.equal(output.result.traces[0].threeDb.frequencyHz, 100);
  assert.equal(output.result.traces[0].threeDb.phaseDeg, -30);
  assert.deepEqual(output.warnings, []);
});

test("AC-001: fehlender Durchgang liefert Warnung statt erfundenem Kennwert", () => {
  const output = result([
    { frequencyHz: 10, gainDb: 0, phaseDeg: 0 },
    { frequencyHz: 100, gainDb: -1, phaseDeg: -20 },
  ]);
  assert.equal(output.ok, true);
  assert.equal(output.result.traces[0].threeDb.frequencyHz, null);
  assert.equal(output.warnings[0].code, "ELAB_AC_RESULT_NO_3DB_CROSSING");
});

test("AC-001: unzureichender Sweep wird markiert", () => {
  const output = result([{ frequencyHz: 10, gainDb: 0, phaseDeg: 0 }]);
  assert.equal(output.ok, true);
  assert.deepEqual(output.result.traces[0].warnings.map((entry) => entry.code), [
    "ELAB_AC_RESULT_SWEEP_TOO_SHORT",
    "ELAB_AC_RESULT_NO_3DB_CROSSING",
  ]);
});

test("AC-001: ungültige und nichtmonotone Eingaben werden fail-closed abgelehnt", () => {
  assert.equal(evaluateAcResult(null).errors[0].code, "ELAB_AC_RESULT_INPUT_INVALID");
  assert.equal(result([
    { frequencyHz: 100, gainDb: 0, phaseDeg: 0 },
    { frequencyHz: 10, gainDb: -4, phaseDeg: -20 },
  ]).errors[0].code, "ELAB_AC_RESULT_FREQUENCY_NOT_MONOTONIC");
  assert.equal(result([{ frequencyHz: 10, gainDb: null, phaseDeg: 0 }]).errors[0].code, "ELAB_AC_RESULT_SAMPLE_INVALID");
});

test("AC-001: Ausgabe ist tief unveränderlich und deterministisch", () => {
  const input = {
    ok: true,
    traces: [trace([
      { frequencyHz: 10, gainDb: 0, phaseDeg: 0 },
      { frequencyHz: 100, gainDb: -4, phaseDeg: -30 },
    ])],
  };
  const first = evaluateAcResult(input);
  const second = evaluateAcResult(input);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first.result), true);
  assert.equal(Object.isFrozen(first.result.traces[0].threeDb), true);
  assert.equal(Object.isFrozen(first.warnings), true);
});
