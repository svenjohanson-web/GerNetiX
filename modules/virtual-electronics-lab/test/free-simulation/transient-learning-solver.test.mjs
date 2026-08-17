import assert from "node:assert/strict";
import test from "node:test";

import { FREE_CIRCUIT_COMMAND_TYPES, createFreeCircuitCommandRuntime } from "../../free-simulation/free-circuit-command-runtime.mjs";
import { createFreeRcChargeDocument } from "../../free-simulation/free-circuit-presets.mjs";
import { FREE_TRANSIENT_MODEL, simulateFreeTransient } from "../../free-simulation/transient-learning-solver.mjs";

const analysis = Object.freeze({ timeStepS: 0.0001, stopTimeS: 0.01 });

function build(types, connections) {
  const runtime = createFreeCircuitCommandRuntime();
  for (const [componentId, componentType] of types) runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId, componentType });
  for (const [fromComponent, fromPort, toComponent, toPort] of connections) {
    runtime.dispatch({
      type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
      from: { componentId: fromComponent, portId: fromPort },
      to: { componentId: toComponent, portId: toPort },
    });
  }
  return runtime;
}

function nodeVoltage(sample, nodeId) {
  return sample.nodeVoltages.find((node) => node.nodeId === nodeId).voltageV;
}

test("FREE-008: RC-Ladevorgang folgt deterministisch dem Backward-Euler-Modell", () => {
  const result = simulateFreeTransient(createFreeRcChargeDocument(), analysis);
  assert.equal(result.ok, true);
  assert.equal(result.result.sampleCount, 101);
  assert.equal(nodeVoltage(result.result.samples[0], "c1-p"), 0);
  const afterOneTau = nodeVoltage(result.result.samples[10], "c1-p");
  const expected = 5 * (1 - (1 / 1.1) ** 10);
  assert.ok(Math.abs(afterOneTau - expected) < 1e-12);
  assert.ok(nodeVoltage(result.result.samples.at(-1), "c1-p") > 4.99);
  assert.equal(result.result.diagnostics.integration, "backward-euler");
});

test("FREE-008: RL-Stromanstieg verwendet denselben linearen MNA-Kern", () => {
  const runtime = build([
    ["gnd1", "gnd"], ["v1", "dc-voltage-source"], ["r1", "resistor"], ["l1", "inductor"],
  ], [
    ["v1", "n", "gnd1", "0"], ["v1", "p", "r1", "p"], ["r1", "n", "l1", "p"], ["l1", "n", "gnd1", "0"],
  ]);
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: "l1", parameterName: "inductance", value: 1 });
  const result = simulateFreeTransient(runtime.getSnapshot(), analysis);
  const currentAtOneTau = result.result.samples[10].branches.find((branch) => branch.componentId === "l1").currentA;
  const expected = 0.005 * (1 - (1 / 1.1) ** 10);
  assert.ok(Math.abs(currentAtOneTau - expected) < 1e-12);
});

test("FREE-008: offener und geschlossener Taster verändern den Transientenpfad", () => {
  const runtime = build([
    ["gnd1", "gnd"], ["v1", "dc-voltage-source"], ["s1", "push-button"], ["r1", "resistor"],
  ], [
    ["v1", "n", "gnd1", "0"], ["v1", "p", "s1", "a"], ["s1", "b", "r1", "p"], ["r1", "n", "gnd1", "0"],
  ]);
  const open = simulateFreeTransient(runtime.getSnapshot(), { timeStepS: 0.001, stopTimeS: 0.001 });
  assert.equal(nodeVoltage(open.result.samples[1], "r1-p"), 0);
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: "s1", parameterName: "state", value: "closed" });
  const closed = simulateFreeTransient(runtime.getSnapshot(), { timeStepS: 0.001, stopTimeS: 0.001 });
  assert.ok(nodeVoltage(closed.result.samples[1], "r1-p") > 4.999);
});

test("FREE-008: LED bleibt eine explizite Providergrenze", () => {
  const runtime = build([["gnd1", "gnd"], ["d1", "led"]], [["d1", "cathode", "gnd1", "0"]]);
  const result = simulateFreeTransient(runtime.getSnapshot(), { timeStepS: 0.001, stopTimeS: 0.001 });
  assert.equal(result.errors[0].code, "ELAB_TRANSIENT_COMPONENT_UNSUPPORTED");
  assert.deepEqual(result.errors[0].componentIds, ["d1"]);
});

test("FREE-008: Zeitraster und Schrittzahl sind hart begrenzt", () => {
  const document = createFreeRcChargeDocument();
  assert.equal(simulateFreeTransient(document, { timeStepS: 1e-7, stopTimeS: 0.001 }).errors[0].code, "ELAB_TRANSIENT_TIME_STEP_INVALID");
  assert.equal(simulateFreeTransient(document, { timeStepS: 1e-6, stopTimeS: 0.01 }).errors[0].code, "ELAB_TRANSIENT_STEP_LIMIT");
  assert.equal(simulateFreeTransient(document, { timeStepS: 0.003, stopTimeS: 0.01 }).errors[0].code, "ELAB_TRANSIENT_TIME_GRID_INVALID");
  assert.equal(FREE_TRANSIENT_MODEL.limits.maxSteps, 1_000);
});

test("FREE-008: Wiederholung ist identisch und Ergebnis tief unveränderlich", () => {
  const document = createFreeRcChargeDocument();
  const first = simulateFreeTransient(document, analysis);
  const second = simulateFreeTransient(document, analysis);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first.result.samples), true);
  assert.equal(Object.isFrozen(first.result.samples[1].branches), true);
});

