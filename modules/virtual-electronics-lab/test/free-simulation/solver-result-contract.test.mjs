import assert from "node:assert/strict";
import test from "node:test";

import { SIMULATION_REQUEST_CONTRACT } from "../../free-simulation/simulation-request-contract.mjs";
import { SOLVER_RESULT_CONTRACT, normalizeSolverResult } from "../../free-simulation/solver-result-contract.mjs";

function scalarResult(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    requestSchemaVersion: "1.0.0",
    documentId: "circuit-1",
    documentVersion: "1.0.0",
    analysis: "dc-operating-point",
    axis: { kind: "operating-point", unit: "index", values: [0] },
    nodes: [
      { nodeId: "out", values: [{ voltageV: 2.5 }] },
      { nodeId: "gnd", values: [{ voltageV: 0 }] },
    ],
    branches: [{
      componentId: "r1",
      componentType: "resistor",
      fromNode: "out",
      toNode: "gnd",
      values: [{ voltageV: 2.5, currentA: 0.0025, powerW: 0.00625 }],
    }],
    models: [{ modelId: "linear-mna", modelVersion: "1.0.0" }],
    diagnostics: [{ code: "ELAB_SOLVER_CONVERGED", severity: "info", message: "Eindeutige Lösung." }],
    ...overrides,
  };
}

function complex(value, phaseDeg = 0) {
  return { real: value, imaginary: 0, magnitude: Math.abs(value), phaseDeg };
}

test("SPICE-005: DC-Ergebnis wird deterministisch normalisiert und tief eingefroren", () => {
  const normalized = normalizeSolverResult(scalarResult());
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.result.nodes.map((series) => series.nodeId), ["gnd", "out"]);
  assert.equal(Object.isFrozen(normalized.result), true);
  assert.equal(Object.isFrozen(normalized.result.nodes[0].values[0]), true);
  assert.equal(Object.isFrozen(normalized.result.diagnostics), true);
});

test("SPICE-005: Transientenergebnis verlangt eine streng monotone Zeitachse", () => {
  const result = scalarResult({
    analysis: "transient",
    axis: { kind: "time", unit: "s", values: [0, 0.001, 0.002] },
    nodes: [{ nodeId: "out", values: [{ voltageV: 0 }, { voltageV: 1 }, { voltageV: 2 }] }],
    branches: [],
    diagnostics: [],
  });
  assert.equal(normalizeSolverResult(result).ok, true);
  assert.equal(normalizeSolverResult({ ...result, axis: { ...result.axis, values: [0, 0.001, 0.001] } }).errors[0].code, "ELAB_SOLVER_RESULT_AXIS_INVALID");
  assert.equal(normalizeSolverResult({ ...result, axis: { ...result.axis, values: [-0.001, 0, 0.001] } }).errors[0].code, "ELAB_SOLVER_RESULT_AXIS_INVALID");
});

test("SPICE-005: AC-Ergebnis validiert Frequenzachse und komplexe Knoten- und Zweigwerte", () => {
  const result = scalarResult({
    analysis: "ac-sweep",
    axis: { kind: "frequency", unit: "Hz", values: [10, 100] },
    nodes: [{ nodeId: "out", values: [complex(1), complex(0.5, -45)] }],
    branches: [{
      componentId: "r1",
      componentType: "resistor",
      fromNode: "in",
      toNode: "out",
      values: [
        { voltage: complex(0.1), current: complex(0.0001) },
        { voltage: complex(0.5, 45), current: complex(0.0005, 45) },
      ],
    }],
    diagnostics: [],
  });
  const normalized = normalizeSolverResult(result);
  assert.equal(normalized.ok, true);
  assert.equal(normalized.result.nodes[0].values[1].phaseDeg, -45);
  assert.equal(Object.isFrozen(normalized.result.branches[0].values[0].voltage), true);
  assert.equal(normalizeSolverResult({ ...result, axis: { ...result.axis, values: [0, 100] } }).errors[0].code, "ELAB_SOLVER_RESULT_AXIS_INVALID");
});

test("SPICE-005: Request-Version und Achsengrenzen sind an den zentralen Simulationsvertrag gekoppelt", () => {
  assert.equal(SOLVER_RESULT_CONTRACT.requestSchemaVersion, SIMULATION_REQUEST_CONTRACT.schemaVersion);
  assert.equal(
    SOLVER_RESULT_CONTRACT.limits.maxAxisValuesByAnalysis.transient,
    SIMULATION_REQUEST_CONTRACT.transientLimits.maxSteps + 1,
  );
  assert.equal(
    SOLVER_RESULT_CONTRACT.limits.maxAxisValuesByAnalysis["ac-sweep"],
    SIMULATION_REQUEST_CONTRACT.acSweepLimits.maxSamples,
  );

  const acValues = Array.from({ length: SIMULATION_REQUEST_CONTRACT.acSweepLimits.maxSamples + 1 }, (_, index) => index + 1);
  const ac = scalarResult({
    analysis: "ac-sweep",
    axis: { kind: "frequency", unit: "Hz", values: acValues },
    nodes: [],
    branches: [],
    diagnostics: [],
  });
  assert.equal(normalizeSolverResult(ac).errors[0].code, "ELAB_SOLVER_RESULT_AXIS_INVALID");
});

test("SPICE-005: unbekannte Felder und Raw-Text werden fail-closed abgelehnt", () => {
  assert.equal(normalizeSolverResult(".op\n.end\n").errors[0].code, "ELAB_SOLVER_RESULT_REQUIRED");
  assert.equal(normalizeSolverResult({ ...scalarResult(), rawNetlist: ".op" }).errors[0].code, "ELAB_SOLVER_RESULT_UNKNOWN_KEYS");
  const badValue = scalarResult({ nodes: [{ nodeId: "out", values: [{ voltageV: 1, raw: "1V" }] }] });
  assert.equal(normalizeSolverResult(badValue).errors[0].code, "ELAB_SOLVER_RESULT_NODES_INVALID");
});

test("SPICE-005: Serienlängen, IDs, Diagnosetexte und Ergebniswerte sind hart begrenzt", () => {
  const duplicate = scalarResult({ nodes: [
    { nodeId: "out", values: [{ voltageV: 1 }] },
    { nodeId: "out", values: [{ voltageV: 2 }] },
  ] });
  assert.equal(normalizeSolverResult(duplicate).errors[0].code, "ELAB_SOLVER_RESULT_NODES_INVALID");
  assert.equal(normalizeSolverResult(scalarResult({ diagnostics: [{ code: "WARN", severity: "warning", message: "x".repeat(513) }] })).errors[0].code, "ELAB_SOLVER_RESULT_DIAGNOSTICS_INVALID");

  const values = Array.from({ length: SIMULATION_REQUEST_CONTRACT.transientLimits.maxSteps + 1 }, (_, index) => index / 1_000);
  const nodes = Array.from({ length: 64 }, (_, index) => ({
    nodeId: `n${index}`,
    values: values.map(() => ({ voltageV: 0 })),
  }));
  const tooLarge = scalarResult({
    analysis: "transient",
    axis: { kind: "time", unit: "s", values },
    nodes,
    branches: [],
    diagnostics: [],
  });
  assert.equal(normalizeSolverResult(tooLarge).errors[0].code, "ELAB_SOLVER_RESULT_VALUE_LIMIT");
  assert.equal(SOLVER_RESULT_CONTRACT.limits.maxOutputValues, 64_000);
});

test("SPICE-005: Normalisierung verändert die Eingabe nicht", () => {
  const input = scalarResult();
  const before = structuredClone(input);
  normalizeSolverResult(input);
  assert.deepEqual(input, before);
});
