import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ADC_QUANTIZER_MODEL,
  quantizeAdcSample,
} from "../../peripherals/adc-quantizer.mjs";

const filePath = fileURLToPath(new URL("../../peripherals/adc-quantizer.mjs", import.meta.url));
const source = fs.readFileSync(path.resolve(path.dirname(filePath), "adc-quantizer.mjs"), "utf8");

function expectError(inputVoltageV, referenceVoltageV, resolutionBits, expectedErrorCode) {
  const result = quantizeAdcSample({ inputVoltageV, referenceVoltageV, resolutionBits });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, expectedErrorCode);
  assert.equal(typeof result.errors[0].message, "string");
  assert.ok(result.errors[0].message.length > 0);
  assert.equal(result.warnings, undefined);
}

test("ADC quantizer model contract is immutable and complete", () => {
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL), true);
  assert.equal(ADC_QUANTIZER_MODEL.modelId, "virtual-electronics-lab-idealized-adc-quantizer");
  assert.equal(ADC_QUANTIZER_MODEL.modelVersion, "1.0.0");
  assert.equal(ADC_QUANTIZER_MODEL.minResolutionBits, 1);
  assert.equal(ADC_QUANTIZER_MODEL.maxResolutionBits, 24);
  assert.equal(ADC_QUANTIZER_MODEL.maxReferenceVoltageV, 100);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL.warnings), true);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL.errors), true);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL.warnings[0]), true);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL.warnings[1]), true);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL.errors[0]), true);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL.errors[1]), true);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL.errors[2]), true);
  assert.equal(ADC_QUANTIZER_MODEL.warnings[0].code, "ADC_INPUT_BELOW_RANGE");
  assert.equal(ADC_QUANTIZER_MODEL.warnings[1].code, "ADC_INPUT_ABOVE_RANGE");
  assert.equal(ADC_QUANTIZER_MODEL.errors.length, 3);

  assert.throws(
    () => {
      ADC_QUANTIZER_MODEL.warnings[0].code = "MUTATED";
    },
    {
      name: "TypeError",
    },
  );

  assert.equal(ADC_QUANTIZER_MODEL.warnings[0].code, "ADC_INPUT_BELOW_RANGE");
  assert.equal(ADC_QUANTIZER_MODEL.errors[0].code, "ADC_INPUT_VOLTAGE_NUMBER_REQUIRED");
});

test("contract conversion is exact for nominal acceptance values", () => {
  const referenceVoltageV = 3.3;
  const resolutionBits = 12;
  const expectedMaxCode = 4095;

  const zero = quantizeAdcSample({
    inputVoltageV: 0,
    referenceVoltageV,
    resolutionBits,
  });
  assert.equal(zero.ok, true);
  assert.equal(zero.result.code, 0);
  assert.equal(zero.result.quantizedVoltageV, 0);
  assert.equal(zero.warnings.length, 0);

  const mid = quantizeAdcSample({
    inputVoltageV: 1.65,
    referenceVoltageV,
    resolutionBits,
  });
  assert.equal(mid.ok, true);
  assert.equal(mid.result.code, 2048);
  assert.equal(mid.result.quantizedVoltageV, (2048 / 4095) * referenceVoltageV);
  assert.equal(mid.warnings.length, 0);

  const top = quantizeAdcSample({
    inputVoltageV: 3.3,
    referenceVoltageV,
    resolutionBits,
  });
  assert.equal(top.ok, true);
  assert.equal(top.result.code, expectedMaxCode);
  assert.equal(top.result.quantizedVoltageV, 3.3);
  assert.equal(top.warnings.length, 0);
});

test("values outside input range are clamped and stable warning-coded", () => {
  const referenceVoltageV = 3.3;
  const resolutionBits = 10;

  const below = quantizeAdcSample({
    inputVoltageV: -0.5,
    referenceVoltageV,
    resolutionBits,
  });
  assert.equal(below.ok, true);
  assert.equal(below.warnings.length, 1);
  assert.equal(below.warnings[0].code, "ADC_INPUT_BELOW_RANGE");
  assert.equal(below.result.code, 0);
  assert.equal(below.result.quantizedVoltageV, 0);

  const above = quantizeAdcSample({
    inputVoltageV: 4.2,
    referenceVoltageV,
    resolutionBits,
  });
  assert.equal(above.ok, true);
  assert.equal(above.warnings.length, 1);
  assert.equal(above.warnings[0].code, "ADC_INPUT_ABOVE_RANGE");
  assert.equal(above.result.code, (2 ** resolutionBits) - 1);
  assert.equal(above.result.quantizedVoltageV, referenceVoltageV);
});

test("invalid inputs emit stable errors and no partial result", () => {
  expectError(NaN, 3.3, 12, "ADC_INPUT_VOLTAGE_NUMBER_REQUIRED");
  expectError("1.0", 3.3, 12, "ADC_INPUT_VOLTAGE_NUMBER_REQUIRED");
  expectError(1.0, 0, 12, "ADC_REFERENCE_VOLTAGE_INVALID");
  expectError(1.0, 101, 12, "ADC_REFERENCE_VOLTAGE_INVALID");
  expectError(1.0, -3.3, 12, "ADC_REFERENCE_VOLTAGE_INVALID");
  expectError(1.0, 3.3, 0, "ADC_RESOLUTION_BITS_INVALID");
  expectError(1.0, 3.3, 25, "ADC_RESOLUTION_BITS_INVALID");
  expectError(1.0, 3.3, 12.1, "ADC_RESOLUTION_BITS_INVALID");
  expectError(1.0, 3.3, "12", "ADC_RESOLUTION_BITS_INVALID");
});

test("quantization is deterministic and repeatable", () => {
  const first = quantizeAdcSample({
    inputVoltageV: 1.2345,
    referenceVoltageV: 5,
    resolutionBits: 8,
  });
  const second = quantizeAdcSample({
    inputVoltageV: 1.2345,
    referenceVoltageV: 5,
    resolutionBits: 8,
  });
  const third = quantizeAdcSample({
    inputVoltageV: 1.2345,
    referenceVoltageV: 5,
    resolutionBits: 8,
  });

  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(second, third);
  assert.deepStrictEqual(first.result, second.result);
  assert.equal(Object.isFrozen(ADC_QUANTIZER_MODEL), true);
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
