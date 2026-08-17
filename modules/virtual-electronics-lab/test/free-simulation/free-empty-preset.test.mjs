import assert from "node:assert/strict";
import test from "node:test";

import { createLabProjectSlice } from "../../domain/lab-project-contract.mjs";
import {
  FREE_EMPTY_PRESET_ID,
  createFreeEmptyDocument,
  createFreeEmptyMeasurementSetup,
} from "../../free-simulation/free-circuit-presets.mjs";
import {
  FREE_CIRCUIT_COMMAND_TYPES,
  createFreeCircuitCommandRuntime,
} from "../../free-simulation/free-circuit-command-runtime.mjs";
import { getLabTemplate } from "../../lab-template-catalog.mjs";
import { createFreeCircuitSimulationLab } from "../../labs/free-circuit-simulation.js";

test("FREE-009: Preset startet als gültiger leerer LabProject-Slice", () => {
  const document = createFreeEmptyDocument();
  const setup = createFreeEmptyMeasurementSetup();
  assert.equal(FREE_EMPTY_PRESET_ID, "empty");
  assert.deepEqual(document.components, []);
  assert.deepEqual(document.nodes, []);
  assert.deepEqual(setup.points, []);
  assert.deepEqual(setup.voltageProbes, []);
  const project = createLabProjectSlice({ circuitDocument: document, measurementSetup: setup });
  assert.equal(project.ok, true);
  assert.equal(Object.isFrozen(project.project), true);
});

test("FREE-009: Bauteil hinzufügen und Reset verwenden denselben Command-Pfad", () => {
  const initial = createFreeEmptyDocument();
  const runtime = createFreeCircuitCommandRuntime({ document: initial });
  assert.equal(runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent,
    componentId: "r1",
    componentType: "resistor",
  }).ok, true);
  assert.equal(runtime.getSnapshot().components.length, 1);
  assert.equal(runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.ResetCircuit }).ok, true);
  assert.deepEqual(runtime.getSnapshot().components, []);
  assert.deepEqual(runtime.getSnapshot().nodes, []);
});

test("FREE-009: Katalogtemplate lädt den leeren Zustand in das bestehende freie Labor", () => {
  const template = getLabTemplate("elab-tpl-free-empty");
  const lab = createFreeCircuitSimulationLab();
  const loaded = lab.loadTemplate(template);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.document.components, []);
  assert.deepEqual(loaded.document.nodes, []);
});
