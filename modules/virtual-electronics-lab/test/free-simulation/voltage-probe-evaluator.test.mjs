import assert from "node:assert/strict";
import test from "node:test";

import { createFreeDcDividerDocument, createFreeDcDividerMeasurementSetup, createFreeRcChargeDocument, createFreeRcChargeMeasurementSetup } from "../../free-simulation/free-circuit-presets.mjs";
import { simulateFreeDcOperatingPoint } from "../../free-simulation/dc-learning-solver-adapter.mjs";
import { simulateFreeTransient } from "../../free-simulation/transient-learning-solver.mjs";
import { evaluateTransientVoltageProbes, evaluateVoltageProbes } from "../../free-simulation/voltage-probe-evaluator.mjs";

test("FREE-005: virtueller Tastkopf misst die Differenz zwischen zwei Messpunkten", () => {
  const document = createFreeDcDividerDocument();
  const result = evaluateVoltageProbes(createFreeDcDividerMeasurementSetup(), document, simulateFreeDcOperatingPoint(document));
  assert.equal(result.ok, true);
  assert.equal(result.readings[0].voltageV, 2.5);
  assert.equal(Object.isFrozen(result.readings), true);
});

test("FREE-005: vertauschte Spitzen liefern ein negatives Vorzeichen", () => {
  const document = createFreeDcDividerDocument();
  const setup = createFreeDcDividerMeasurementSetup();
  setup.voltageProbes[0].positivePointId = "mp-gnd";
  setup.voltageProbes[0].referencePointId = "mp-mid";
  const result = evaluateVoltageProbes(setup, document, simulateFreeDcOperatingPoint(document));
  assert.equal(result.readings[0].voltageV, -2.5);
});

test("FREE-005: Solverfehler werden nicht als Messwert ausgegeben", () => {
  const document = createFreeDcDividerDocument();
  const failed = Object.freeze({ ok: false, errors: Object.freeze([{ code: "FAILED", message: "Keine Lösung" }]) });
  const result = evaluateVoltageProbes(createFreeDcDividerMeasurementSetup(), document, failed);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "FAILED");
});

test("FREE-008: Tastkopf wertet eine Transientenspur differentiell aus", () => {
  const document = createFreeRcChargeDocument();
  const transient = simulateFreeTransient(document, { timeStepS: 0.0001, stopTimeS: 0.001 });
  const result = evaluateTransientVoltageProbes(createFreeRcChargeMeasurementSetup(), document, transient);
  assert.equal(result.ok, true);
  assert.equal(result.traces[0].samples.length, 11);
  assert.equal(result.traces[0].samples[0].voltageV, 0);
  assert.ok(result.traces[0].samples.at(-1).voltageV > 3);
  assert.equal(Object.isFrozen(result.traces[0].samples), true);
});
