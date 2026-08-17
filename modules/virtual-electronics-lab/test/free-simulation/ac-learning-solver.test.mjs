import assert from "node:assert/strict";
import test from "node:test";

import { FREE_AC_MODEL, simulateFreeAcSweep } from "../../free-simulation/ac-learning-solver.mjs";
import { FREE_CIRCUIT_COMMAND_TYPES, createFreeCircuitCommandRuntime } from "../../free-simulation/free-circuit-command-runtime.mjs";
import { createFreeRcChargeDocument } from "../../free-simulation/free-circuit-presets.mjs";

function acRequest(circuit, overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    circuit,
    analysis: {
      type: "ac-sweep",
      startFrequencyHz: 10,
      stopFrequencyHz: 100_000,
      pointsPerDecade: 10,
      excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
      ...overrides,
    },
  };
}

function add(runtime, componentId, componentType) {
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId, componentType });
}

function connect(runtime, fromComponent, fromPort, toComponent, toPort) {
  runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: fromComponent, portId: fromPort },
    to: { componentId: toComponent, portId: toPort },
  });
}

function node(sample, nodeId) {
  return sample.nodeVoltages.find((entry) => entry.nodeId === nodeId);
}

test("SPICE-002: RC-Tiefpass erreicht an der Grenzfrequenz -3,01 dB und -45 Grad", () => {
  const cutoffHz = 1 / (2 * Math.PI * 1_000 * 1e-6);
  const result = simulateFreeAcSweep(acRequest(createFreeRcChargeDocument(), {
    startFrequencyHz: cutoffHz / 10,
    stopFrequencyHz: cutoffHz * 10,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.result.sampleCount, 21);
  const output = node(result.result.samples[10], "c1-p");
  assert.ok(Math.abs(output.magnitude - (1 / Math.sqrt(2))) < 1e-12);
  assert.ok(Math.abs(output.phaseDeg + 45) < 1e-10);
  assert.equal(result.result.diagnostics.solver, "deterministic-complex-linear-mna");
});

test("SPICE-002: RL-Netzwerk verwendet denselben komplexen MNA-Kern", () => {
  const runtime = createFreeCircuitCommandRuntime();
  add(runtime, "gnd1", "gnd"); add(runtime, "v1", "dc-voltage-source"); add(runtime, "r1", "resistor"); add(runtime, "l1", "inductor");
  connect(runtime, "v1", "n", "gnd1", "0"); connect(runtime, "v1", "p", "r1", "p"); connect(runtime, "r1", "n", "l1", "p"); connect(runtime, "l1", "n", "gnd1", "0");
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: "l1", parameterName: "inductance", value: 1 });
  const cutoffHz = 1_000 / (2 * Math.PI);
  const result = simulateFreeAcSweep(acRequest(runtime.getSnapshot(), { startFrequencyHz: cutoffHz / 10, stopFrequencyHz: cutoffHz * 10 }));
  const output = node(result.result.samples[10], "l1-p");
  assert.ok(Math.abs(output.magnitude - (1 / Math.sqrt(2))) < 1e-12);
  assert.ok(Math.abs(output.phaseDeg - 45) < 1e-10);
});

test("SPICE-002: Phase der Anregung wird komplex übernommen", () => {
  const result = simulateFreeAcSweep(acRequest(createFreeRcChargeDocument(), {
    startFrequencyHz: 10,
    stopFrequencyHz: 100,
    excitation: { sourceComponentId: "v1", amplitudeV: 2, phaseDeg: 90 },
  }));
  const sourceNode = node(result.result.samples[0], "r1-p");
  assert.ok(Math.abs(sourceNode.magnitude - 2) < 1e-12);
  assert.ok(Math.abs(sourceNode.phaseDeg - 90) < 1e-12);
});

test("SPICE-002: unsupported und singulär werden stabil diagnostiziert", () => {
  const unsupportedRuntime = createFreeCircuitCommandRuntime({ document: createFreeRcChargeDocument() });
  add(unsupportedRuntime, "d1", "led");
  assert.equal(simulateFreeAcSweep(acRequest(unsupportedRuntime.getSnapshot())).errors[0].code, "ELAB_AC_COMPONENT_UNSUPPORTED");

  const singularRuntime = createFreeCircuitCommandRuntime({ document: createFreeRcChargeDocument() });
  add(singularRuntime, "r-floating", "resistor");
  assert.equal(simulateFreeAcSweep(acRequest(singularRuntime.getSnapshot())).errors[0].code, "ELAB_AC_SINGULAR_CIRCUIT");
});

test("SPICE-002: Wiederholung ist identisch und tief unveränderlich", () => {
  const input = acRequest(createFreeRcChargeDocument());
  const first = simulateFreeAcSweep(input);
  const second = simulateFreeAcSweep(input);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first.result.samples), true);
  assert.equal(Object.isFrozen(first.result.samples[0].nodeVoltages), true);
  assert.equal(Object.isFrozen(FREE_AC_MODEL.supportedComponentTypes), true);
});
