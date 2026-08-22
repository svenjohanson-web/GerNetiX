import assert from "node:assert/strict";
import test from "node:test";

import { createFreeDcDividerDocument, createFreeDcDividerMeasurementSetup } from "../../free-simulation/free-circuit-presets.mjs";
import { FREE_CIRCUIT_COMMAND_TYPES, createFreeCircuitCommandRuntime } from "../../free-simulation/free-circuit-command-runtime.mjs";
import { FREE_SIMULATION_HISTORY_LIMIT, createFreeSimulationHistory } from "../../free-simulation/free-simulation-history-runtime.mjs";
import { MEASUREMENT_COMMAND_TYPES, createMeasurementRuntime } from "../../free-simulation/measurement-runtime.mjs";

function fixture() {
  const document = createFreeDcDividerDocument();
  const measurementSetup = createFreeDcDividerMeasurementSetup();
  return { document, measurementSetup, history: createFreeSimulationHistory({ document, measurementSetup }) };
}

test("FREE-006: gemeinsamer Verlauf stellt Schaltung und Messaufbau wieder her", () => {
  const { document, measurementSetup, history } = fixture();
  const circuit = createFreeCircuitCommandRuntime({ document });
  circuit.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: "v1", parameterName: "voltage", value: 10 });
  assert.equal(history.record({ change: { domain: "circuit", commandType: "SetComponentParameter", label: "Spannung ändern" }, document: circuit.getSnapshot(), measurementSetup }).recorded, true);

  const measurement = createMeasurementRuntime({ setup: measurementSetup, document: circuit.getSnapshot() });
  measurement.dispatch({ type: MEASUREMENT_COMMAND_TYPES.AddMeasurementPoint, pointId: "mp-source", label: "Quelle", nodeId: "r1-p" }, circuit.getSnapshot());
  history.record({ change: { domain: "measurement", commandType: "AddMeasurementPoint", label: "Messpunkt setzen" }, document: circuit.getSnapshot(), measurementSetup: measurement.getSnapshot() });

  const firstUndo = history.undo();
  assert.equal(firstUndo.state.document.components.find((component) => component.id === "v1").parameters.voltage.value, 10);
  assert.equal(firstUndo.state.measurementSetup.points.some((point) => point.id === "mp-source"), false);
  const secondUndo = history.undo();
  assert.equal(secondUndo.state.document.components.find((component) => component.id === "v1").parameters.voltage.value, 5);
  assert.equal(history.redo().state.document.components.find((component) => component.id === "v1").parameters.voltage.value, 10);
});

test("FREE-006: neuer Befehl nach Undo verwirft ausschließlich den Redo-Zweig", () => {
  const { document, measurementSetup, history } = fixture();
  const circuit = createFreeCircuitCommandRuntime({ document });
  for (const value of [6, 7]) {
    circuit.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: "v1", parameterName: "voltage", value });
    history.record({ change: { domain: "circuit", commandType: "SetComponentParameter", label: `${value} V` }, document: circuit.getSnapshot(), measurementSetup });
  }
  const restored = history.undo().state;
  const branched = createFreeCircuitCommandRuntime({ document: restored.document });
  branched.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: "v1", parameterName: "voltage", value: 8 });
  history.record({ change: { domain: "circuit", commandType: "SetComponentParameter", label: "8 V" }, document: branched.getSnapshot(), measurementSetup: restored.measurementSetup });
  assert.equal(history.getStatus().canRedo, false);
  assert.equal(history.redo().errors[0].code, "ELAB_HISTORY_REDO_EMPTY");
});

test("FREE-006: ungültige und identische Zustände erzeugen keinen Verlaufseintrag", () => {
  const { document, measurementSetup, history } = fixture();
  const same = history.record({ change: { domain: "circuit", commandType: "NoOp", label: "Keine Änderung" }, document, measurementSetup });
  assert.equal(same.recorded, false);
  const before = history.getSnapshot();
  const invalid = history.record({ change: { domain: "unknown", commandType: "X", label: "Falsch" }, document, measurementSetup });
  assert.equal(invalid.errors[0].code, "ELAB_HISTORY_CHANGE_INVALID");
  assert.equal(history.getSnapshot(), before);
});

test("FREE-006: Verlauf ist auf 50 Änderungen begrenzt und tief unveränderlich", () => {
  const { document, measurementSetup } = fixture();
  const history = createFreeSimulationHistory({ document, measurementSetup, limit: FREE_SIMULATION_HISTORY_LIMIT });
  let current = document;
  for (let index = 0; index < 55; index += 1) {
    const circuit = createFreeCircuitCommandRuntime({ document: current });
    circuit.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: "r1", parameterName: "resistance", value: 1000 + index + 1 });
    current = circuit.getSnapshot();
    history.record({ change: { domain: "circuit", commandType: "SetComponentParameter", label: `Schritt ${index + 1}` }, document: current, measurementSetup });
  }
  assert.equal(history.getStatus().undoDepth, FREE_SIMULATION_HISTORY_LIMIT);
  assert.equal(Object.isFrozen(history.getSnapshot()), true);
  assert.equal(Object.isFrozen(history.getStatus()), true);
});

