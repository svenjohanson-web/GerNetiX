import assert from "node:assert/strict";
import test from "node:test";

import {
  FREE_CIRCUIT_COMMAND_TYPES,
  createFreeCircuitCommandRuntime,
} from "../../free-simulation/free-circuit-command-runtime.mjs";

function add(runtime, componentId, componentType) {
  return runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId, componentType });
}

function connect(runtime, fromComponent, fromPort, toComponent, toPort) {
  return runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: fromComponent, portId: fromPort },
    to: { componentId: toComponent, portId: toPort },
  });
}

test("FREE-002: fügt Komponenten mit privaten Anschlussknoten hinzu", () => {
  const runtime = createFreeCircuitCommandRuntime();
  assert.equal(add(runtime, "gnd1", "gnd").ok, true);
  assert.equal(add(runtime, "v1", "dc-voltage-source").ok, true);
  assert.equal(add(runtime, "r1", "resistor").ok, true);
  const snapshot = runtime.getSnapshot();
  assert.deepEqual(snapshot.components.map((component) => component.id), ["gnd1", "r1", "v1"]);
  assert.equal(snapshot.components.find((component) => component.id === "v1").parameters.voltage.value, 5);
  assert.equal(Object.isFrozen(snapshot), true);
});

test("FREE-002: verbindet Pins deterministisch zu gemeinsamen Knoten", () => {
  const runtime = createFreeCircuitCommandRuntime();
  add(runtime, "gnd1", "gnd");
  add(runtime, "v1", "dc-voltage-source");
  add(runtime, "r1", "resistor");
  assert.equal(connect(runtime, "v1", "n", "gnd1", "0").ok, true);
  assert.equal(connect(runtime, "v1", "p", "r1", "p").ok, true);
  const snapshot = runtime.getSnapshot();
  const source = snapshot.components.find((component) => component.id === "v1");
  const resistor = snapshot.components.find((component) => component.id === "r1");
  assert.equal(source.ports.find((port) => port.id === "n").nodeId, "gnd");
  assert.equal(source.ports.find((port) => port.id === "p").nodeId, resistor.ports.find((port) => port.id === "p").nodeId);
});

test("FREE-002: trennt Pin oder gesamtes Netz ohne versteckte Verdrahtung", () => {
  const runtime = createFreeCircuitCommandRuntime();
  add(runtime, "v1", "dc-voltage-source");
  add(runtime, "r1", "resistor");
  connect(runtime, "v1", "p", "r1", "p");
  assert.equal(runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.DisconnectPin, componentId: "r1", portId: "p" }).ok, true);
  const first = runtime.getSnapshot();
  assert.notEqual(
    first.components.find((component) => component.id === "v1").ports.find((port) => port.id === "p").nodeId,
    first.components.find((component) => component.id === "r1").ports.find((port) => port.id === "p").nodeId,
  );
  connect(runtime, "v1", "p", "r1", "p");
  const nodeId = runtime.getSnapshot().components.find((component) => component.id === "v1").ports.find((port) => port.id === "p").nodeId;
  assert.equal(runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.DisconnectNet, nodeId }).ok, true);
});

test("FREE-002: Parameteränderung wird validiert und Fehler verändern den Zustand nicht", () => {
  const runtime = createFreeCircuitCommandRuntime();
  add(runtime, "v1", "dc-voltage-source");
  const before = runtime.getSnapshot();
  const invalid = runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter,
    componentId: "v1",
    parameterName: "voltage",
    value: 25,
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, "ELAB_FREE_COMMAND_DOCUMENT_INVALID");
  assert.equal(runtime.getSnapshot(), before);
  assert.equal(runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter,
    componentId: "v1",
    parameterName: "voltage",
    value: 12,
  }).ok, true);
});

test("FREE-002: Entfernen räumt ungenutzte Knoten auf und Reset stellt den Anfang her", () => {
  const runtime = createFreeCircuitCommandRuntime();
  add(runtime, "r1", "resistor");
  assert.equal(runtime.getSnapshot().nodes.length, 2);
  assert.equal(runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.RemoveComponent, componentId: "r1" }).ok, true);
  assert.equal(runtime.getSnapshot().nodes.length, 0);
  add(runtime, "r2", "resistor");
  assert.equal(runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.ResetCircuit }).ok, true);
  assert.deepEqual(runtime.getSnapshot().components, []);
});

test("FREE-002: unbekannte Commands und Ports liefern stabile Fehler", () => {
  const runtime = createFreeCircuitCommandRuntime();
  assert.equal(runtime.dispatch({ type: "Magic" }).errors[0].code, "ELAB_FREE_COMMAND_UNKNOWN");
  assert.equal(runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.ResetCircuit, magic: true }).errors[0].code, "ELAB_FREE_COMMAND_UNKNOWN_FIELDS");
  assert.equal(runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: "r1", portId: "p", magic: true },
    to: { componentId: "r1", portId: "n" },
  }).errors[0].code, "ELAB_FREE_COMMAND_ENDPOINT_INVALID");
  add(runtime, "r1", "resistor");
  assert.equal(connect(runtime, "r1", "x", "r1", "p").errors[0].code, "ELAB_FREE_PORT_NOT_FOUND");
});
