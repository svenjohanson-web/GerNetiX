import assert from "node:assert/strict";
import test from "node:test";

import {
  LED_CURRENT_SENSE_MODEL,
  evaluateLedCurrentSense,
} from "./led-current-sense.mjs";
import { ELAB_DS_002_PWM_START_CODE, runThroughputSimulation } from "./gpio-led-throughput-runtime.js";

function pwmTrace() {
  return runThroughputSimulation({ sourceFile: ELAB_DS_002_PWM_START_CODE }).measurement.trace;
}

test("LED-001: Modellvertrag ist fest und verweist auf den gemeinsamen ADC", () => {
  assert.equal(Object.isFrozen(LED_CURRENT_SENSE_MODEL), true);
  assert.equal(LED_CURRENT_SENSE_MODEL.shuntResistanceOhm, 1);
  assert.equal(LED_CURRENT_SENSE_MODEL.adcReferenceVoltageV, 3.3);
  assert.equal(LED_CURRENT_SENSE_MODEL.adcResolutionBits, 12);
  assert.equal(LED_CURRENT_SENSE_MODEL.dependencies.sourceTraceQuantity, "ledCurrentA");
});

test("LED-001: PWM-Trace wird deterministisch über Shunt und ADC abgebildet", () => {
  const result = evaluateLedCurrentSense({ trace: pwmTrace() });
  assert.equal(result.ok, true);
  assert.equal(result.result.samples.length, 9);
  assert.equal(result.result.samples[0].ledCurrentA, 0.003939394);
  assert.equal(result.result.samples[0].shuntVoltageV, 0.003939394);
  assert.equal(result.result.samples[0].adcCode, 5);
  assert.equal(result.result.samples[1].ledCurrentA, 0);
  assert.equal(result.result.samples[1].adcCode, 0);
  assert.deepEqual(result.warnings, []);
});

test("LED-001: gleiche Eingabe liefert bytegleiches Ergebnis ohne Zustand", () => {
  const first = evaluateLedCurrentSense({ trace: pwmTrace(), shuntResistanceOhm: 10 });
  const second = evaluateLedCurrentSense({ trace: pwmTrace(), shuntResistanceOhm: 10 });
  assert.deepEqual(first, second);
  assert.equal(first.result.samples[0].shuntVoltageV, 0.03939394);
});

test("LED-001: ADC-Übersteuerung bleibt als Quantisiererwarnung sichtbar", () => {
  const result = evaluateLedCurrentSense({
    trace: [{ time: 0, ledCurrentA: 1 }],
    shuntResistanceOhm: 10,
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.samples[0].adcCode, 4095);
  assert.equal(result.warnings[0].code, "ADC_INPUT_ABOVE_RANGE");
  assert.equal(result.warnings[0].sampleIndex, 0);
});

test("LED-001: feste Eingabegrenzen liefern stabile Fehler", () => {
  assert.equal(evaluateLedCurrentSense({ trace: [] }).errors[0].code, "LED_CURRENT_SENSE_TRACE_INVALID");
  assert.equal(evaluateLedCurrentSense({ trace: pwmTrace(), shuntResistanceOhm: 0 }).errors[0].code, "LED_CURRENT_SENSE_SHUNT_OUT_OF_RANGE");
  assert.equal(evaluateLedCurrentSense({ trace: [{ time: 0, ledCurrentA: -1 }] }).errors[0].code, "LED_CURRENT_SENSE_CURRENT_OUT_OF_RANGE");
  assert.equal(evaluateLedCurrentSense({ trace: [{ time: 0, ledCurrentA: 1.1 }] }).errors[0].code, "LED_CURRENT_SENSE_CURRENT_OUT_OF_RANGE");
});

test("LED-001: Eingabetrace bleibt unverändert", () => {
  const trace = [{ time: 0, ledCurrentA: 0.002 }];
  const before = structuredClone(trace);
  evaluateLedCurrentSense({ trace });
  assert.deepEqual(trace, before);
});
