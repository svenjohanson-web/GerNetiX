import assert from "node:assert/strict";
import test from "node:test";

import {
  AC_RESULT_VIEW_MODEL,
  createAcResultViewModel,
} from "../../free-simulation/ac-result-view-model.mjs";
import { AC_RESULT_EVALUATOR_MODEL } from "../../free-simulation/ac-result-evaluator.mjs";

function probes() {
  return {
    ok: true,
    traces: [{
      probeId: "probe-out",
      label: "Ausgang",
      samples: [
        { frequencyHz: 10, gainDb: 0, phaseDeg: 0 },
        { frequencyHz: 100, gainDb: -2, phaseDeg: -20 },
        { frequencyHz: 1_000, gainDb: -4, phaseDeg: -60 },
      ],
    }],
  };
}

test("AC-003: Vertrag ist unveränderlich und an AC-001 gekoppelt", () => {
  assert.equal(Object.isFrozen(AC_RESULT_VIEW_MODEL), true);
  assert.equal(Object.isFrozen(AC_RESULT_VIEW_MODEL.supportedStates), true);
  assert.equal(AC_RESULT_VIEW_MODEL.evaluatorModelId, AC_RESULT_EVALUATOR_MODEL.modelId);
  assert.equal(AC_RESULT_VIEW_MODEL.evaluatorModelVersion, AC_RESULT_EVALUATOR_MODEL.modelVersion);
});

test("AC-003: Success erzeugt logarithmische Plotpunkte, Kennwertkarten und Tabelle", () => {
  const output = createAcResultViewModel({ state: "success", probeEvaluation: probes() });
  assert.equal(output.ok, true);
  assert.equal(output.view.state, "success");
  assert.deepEqual(output.view.plots.frequencyAxis, { scale: "log10", unit: "Hz", minimum: 10, maximum: 1_000 });
  assert.deepEqual(output.view.plots.magnitude.traces[0].points.map((point) => point.x), [0, 0.5, 1]);
  assert.deepEqual(output.view.plots.magnitude.traces[0].points.map((point) => point.y), [0, 0.5, 1]);
  assert.deepEqual(output.view.plots.phase.traces[0].points.map((point) => point.value), [0, -20, -60]);
  assert.equal(output.view.metricCards[0].metrics.find((metric) => metric.id === "three-db-frequency").available, true);
  assert.equal(output.view.metricCards[0].metrics.find((metric) => metric.id === "three-db-frequency").value, 316.22776601683796);
  assert.deepEqual(output.view.table.rows[0], {
    probeId: "probe-out",
    label: "Ausgang",
    startGainDb: 0,
    stopGainDb: -4,
    maximumGainDb: 0,
    threeDbFrequencyHz: 316.22776601683796,
    phaseAtThreeDbFrequencyDeg: -40,
  });
});

test("AC-003: fehlender Drei-dB-Durchgang bleibt sichtbar aber nicht verfügbar", () => {
  const input = probes();
  input.traces[0].samples = input.traces[0].samples.slice(0, 2);
  const output = createAcResultViewModel({ state: "success", probeEvaluation: input });
  const cutoff = output.view.metricCards[0].metrics.find((metric) => metric.id === "three-db-frequency");
  assert.equal(output.ok, true);
  assert.deepEqual(cutoff, { id: "three-db-frequency", label: "−3-dB-Eckfrequenz", value: null, unit: "Hz", available: false });
  assert.equal(output.view.table.rows[0].threeDbFrequencyHz, null);
  assert.equal(output.view.warnings[0].code, "ELAB_AC_RESULT_NO_3DB_CROSSING");
});

test("AC-003: Empty und Invalidated enthalten keine veralteten Ergebnisdaten", () => {
  const empty = createAcResultViewModel({ state: "empty" });
  const invalidated = createAcResultViewModel({ state: "invalidated" });
  assert.equal(empty.ok, true);
  assert.equal(empty.view.state, "empty");
  assert.equal(empty.view.plots, null);
  assert.deepEqual(empty.view.metricCards, []);
  assert.equal(empty.view.table, null);
  assert.equal(invalidated.view.state, "invalidated");
  assert.equal(invalidated.view.status.tone, "warning");
  assert.equal(invalidated.view.plots, null);
  assert.deepEqual(invalidated.view.metricCards, []);
});

test("AC-003: Error übernimmt ausschließlich begrenzte Code- und Meldungstexte", () => {
  const output = createAcResultViewModel({
    state: "error",
    errors: [{ code: "ELAB_AC_SOLVER_FAILED", message: "Matrix ist singulär." }],
  });
  assert.equal(output.ok, true);
  assert.equal(output.view.state, "error");
  assert.equal(output.view.status.tone, "error");
  assert.equal(output.view.status.message, "Matrix ist singulär.");
  assert.deepEqual(output.view.errors, [{ code: "ELAB_AC_SOLVER_FAILED", message: "Matrix ist singulär." }]);
  assert.equal(output.view.plots, null);
  assert.equal(createAcResultViewModel({ state: "error", errors: [{ code: "E", message: "" }] }).errors[0].code, "ELAB_AC_VIEW_ERRORS_INVALID");
  assert.equal(createAcResultViewModel({ state: "error", errors: [{ code: "BAD CODE", message: "Fehler" }] }).errors[0].code, "ELAB_AC_VIEW_ERRORS_INVALID");
  assert.equal(createAcResultViewModel({ state: "error", errors: [{ code: "BAD_CODE", message: "Erste Zeile\nZweite Zeile" }] }).errors[0].code, "ELAB_AC_VIEW_ERRORS_INVALID");
  assert.equal(createAcResultViewModel({ state: "error", errors: [{ code: "BAD_CODE", message: "Steuerzeichen\u007f" }] }).errors[0].code, "ELAB_AC_VIEW_ERRORS_INVALID");
});

test("AC-003: ungültige oder doppelte Tastkopfidentitäten gelangen nicht in die Darstellung", () => {
  const invalidLabel = probes();
  invalidLabel.traces[0].label = "";
  assert.equal(
    createAcResultViewModel({ state: "success", probeEvaluation: invalidLabel }).errors[0].code,
    "ELAB_AC_VIEW_TRACE_IDENTITY_INVALID",
  );
  const duplicate = probes();
  duplicate.traces.push({ ...structuredClone(duplicate.traces[0]) });
  assert.equal(
    createAcResultViewModel({ state: "success", probeEvaluation: duplicate }).errors[0].code,
    "ELAB_AC_VIEW_TRACE_IDENTITY_INVALID",
  );
});

test("AC-003: ungültige Success-Eingabe wird über AC-001 fail-closed abgelehnt", () => {
  const invalid = createAcResultViewModel({
    state: "success",
    probeEvaluation: {
      ok: true,
      traces: [{
        probeId: "probe-out",
        label: "Ausgang",
        samples: [{ frequencyHz: 10, gainDb: Number.NaN, phaseDeg: 0 }],
      }],
    },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, "ELAB_AC_VIEW_EVALUATION_INVALID");
  assert.equal(invalid.errors[0].cause, "ELAB_AC_RESULT_SAMPLE_INVALID");
});

test("AC-003: unbekannte Zustände und Felder werden fail-closed abgelehnt", () => {
  assert.equal(createAcResultViewModel(null).errors[0].code, "ELAB_AC_VIEW_INPUT_INVALID");
  assert.equal(createAcResultViewModel({ state: "loading" }).errors[0].code, "ELAB_AC_VIEW_STATE_INVALID");
  assert.equal(createAcResultViewModel({ state: "empty", traces: [] }).errors[0].code, "ELAB_AC_VIEW_UNKNOWN_KEYS");
  assert.equal(createAcResultViewModel({ state: "success", probeEvaluation: probes(), rawHtml: "<b>x</b>" }).errors[0].code, "ELAB_AC_VIEW_UNKNOWN_KEYS");
});

test("AC-003: Ausgabe ist deterministisch, tief unveränderlich und verändert Eingaben nicht", () => {
  const probeEvaluation = probes();
  const before = structuredClone(probeEvaluation);
  const first = createAcResultViewModel({ state: "success", probeEvaluation });
  const second = createAcResultViewModel({ state: "success", probeEvaluation });
  assert.deepEqual(first, second);
  assert.deepEqual(probeEvaluation, before);
  assert.equal(Object.isFrozen(first.view), true);
  assert.equal(Object.isFrozen(first.view.plots.magnitude.traces[0].points[0]), true);
  assert.equal(Object.isFrozen(first.view.metricCards[0].metrics), true);
  assert.equal(Object.isFrozen(first.view.table.rows), true);
});

test("AC-003: einzelne und konstante Messwerte erhalten endliche Plotkoordinaten", () => {
  const output = createAcResultViewModel({
    state: "success",
    probeEvaluation: {
      ok: true,
      traces: [{
        probeId: "probe-constant",
        label: "Konstant",
        samples: [{ frequencyHz: 100, gainDb: 0, phaseDeg: 0 }],
      }],
    },
  });
  const magnitude = output.view.plots.magnitude.traces[0].points[0];
  const phase = output.view.plots.phase.traces[0].points[0];
  assert.deepEqual([magnitude.x, magnitude.y], [0, 0.5]);
  assert.deepEqual([phase.x, phase.y], [0, 0.5]);
});
