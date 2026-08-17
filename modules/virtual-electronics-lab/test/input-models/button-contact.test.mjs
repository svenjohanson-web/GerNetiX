import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  BUTTON_CONTACT_MODEL,
  evaluateButtonContact,
} from "../../input-models/button-contact.mjs";

const filePath = fileURLToPath(new URL("../../input-models/button-contact.mjs", import.meta.url));
const source = fs.readFileSync(path.resolve(path.dirname(filePath), "button-contact.mjs"), "utf8");

function expectError(pressed, pullMode, expectedErrorCode, contactReference = undefined) {
  const result = evaluateButtonContact({ pressed, pullMode, contactReference });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, expectedErrorCode);
  assert.equal(typeof result.errors[0].message, "string");
  assert.ok(result.errors[0].message.length > 0);
  assert.equal(result.warnings, undefined);
}

test("button-contact model contract is immutable and complete", () => {
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.errors), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.allowedPullModes), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.allowedContactReferences), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.supportedPullModes), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.supportedContactReferences), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.warnings), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.errors[0]), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.errors[1]), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.errors[2]), true);
  assert.equal(Object.isFrozen(BUTTON_CONTACT_MODEL.warnings[0]), true);

  assert.equal(BUTTON_CONTACT_MODEL.modelId, "virtual-electronics-lab-idealized-button-contact");
  assert.equal(BUTTON_CONTACT_MODEL.modelVersion, "1.1.0");
  assert.equal(BUTTON_CONTACT_MODEL.allowedPullModes[0], "pull-up");
  assert.equal(BUTTON_CONTACT_MODEL.allowedPullModes[1], "pull-down");
  assert.equal(BUTTON_CONTACT_MODEL.allowedContactReferences[0], "gnd");
  assert.equal(BUTTON_CONTACT_MODEL.allowedContactReferences[1], "vcc");

  assert.throws(
    () => {
      BUTTON_CONTACT_MODEL.supportedPullModes.pullUp = "changed";
    },
    {
      name: "TypeError",
    },
  );

  assert.equal(BUTTON_CONTACT_MODEL.supportedPullModes.pullUp, "pull-up");
  assert.equal(BUTTON_CONTACT_MODEL.errors[0].code, "BUTTON_PRESSED_BOOLEAN_REQUIRED");
  assert.equal(BUTTON_CONTACT_MODEL.errors[2].code, "BUTTON_CONTACT_REFERENCE_NOT_SUPPORTED");
  assert.equal(BUTTON_CONTACT_MODEL.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
});

test("four-state combinations map to ideal pull-up/pull-down logic", () => {
  const openPullUp = evaluateButtonContact({ pressed: false, pullMode: "pull-up" });
  const pressedPullUp = evaluateButtonContact({ pressed: true, pullMode: "pull-up" });
  const openPullDown = evaluateButtonContact({ pressed: false, pullMode: "pull-down" });
  const pressedPullDown = evaluateButtonContact({ pressed: true, pullMode: "pull-down" });

  assert.equal(openPullUp.ok, true);
  assert.equal(openPullUp.result.logicLevel, "HIGH");
  assert.equal(openPullUp.result.normalizedValue, 1);
  assert.deepEqual(openPullUp.result.warnings, []);
  assert.equal(openPullUp.warnings.length, 0);
  assert.equal(openPullUp.result.modelId, BUTTON_CONTACT_MODEL.modelId);

  assert.equal(pressedPullUp.ok, true);
  assert.equal(pressedPullUp.result.logicLevel, "LOW");
  assert.equal(pressedPullUp.result.normalizedValue, 0);
  assert.deepEqual(pressedPullUp.result.warnings, []);
  assert.equal(pressedPullUp.warnings.length, 0);
  assert.equal(pressedPullUp.result.modelVersion, BUTTON_CONTACT_MODEL.modelVersion);

  assert.equal(openPullDown.ok, true);
  assert.equal(openPullDown.result.logicLevel, "LOW");
  assert.equal(openPullDown.result.normalizedValue, 0);
  assert.deepEqual(openPullDown.result.warnings, []);
  assert.equal(openPullDown.warnings.length, 0);

  assert.equal(pressedPullDown.ok, true);
  assert.equal(pressedPullDown.result.logicLevel, "HIGH");
  assert.equal(pressedPullDown.result.normalizedValue, 1);
  assert.deepEqual(pressedPullDown.result.warnings, []);
  assert.equal(pressedPullDown.warnings.length, 0);
});

test("pressing button without contact reference keeps backwards-compatible behavior", () => {
  const openPullUp = evaluateButtonContact({ pressed: false, pullMode: "pull-up" });
  const pressedPullUp = evaluateButtonContact({ pressed: true, pullMode: "pull-up" });
  const openPullDown = evaluateButtonContact({ pressed: false, pullMode: "pull-down" });
  const pressedPullDown = evaluateButtonContact({ pressed: true, pullMode: "pull-down" });

  assert.equal(openPullUp.result.contactReference, "gnd");
  assert.equal(pressedPullUp.result.contactReference, "gnd");
  assert.equal(openPullDown.result.contactReference, "vcc");
  assert.equal(pressedPullDown.result.contactReference, "vcc");
});

test("explicit contact references evaluate independently from pull mode", () => {
  const pressPullUpToVcc = evaluateButtonContact({
    pressed: true,
    pullMode: "pull-up",
    contactReference: "vcc",
  });
  const openPullUpToVcc = evaluateButtonContact({
    pressed: false,
    pullMode: "pull-up",
    contactReference: "vcc",
  });
  const pressPullDownToGnd = evaluateButtonContact({
    pressed: true,
    pullMode: "pull-down",
    contactReference: "gnd",
  });
  const openPullDownToGnd = evaluateButtonContact({
    pressed: false,
    pullMode: "pull-down",
    contactReference: "gnd",
  });

  assert.equal(pressPullUpToVcc.result.logicLevel, "HIGH");
  assert.equal(openPullUpToVcc.result.logicLevel, "HIGH");
  assert.equal(pressPullDownToGnd.result.logicLevel, "LOW");
  assert.equal(openPullDownToGnd.result.logicLevel, "LOW");
});

test("miswired contacts report stable no-level-change warning only when pressed", () => {
  const pressPullUpToVcc = evaluateButtonContact({
    pressed: true,
    pullMode: "pull-up",
    contactReference: "vcc",
  });
  const openPullUpToVcc = evaluateButtonContact({
    pressed: false,
    pullMode: "pull-up",
    contactReference: "vcc",
  });
  const pressPullDownToGnd = evaluateButtonContact({
    pressed: true,
    pullMode: "pull-down",
    contactReference: "gnd",
  });
  const openPullDownToGnd = evaluateButtonContact({
    pressed: false,
    pullMode: "pull-down",
    contactReference: "gnd",
  });

  assert.equal(pressPullUpToVcc.result.warnings.length, 1);
  assert.equal(pressPullUpToVcc.result.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
  assert.equal(pressPullUpToVcc.warnings.length, 1);
  assert.equal(pressPullUpToVcc.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
  assert.equal(pressPullUpToVcc.warnings[0].message, "Pressed button contact does not change logic level.");

  assert.equal(openPullUpToVcc.result.warnings.length, 0);
  assert.equal(openPullUpToVcc.warnings.length, 0);

  assert.equal(pressPullDownToGnd.result.warnings.length, 1);
  assert.equal(pressPullDownToGnd.result.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
  assert.equal(pressPullDownToGnd.warnings.length, 1);
  assert.equal(pressPullDownToGnd.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
  assert.equal(pressPullDownToGnd.warnings[0].message, "Pressed button contact does not change logic level.");
  assert.equal(openPullDownToGnd.result.warnings.length, 0);
  assert.equal(openPullDownToGnd.warnings.length, 0);
});

test("invalid inputs emit stable errors", () => {
  expectError(1, "pull-up", "BUTTON_PRESSED_BOOLEAN_REQUIRED");
  expectError("true", "pull-down", "BUTTON_PRESSED_BOOLEAN_REQUIRED");
  expectError(null, "pull-up", "BUTTON_PRESSED_BOOLEAN_REQUIRED");
  expectError(false, "none", "BUTTON_PULL_MODE_NOT_SUPPORTED");
  expectError(true, "floating", "BUTTON_PULL_MODE_NOT_SUPPORTED");
  expectError(false, "pull-up", "BUTTON_CONTACT_REFERENCE_NOT_SUPPORTED", "gnd2");
  expectError(true, "pull-down", "BUTTON_CONTACT_REFERENCE_NOT_SUPPORTED", "3.3v");
});

test("evaluation is deterministic and has no side effects", () => {
  const first = evaluateButtonContact({ pressed: true, pullMode: "pull-down" });
  const second = evaluateButtonContact({ pressed: true, pullMode: "pull-down" });
  const third = evaluateButtonContact({ pressed: true, pullMode: "pull-down" });

  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(second, third);

  assert.deepEqual(first.result, second.result);
  assert.deepEqual(first.result, third.result);

  const firstWithContactReference = evaluateButtonContact({
    pressed: false,
    pullMode: "pull-up",
    contactReference: "vcc",
  });
  const secondWithContactReference = evaluateButtonContact({
    pressed: false,
    pullMode: "pull-up",
    contactReference: "vcc",
  });

  assert.deepStrictEqual(firstWithContactReference, secondWithContactReference);
  assert.deepEqual(firstWithContactReference.result, secondWithContactReference.result);
});

test("evaluateButtonContact returns fully frozen success response including nested fields", () => {
  const success = evaluateButtonContact({ pressed: false, pullMode: "pull-up" });

  assert.equal(Object.isFrozen(success), true);
  assert.equal(Object.isFrozen(success.result), true);
  assert.equal(Object.isFrozen(success.warnings), true);
  assert.equal(Object.isFrozen(success.result.warnings), true);

  assert.throws(
    () => {
      // @ts-expect-error - testing immutability contract
      success.ok = false;
    },
    {
      name: "TypeError",
    },
  );

  assert.throws(
    () => {
      // @ts-expect-error - testing immutability contract
      success.result.contactReference = "vcc";
    },
    {
      name: "TypeError",
    },
  );
});

test("evaluateButtonContact miswired warning response includes fully frozen warning data", () => {
  const miswired = evaluateButtonContact({ pressed: true, pullMode: "pull-up", contactReference: "vcc" });

  assert.equal(Object.isFrozen(miswired), true);
  assert.equal(Object.isFrozen(miswired.result), true);
  assert.equal(Object.isFrozen(miswired.result.warnings), true);
  assert.equal(Object.isFrozen(miswired.warnings), true);
  assert.equal(Object.isFrozen(miswired.result.warnings[0]), true);

  assert.throws(
    () => {
      // @ts-expect-error - testing immutability contract
      miswired.result.warnings.push({ code: "X" });
    },
    {
      name: "TypeError",
    },
  );

  assert.equal(miswired.result.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
});

test("evaluateButtonContact returns fully frozen error response including errors array and entry", () => {
  const failed = evaluateButtonContact({ pressed: "not-boolean", pullMode: "pull-up" });

  assert.equal(Object.isFrozen(failed), true);
  assert.equal(Object.isFrozen(failed.errors), true);
  assert.equal(Object.isFrozen(failed.errors[0]), true);
  assert.equal(failed.warnings, undefined);

  assert.equal(failed.errors[0].code, "BUTTON_PRESSED_BOOLEAN_REQUIRED");

  assert.throws(
    () => {
      // @ts-expect-error - testing immutability contract
      failed.errors[0].code = "CHANGED";
    },
    {
      name: "TypeError",
    },
  );

  assert.throws(
    () => {
      // @ts-expect-error - testing immutability contract
      failed.errors = [];
    },
    {
      name: "TypeError",
    },
  );

  const alsoFailed = evaluateButtonContact({
    pressed: false,
    pullMode: "pull-up",
    contactReference: "invalid",
  });

  assert.equal(Object.isFrozen(alsoFailed), true);
  assert.equal(Object.isFrozen(alsoFailed.errors), true);
  assert.equal(Object.isFrozen(alsoFailed.errors[0]), true);
  assert.equal(alsoFailed.errors[0].code, "BUTTON_CONTACT_REFERENCE_NOT_SUPPORTED");
});

test("input objects are not mutated", () => {
  const modelInput = { pressed: true, pullMode: "pull-up", contactReference: "gnd" };
  const unchangedInput = structuredClone(modelInput);
  evaluateButtonContact(modelInput);
  assert.deepEqual(modelInput, unchangedInput);
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
