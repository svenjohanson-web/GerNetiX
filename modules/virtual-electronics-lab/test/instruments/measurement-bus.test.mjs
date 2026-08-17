import assert from "node:assert/strict";
import test from "node:test";

import { createLabProjectSlice } from "../../domain/lab-project-contract.mjs";
import {
  createFreeDcDividerDocument,
  createFreeDcDividerMeasurementSetup,
  createFreeRcChargeDocument,
  createFreeRcChargeMeasurementSetup,
} from "../../free-simulation/free-circuit-presets.mjs";
import { simulateFreeDcOperatingPoint } from "../../free-simulation/dc-learning-solver-adapter.mjs";
import { simulateFreeTransient } from "../../free-simulation/transient-learning-solver.mjs";
import { publishNodeVoltageTrace, readVoltageProbes } from "../../instruments/measurement-bus.mjs";

test("CORE-001: DC und Tastkopf lesen denselben typisierten MeasurementTrace", () => {
  const document = createFreeDcDividerDocument();
  const project = createLabProjectSlice({
    circuitDocument: document,
    measurementSetup: createFreeDcDividerMeasurementSetup(),
  }).project;
  const published = publishNodeVoltageTrace({ labProject: project, solverResponse: simulateFreeDcOperatingPoint(document) });
  assert.equal(published.ok, true);
  assert.equal(published.trace.quantity, "node-voltage");
  assert.equal(published.trace.unit, "V");
  assert.equal(published.trace.samples.length, 1);
  const measured = readVoltageProbes({ labProject: project, trace: published.trace });
  assert.equal(measured.ok, true);
  assert.equal(measured.probes[0].latestValue, 2.5);
  assert.equal(Object.isFrozen(measured.probes[0].samples), true);
});

test("CORE-001: vertauschte Spitzen kehren nur im Messpfad das Vorzeichen um", () => {
  const document = createFreeDcDividerDocument();
  const setup = createFreeDcDividerMeasurementSetup();
  setup.voltageProbes[0].positivePointId = "mp-gnd";
  setup.voltageProbes[0].referencePointId = "mp-mid";
  const project = createLabProjectSlice({ circuitDocument: document, measurementSetup: setup }).project;
  const trace = publishNodeVoltageTrace({ labProject: project, solverResponse: simulateFreeDcOperatingPoint(document) }).trace;
  assert.equal(readVoltageProbes({ labProject: project, trace }).probes[0].latestValue, -2.5);
});

test("CORE-001: Transiente verwendet dasselbe Traceformat mit virtueller Zeit", () => {
  const document = createFreeRcChargeDocument();
  const analysisConfiguration = { analysis: "transient-step-response", timeStepS: 0.0001, stopTimeS: 0.001 };
  const project = createLabProjectSlice({
    circuitDocument: document,
    measurementSetup: createFreeRcChargeMeasurementSetup(),
    analysisConfiguration,
  }).project;
  const response = simulateFreeTransient(document, {
    timeStepS: analysisConfiguration.timeStepS,
    stopTimeS: analysisConfiguration.stopTimeS,
  });
  const published = publishNodeVoltageTrace({ labProject: project, solverResponse: response });
  assert.equal(published.ok, true);
  assert.equal(published.trace.samples.length, 11);
  assert.equal(published.trace.samples[0].timeS, 0);
  const measured = readVoltageProbes({ labProject: project, trace: published.trace });
  assert.ok(measured.probes[0].latestValue > 3);
});

test("CORE-001: fremde oder unvollständige Solverergebnisse werden nicht veröffentlicht", () => {
  const document = createFreeDcDividerDocument();
  const project = createLabProjectSlice({
    circuitDocument: document,
    measurementSetup: createFreeDcDividerMeasurementSetup(),
  }).project;
  const response = simulateFreeDcOperatingPoint(document);
  const foreign = { ...response, result: { ...response.result, documentId: "foreign-circuit" } };
  assert.equal(publishNodeVoltageTrace({ labProject: project, solverResponse: foreign }).errors[0].code, "ELAB_MEASUREMENT_SOLVER_RESULT_MISMATCH");
  const incomplete = { ...response, result: { ...response.result, nodeVoltages: response.result.nodeVoltages.slice(1) } };
  assert.equal(publishNodeVoltageTrace({ labProject: project, solverResponse: incomplete }).errors[0].code, "ELAB_MEASUREMENT_TRACE_INVALID");
});
