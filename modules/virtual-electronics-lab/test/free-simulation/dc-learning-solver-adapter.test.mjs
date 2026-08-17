import assert from "node:assert/strict";
import test from "node:test";

import {
  FREE_CIRCUIT_COMMAND_TYPES,
  createFreeCircuitCommandRuntime,
} from "../../free-simulation/free-circuit-command-runtime.mjs";
import {
  FREE_DC_ADAPTER_MODEL,
  simulateFreeDcOperatingPoint,
} from "../../free-simulation/dc-learning-solver-adapter.mjs";

function dividerDocument() {
  const runtime = createFreeCircuitCommandRuntime();
  for (const [componentId, componentType] of [
    ["gnd1", "gnd"],
    ["v1", "dc-voltage-source"],
    ["r1", "resistor"],
    ["r2", "resistor"],
  ]) {
    runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId, componentType });
  }
  const connect = (fromComponent, fromPort, toComponent, toPort) => runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: fromComponent, portId: fromPort },
    to: { componentId: toComponent, portId: toPort },
  });
  connect("v1", "n", "gnd1", "0");
  connect("v1", "p", "r1", "p");
  connect("r1", "n", "r2", "p");
  connect("r2", "n", "gnd1", "0");
  return runtime.getSnapshot();
}

test("FREE-003: Adapter benennt nur den tatsächlich unterstützten DC-Umfang", () => {
  assert.deepEqual(FREE_DC_ADAPTER_MODEL.supportedComponentTypes, ["gnd", "dc-voltage-source", "resistor"]);
  assert.equal(Object.isFrozen(FREE_DC_ADAPTER_MODEL), true);
});

test("FREE-003: Spannungsteiler nutzt den vorhandenen DC-Solver", () => {
  const result = simulateFreeDcOperatingPoint(dividerDocument());
  assert.equal(result.ok, true);
  const middle = result.result.nodeVoltages.find((node) => node.nodeId === "r1-n");
  assert.equal(middle.voltageV, 2.5);
  assert.equal(result.result.diagnostics.solver, "deterministic-linear-mna");
  assert.equal(result.result.modelVersions.solver, "1.0.0");
  assert.equal(Object.isFrozen(result.result), true);
});

test("FREE-003: fehlende Masse bleibt eine verständliche Adapterdiagnose", () => {
  const runtime = createFreeCircuitCommandRuntime();
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "r1", componentType: "resistor" });
  const result = simulateFreeDcOperatingPoint(runtime.getSnapshot());
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_FREE_DC_GROUND_REQUIRED");
});

test("FREE-003: C, L, LED und Taster werden nicht stillschweigend idealisiert", () => {
  for (const componentType of ["capacitor", "inductor", "led", "push-button"]) {
    const runtime = createFreeCircuitCommandRuntime();
    runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "gnd1", componentType: "gnd" });
    runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "x1", componentType });
    const result = simulateFreeDcOperatingPoint(runtime.getSnapshot());
    assert.equal(result.errors[0].code, "ELAB_FREE_DC_COMPONENT_UNSUPPORTED", componentType);
  }
});

test("FREE-003: Solverdiagnosen werden unverfälscht mit Herkunft weitergereicht", () => {
  const runtime = createFreeCircuitCommandRuntime();
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "gnd1", componentType: "gnd" });
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "r1", componentType: "resistor" });
  const result = simulateFreeDcOperatingPoint(runtime.getSnapshot());
  assert.equal(result.ok, false);
  assert.equal(result.errorSource, "dc-learning-solver");
  assert.equal(result.errors[0].code, "GROUND_NODE_NOT_CONNECTED");
});

test("FREE-003: gleiche Schaltung liefert dasselbe Ergebnis", () => {
  const document = dividerDocument();
  assert.deepEqual(simulateFreeDcOperatingPoint(document), simulateFreeDcOperatingPoint(document));
});
