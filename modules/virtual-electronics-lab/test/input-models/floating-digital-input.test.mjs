import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FLOATING_DIGITAL_INPUT_MODEL,
  evaluateFloatingDigitalInput,
} from "../../input-models/floating-digital-input.mjs";

const filePath = fileURLToPath(new URL("../../input-models/floating-digital-input.mjs", import.meta.url));
const source = fs.readFileSync(path.resolve(path.dirname(filePath), "floating-digital-input.mjs"), "utf8");

test("floating-input model contract is deeply immutable", () => {
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL), true);
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL.supportedSequence), true);
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL.supportedSampleRange), true);
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL.warnings), true);
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL.errors), true);
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL.warnings[0]), true);
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL.errors[0]), true);
  assert.equal(Object.isFrozen(FLOATING_DIGITAL_INPUT_MODEL.errors[1]), true);

  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.modelId, "virtual-electronics-lab-idealized-floating-digital-input");
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.modelVersion, "1.0.0");
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.supportedSequence[0], "LOW");
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.supportedSequence[1], "HIGH");
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.supportedSequence[2], "HIGH");
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.supportedSequence[3], "LOW");
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.supportedSequence.length, 4);
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.supportedSampleRange.min, 0);
  assert.equal(FLOATING_DIGITAL_INPUT_MODEL.supportedSampleRange.max, 63);
});

test("floating sequence repeats deterministically with modulo behavior", () => {
  const first = evaluateFloatingDigitalInput({ sampleIndex: 0 });
  const second = evaluateFloatingDigitalInput({ sampleIndex: 1 });
  const third = evaluateFloatingDigitalInput({ sampleIndex: 2 });
  const fourth = evaluateFloatingDigitalInput({ sampleIndex: 3 });
  const fifth = evaluateFloatingDigitalInput({ sampleIndex: 4 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, true);
  assert.equal(fourth.ok, true);
  assert.equal(fifth.ok, true);

  assert.equal(first.result.logicLevel, "LOW");
  assert.equal(first.result.normalizedValue, 0);
  assert.equal(second.result.logicLevel, "HIGH");
  assert.equal(second.result.normalizedValue, 1);
  assert.equal(third.result.logicLevel, "HIGH");
  assert.equal(third.result.normalizedValue, 1);
  assert.equal(fourth.result.logicLevel, "LOW");
  assert.equal(fourth.result.normalizedValue, 0);
  assert.equal(fifth.result.logicLevel, "LOW");
  assert.equal(fifth.result.normalizedValue, 0);
  assert.equal(fifth.result.sampleIndex, 4);
});

test("floating eval output contains sample and model metadata plus warning", () => {
  const result = evaluateFloatingDigitalInput({ sampleIndex: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.result.sampleIndex, 1);
  assert.equal(result.result.modelId, FLOATING_DIGITAL_INPUT_MODEL.modelId);
  assert.equal(result.result.modelVersion, FLOATING_DIGITAL_INPUT_MODEL.modelVersion);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "DIGITAL_INPUT_FLOATING_IDEALIZED");
  assert.equal(result.result.warnings[0].code, "DIGITAL_INPUT_FLOATING_IDEALIZED");
  assert.equal(typeof result.warnings[0].message, "string");
  assert.equal(result.warnings[0].message.includes("Lernmuster"), true);
  assert.equal(result.warnings[0].message.includes("Leiterplatte"), true);
});

test("invalid sample indices return stable errors and no partial result", () => {
  const missing = evaluateFloatingDigitalInput();
  const notNumber = evaluateFloatingDigitalInput({ sampleIndex: "1" });
  const float = evaluateFloatingDigitalInput({ sampleIndex: 1.2 });
  const tooLow = evaluateFloatingDigitalInput({ sampleIndex: -1 });
  const tooHigh = evaluateFloatingDigitalInput({ sampleIndex: 64 });
  const arrayInput = evaluateFloatingDigitalInput([]);

  assert.equal(missing.ok, false);
  assert.equal(missing.warnings.length, 0);
  assert.equal(missing.errors[0].code, "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_REQUIRED");

  assert.equal(notNumber.ok, false);
  assert.equal(notNumber.warnings.length, 0);
  assert.equal(notNumber.errors[0].code, "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_REQUIRED");

  assert.equal(float.ok, false);
  assert.equal(float.warnings.length, 0);
  assert.equal(float.errors[0].code, "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_REQUIRED");

  assert.equal(tooLow.ok, false);
  assert.equal(tooLow.warnings.length, 0);
  assert.equal(tooLow.errors[0].code, "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_NOT_SUPPORTED");

  assert.equal(tooHigh.ok, false);
  assert.equal(tooHigh.warnings.length, 0);
  assert.equal(tooHigh.errors[0].code, "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_NOT_SUPPORTED");

  assert.equal(arrayInput.ok, false);
  assert.equal(arrayInput.warnings.length, 0);
  assert.equal(arrayInput.errors[0].code, "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_REQUIRED");
});

test("evaluation is deterministic and does not mutate input", () => {
  const payload = { sampleIndex: 7 };
  const before = structuredClone(payload);

  const first = evaluateFloatingDigitalInput(payload);
  const second = evaluateFloatingDigitalInput(payload);
  const third = evaluateFloatingDigitalInput(payload);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
  assert.deepEqual(payload, before);
});

test("floating model results and contract objects are deeply frozen", () => {
  const success = evaluateFloatingDigitalInput({ sampleIndex: 12 });
  const failure = evaluateFloatingDigitalInput({ sampleIndex: 99 });

  assert.equal(success.ok, true);
  assert.equal(Object.isFrozen(success), true);
  assert.equal(Object.isFrozen(success.result), true);
  assert.equal(Object.isFrozen(success.warnings), true);
  assert.equal(Object.isFrozen(success.result.warnings), true);
  assert.equal(Object.isFrozen(success.result.sampleIndex), true);

  assert.equal(failure.ok, false);
  assert.equal(Object.isFrozen(failure), true);
  assert.equal(Object.isFrozen(failure.errors), true);
  assert.equal(Object.isFrozen(failure.errors[0]), true);
  assert.equal(Object.isFrozen(failure.warnings), true);
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
    "sessionStorage",
    "process.env",
    "require(",
    "net.",
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
  }
});
