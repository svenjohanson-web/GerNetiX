import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PT1000_MODEL, evaluatePt1000 } from "../../environment-models/pt1000.mjs";

const filePath = fileURLToPath(new URL("../../environment-models/pt1000.mjs", import.meta.url));
const source = fs.readFileSync(path.resolve(path.dirname(filePath), "pt1000.mjs"), "utf8");

const referenceValues = Object.freeze([
  { temperatureC: -200, expectedResistanceOhm: 185.2008 },
  { temperatureC: -100, expectedResistanceOhm: 602.5584 },
  { temperatureC: -50, expectedResistanceOhm: 803.06281875 },
  { temperatureC: 0, expectedResistanceOhm: 1000 },
  { temperatureC: 100, expectedResistanceOhm: 1385.055 },
  { temperatureC: 200, expectedResistanceOhm: 1758.56 },
  { temperatureC: 600, expectedResistanceOhm: 3137.08 },
  { temperatureC: 850, expectedResistanceOhm: 3904.81125 },
]);

function approxEquals(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function expectValidationError(temperatureC, expectedCode) {
  const result = evaluatePt1000(temperatureC);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, expectedCode);
  assert.equal(typeof result.errors[0].message, "string");
  assert.ok(result.errors[0].message.length > 0);
}


test("PT1000 model contract is immutable and complete", () => {
  assert.ok(Object.isFrozen(PT1000_MODEL));
  assert.equal(PT1000_MODEL.modelId, "pt1000-iec-60751");
  assert.equal(PT1000_MODEL.modelVersion, "1.0.0");
  assert.equal(PT1000_MODEL.inputUnit, "degC");
  assert.equal(PT1000_MODEL.outputUnit, "ohm");
  assert.equal(typeof PT1000_MODEL.nominalResistanceOhm, "number");
  assert.equal(PT1000_MODEL.minTemperatureC, -200);
  assert.equal(PT1000_MODEL.maxTemperatureC, 850);
  assert.equal(PT1000_MODEL.coefficients.A.toExponential(4), (3.9083e-3).toExponential(4));
  assert.equal(PT1000_MODEL.coefficients.B.toExponential(4), (-5.775e-7).toExponential(4));
  assert.equal(PT1000_MODEL.coefficients.C.toExponential(4), (-4.183e-12).toExponential(4));
});

test("reference values match IEC 60751 expected resistances", () => {
  for (const { temperatureC, expectedResistanceOhm } of referenceValues) {
    const result = evaluatePt1000(temperatureC);
    assert.equal(result.ok, true);
    assert.equal(result.result.temperatureC, temperatureC);
    assert.equal(result.result.modelId, PT1000_MODEL.modelId);
    assert.equal(result.result.modelVersion, PT1000_MODEL.modelVersion);
    approxEquals(result.result.resistanceOhm, expectedResistanceOhm, 1e-6);
    assert.deepEqual(result.result.warnings, []);
  }
});

test("explicitly exact 0 degree Celsius reference", () => {
  const result = evaluatePt1000(0);
  assert.equal(result.ok, true);
  assert.equal(result.result.resistanceOhm, 1000);
});

test("positive and negative branches immediately around 0°C and continuity", () => {
  const low = evaluatePt1000(-0.0001);
  const high = evaluatePt1000(0.0001);
  assert.equal(low.ok, true);
  assert.equal(high.ok, true);
  assert.ok(low.result.resistanceOhm < high.result.resistanceOhm);

  const atZero = evaluatePt1000(0);
  assert.ok(Math.abs(low.result.resistanceOhm - atZero.result.resistanceOhm) > 0);
  assert.ok(Math.abs(high.result.resistanceOhm - atZero.result.resistanceOhm) > 0);
  assert.ok(Math.abs(low.result.resistanceOhm - high.result.resistanceOhm) <= 1e-3);
});

test("model boundaries are accepted", () => {
  const minResult = evaluatePt1000(PT1000_MODEL.minTemperatureC);
  const maxResult = evaluatePt1000(PT1000_MODEL.maxTemperatureC);
  assert.equal(minResult.ok, true);
  assert.equal(maxResult.ok, true);
  assert.ok(minResult.result.resistanceOhm > 0);
  assert.ok(maxResult.result.resistanceOhm > minResult.result.resistanceOhm);
});

test("model rejects inputs outside allowed range", () => {
  expectValidationError(PT1000_MODEL.minTemperatureC - 1e-6, "PT1000_TEMPERATURE_OUT_OF_RANGE");
  expectValidationError(PT1000_MODEL.maxTemperatureC + 1e-6, "PT1000_TEMPERATURE_OUT_OF_RANGE");
});

test("model rejects invalid input types", () => {
  expectValidationError(NaN, "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError(Infinity, "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError(-Infinity, "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError("0", "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError("123", "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError(null, "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError(undefined, "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError({}, "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError([], "PT1000_TEMPERATURE_NUMBER_REQUIRED");
  expectValidationError(true, "PT1000_TEMPERATURE_NUMBER_REQUIRED");
});

test("resistance rises monotonically over sampling points", () => {
  const sampleTemperatures = [-200, -150, -100, -50, -10, 0, 10, 50, 100, 200, 400, 600, 850];
  let previous = evaluatePt1000(sampleTemperatures[0]);

  for (let i = 1; i < sampleTemperatures.length; i += 1) {
    const current = evaluatePt1000(sampleTemperatures[i]);
    assert.equal(previous.ok, true);
    assert.equal(current.ok, true);
    assert.ok(current.result.resistanceOhm > previous.result.resistanceOhm);
    previous = current;
  }
});

test("evaluation is deterministic and has no side effects", () => {
  const before = structuredClone(PT1000_MODEL);
  const first = evaluatePt1000(137.4);
  const second = evaluatePt1000(137.4);
  const third = evaluatePt1000(137.4);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, true);
  assert.deepStrictEqual(first.result, second.result);
  assert.deepStrictEqual(second.result, third.result);

  assert.deepStrictEqual(PT1000_MODEL, before);
});

test("source code has no forbidden runtime constructs", () => {
  const forbidden = [
    "eval(",
    "new Function",
    "Date",
    "Math.random",
    "fetch(",
    "XMLHttpRequest",
    "localStorage",
    "process.env",
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
  }
});
