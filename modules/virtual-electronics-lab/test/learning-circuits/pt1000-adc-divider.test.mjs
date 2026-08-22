import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ADC_QUANTIZER_MODEL } from "../../peripherals/adc-quantizer.mjs";
import { DC_SOLVER_MODEL_VERSION } from "../../learning-solver/dc-operating-point.mjs";
import { PT1000_MODEL } from "../../environment-models/pt1000.mjs";
import {
  PT1000_ADC_DIVIDER_MODEL,
  evaluatePt1000AdcDivider,
} from "../../learning-circuits/pt1000-adc-divider.mjs";

const filePath = fileURLToPath(
  new URL("../../learning-circuits/pt1000-adc-divider.mjs", import.meta.url)
);
const source = fs.readFileSync(path.resolve(path.dirname(filePath), "pt1000-adc-divider.mjs"), "utf8");

function roundedSense(temperatureC, supplyVoltageV, fixedResistanceOhm) {
  const resistanceOhm = pt1000Resistance(temperatureC);
  const senseVoltageV = (supplyVoltageV * resistanceOhm) / (fixedResistanceOhm + resistanceOhm);
  return { resistanceOhm, senseVoltageV };
}

function approxEquals(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

function pt1000Resistance(temperatureC) {
  const A = 3.9083e-3;
  const B = -5.775e-7;
  const C = -4.183e-12;
  if (temperatureC >= 0) {
    return 1000 * (1 + A * temperatureC + B * temperatureC * temperatureC);
  }
  return 1000 * (1 + A * temperatureC + B * temperatureC * temperatureC + C * (temperatureC - 100) * temperatureC ** 3);
}

function expectedAdcCode(senseVoltageV, supplyVoltageV, resolutionBits = 12) {
  const maxCode = 2 ** resolutionBits - 1;
  return Math.round((senseVoltageV / supplyVoltageV) * maxCode);
}

function expectedAdcQuantized(senseVoltageV, supplyVoltageV, resolutionBits = 12) {
  const code = expectedAdcCode(senseVoltageV, supplyVoltageV, resolutionBits);
  const maxCode = 2 ** resolutionBits - 1;
  return (code / maxCode) * supplyVoltageV;
}

test("PT1000-ADC divider model contract is immutable and complete", () => {
  assert.equal(Object.isFrozen(PT1000_ADC_DIVIDER_MODEL), true);
  assert.equal(PT1000_ADC_DIVIDER_MODEL.modelId, "virtual-electronics-lab-pt1000-adc-divider");
  assert.equal(PT1000_ADC_DIVIDER_MODEL.modelVersion, "1.0.0");
  assert.equal(PT1000_ADC_DIVIDER_MODEL.dependencies.dcSolverModelVersion, DC_SOLVER_MODEL_VERSION);
  assert.equal(PT1000_ADC_DIVIDER_MODEL.dependencies.adcQuantizerModelId, ADC_QUANTIZER_MODEL.modelId);
  assert.equal(PT1000_ADC_DIVIDER_MODEL.dependencies.adcQuantizerModelVersion, ADC_QUANTIZER_MODEL.modelVersion);
  assert.equal(Object.isFrozen(PT1000_ADC_DIVIDER_MODEL.dependencies), true);
  assert.equal(PT1000_ADC_DIVIDER_MODEL.dependencies.pt1000ModelId, PT1000_MODEL.modelId);

  assert.throws(
    () => {
      PT1000_ADC_DIVIDER_MODEL.dependencies.pt1000ModelId = "mutated";
    },
    { name: "TypeError" },
  );
});

test("golden points produce expected divider voltage and adc code", () => {
  const reference = [
    { temperatureC: -100, resistanceOhm: 602.5584 },
    { temperatureC: 0, resistanceOhm: 1000 },
    { temperatureC: 100, resistanceOhm: 1385.055 },
    { temperatureC: 850, resistanceOhm: 3904.81125 },
  ];

  for (const entry of reference) {
    const { temperatureC, resistanceOhm } = entry;
    const expected = roundedSense(temperatureC, 3.3, 1000);
    const expectedCode = expectedAdcCode(expected.senseVoltageV, 3.3, 12);

    const result = evaluatePt1000AdcDivider({ temperatureC, supplyVoltageV: 3.3, fixedResistanceOhm: 1000, resolutionBits: 12 });
    assert.equal(temperatureC === 0, result.result.adcCode === 2048);
    assert.equal(result.ok, true);
    assert.equal(result.result.temperatureC, temperatureC);
    assert.equal(result.result.supplyVoltageV, 3.3);
    assert.equal(result.result.fixedResistanceOhm, 1000);
    assert.equal(result.result.resolutionBits, 12);
    assert.equal(result.result.modelId, PT1000_ADC_DIVIDER_MODEL.modelId);
    assert.equal(result.result.modelVersion, PT1000_ADC_DIVIDER_MODEL.modelVersion);
    assert.equal(result.result.pt1000ModelVersion, PT1000_MODEL.modelVersion);
    assert.equal(result.result.dcSolverModelVersion, DC_SOLVER_MODEL_VERSION);
    assert.equal(result.result.adcQuantizerModelVersion, ADC_QUANTIZER_MODEL.modelVersion);
    assert.equal(result.result.adcCode, expectedCode);
    assert.equal(result.result.adcQuantizedVoltageV, expectedAdcQuantized(expected.senseVoltageV, 3.3, 12));
    approxEquals(expected.resistanceOhm, resistanceOhm, 1e-6);
    approxEquals(result.result.sensorResistanceOhm, resistanceOhm, 1e-6);
    approxEquals(result.result.senseVoltageV, expected.senseVoltageV, 1e-12);
  }
});

test("0°C golden case yields 1000 Ω, 1.65 V and ADC code 2048", () => {
  const result = evaluatePt1000AdcDivider({ temperatureC: 0, fixedResistanceOhm: 1000, resolutionBits: 12, supplyVoltageV: 3.3 });

  assert.equal(result.ok, true);
  assert.equal(result.result.sensorResistanceOhm, 1000);
  assert.equal(result.result.senseVoltageV, 1.65);
  assert.equal(result.result.adcCode, 2048);
});

test("sense voltage rises monotonically in tested temperature interval", () => {
  const points = [-100, -50, 0, 50, 100, 200, 500, 850];
  const samples = points.map((temperatureC) => {
    const result = evaluatePt1000AdcDivider({ temperatureC, fixedResistanceOhm: 1000, resolutionBits: 12, supplyVoltageV: 3.3 });
    assert.equal(result.ok, true);
    return result.result.senseVoltageV;
  });

  for (let i = 1; i < samples.length; i += 1) {
    assert.ok(samples[i] > samples[i - 1], `sense voltage must be monotonic: sample ${i} <= sample ${i - 1}`);
  }
});

test("returns core-origin errors without translation", () => {
  const outOfRange = evaluatePt1000AdcDivider({ temperatureC: -500, fixedResistanceOhm: 1000, resolutionBits: 12 });
  assert.equal(outOfRange.ok, false);
  assert.equal(outOfRange.errorSource, "pt1000");
  assert.equal(outOfRange.errors.length, 1);
  assert.equal(outOfRange.errors[0].code, "PT1000_TEMPERATURE_OUT_OF_RANGE");

  const invalidFixed = evaluatePt1000AdcDivider({ temperatureC: 0, fixedResistanceOhm: -10, resolutionBits: 12 });
  assert.equal(invalidFixed.ok, false);
  assert.equal(invalidFixed.errorSource, "dc-solver");
  assert.equal(invalidFixed.errors.length, 1);
  assert.equal(invalidFixed.errors[0].code, "INVALID_COMPONENT_PARAMETER");
  assert.equal(invalidFixed.errors[0].field, "resistanceOhm");

  const invalidResolution = evaluatePt1000AdcDivider({ temperatureC: 0, fixedResistanceOhm: 1000, resolutionBits: 0 });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.errorSource, "adc-quantizer");
  assert.equal(invalidResolution.errors.length, 1);
  assert.equal(invalidResolution.errors[0].code, "ADC_RESOLUTION_BITS_INVALID");
});

test("circuit and result include required topology/schema metadata and determinism", () => {
  const a = evaluatePt1000AdcDivider({ temperatureC: 25, fixedResistanceOhm: 1000, resolutionBits: 12, supplyVoltageV: 3.3 });
  const b = evaluatePt1000AdcDivider({ temperatureC: 25, fixedResistanceOhm: 1000, resolutionBits: 12 });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepStrictEqual(a, b);
  assert.equal(a.result.sensorResistanceOhm > 0, true);
  assert.equal(a.result.dividerCurrentA > 0, true);
  assert.equal(typeof a.result.dividerCurrentA, "number");
  assert.equal(a.warnings.length, 0);
});

test("source code has no forbidden runtime constructs", () => {
  const forbidden = [
    "eval(",
    "new Function",
    "Date(",
    "Date.",
    "Math.random",
    "fetch(",
    "XMLHttpRequest",
    "localStorage",
    "process.env",
    "net.",
    "require(",
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
  }
});
