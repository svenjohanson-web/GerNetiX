import assert from "node:assert/strict";
import test from "node:test";

import {
  LAB_PROJECT_SLICE_CONTRACT,
  createLabProjectSlice,
  normalizeLabProject,
} from "../../domain/lab-project-contract.mjs";
import {
  createFreeDcDividerDocument,
  createFreeDcDividerMeasurementSetup,
} from "../../free-simulation/free-circuit-presets.mjs";

test("CORE-001: LabProject-Slice vereinigt Schaltung, Messaufbau und Simulation", () => {
  const result = createLabProjectSlice({
    circuitDocument: createFreeDcDividerDocument(),
    measurementSetup: createFreeDcDividerMeasurementSetup(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.project.schemaVersion, "1.0.0");
  assert.equal(result.project.circuit.document.id, "free-circuit");
  assert.equal(result.project.instruments.measurementSetup.id, "dc-divider-measurements");
  assert.equal(result.project.simulation.analysisConfiguration.analysis, "dc-operating-point");
  assert.equal(Object.isFrozen(result.project.circuit.document), true);
  assert.equal(Object.isFrozen(result.project.instruments.measurementSetup), true);
  assert.deepEqual(LAB_PROJECT_SLICE_CONTRACT.capabilities, ["circuit", "instruments", "simulation"]);
});

test("CORE-001: Messpunkte außerhalb der gemeinsamen Schaltung werden abgelehnt", () => {
  const setup = createFreeDcDividerMeasurementSetup();
  setup.points[0].nodeId = "missing-node";
  const result = createLabProjectSlice({
    circuitDocument: createFreeDcDividerDocument(),
    measurementSetup: setup,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_PROJECT_INSTRUMENTS_INVALID");
});

test("CORE-001: Analysekonfiguration ist eng und deterministisch validiert", () => {
  const base = {
    circuitDocument: createFreeDcDividerDocument(),
    measurementSetup: createFreeDcDividerMeasurementSetup(),
  };
  assert.equal(createLabProjectSlice({ ...base, analysisConfiguration: { analysis: "dc-operating-point", timeStepS: 0.1 } }).ok, false);
  assert.equal(createLabProjectSlice({ ...base, analysisConfiguration: { analysis: "transient-step-response", timeStepS: 0.001, stopTimeS: 0.01 } }).ok, true);
  assert.equal(createLabProjectSlice({ ...base, analysisConfiguration: { analysis: "raw-spice" } }).ok, false);
  const first = createLabProjectSlice(base);
  const second = normalizeLabProject(first.project);
  assert.deepEqual(second.project, first.project);
});

