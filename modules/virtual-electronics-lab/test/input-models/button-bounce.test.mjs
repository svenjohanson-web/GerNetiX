import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { BUTTON_BOUNCE_MODEL, evaluateButtonBounce } from "../../input-models/button-bounce.mjs";

const filePath = fileURLToPath(new URL("../../input-models/button-bounce.mjs", import.meta.url));
const source = fs.readFileSync(filePath, "utf8");

function pressAt(profileTarget, elapsedUs) {
  if (elapsedUs < 150) return !profileTarget;
  if (elapsedUs < 350) return profileTarget;
  if (elapsedUs < 700) return !profileTarget;
  if (elapsedUs < 1200) return profileTarget;
  if (elapsedUs < 1800) return !profileTarget;
  return profileTarget;
}

test("button-bounce model contract is immutable and complete", () => {
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL), true);
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL.errors), true);
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL.warnings), true);
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL.errors[0]), true);
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL.errors[1]), true);
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL.errors[2]), true);
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL.supportedProfiles), true);
  assert.equal(Object.isFrozen(BUTTON_BOUNCE_MODEL.warnings[0]), true);
  assert.equal(BUTTON_BOUNCE_MODEL.modelVersion, "1.0.0");
  assert.equal(BUTTON_BOUNCE_MODEL.modelId, "virtual-electronics-lab-idealized-button-bounce");
  assert.equal(BUTTON_BOUNCE_MODEL.supportedProfiles.teachingDefault, "teaching-default");
});

test("prellen folgt dem definierten Zeittakt um das Ziel", () => {
  const checkpoints = [0, 149, 150, 349, 350, 699, 700, 1199, 1200, 1799, 1800];

  for (const targetPressed of [true, false]) {
    for (const elapsedUs of checkpoints) {
      const result = evaluateButtonBounce({ targetPressed, elapsedUs, profile: "teaching-default" });
      assert.equal(result.ok, true);
      assert.equal(result.result.pressed, pressAt(targetPressed, elapsedUs));
      assert.equal(result.result.timeUs, elapsedUs);
      assert.equal(result.result.profile, "teaching-default");
      assert.equal(result.result.modelId, BUTTON_BOUNCE_MODEL.modelId);
      assert.equal(result.result.modelVersion, BUTTON_BOUNCE_MODEL.modelVersion);
      assert.equal(result.result.stable, elapsedUs >= 1800);
      assert.equal(result.result.warnings.length, 1);
      assert.equal(result.result.warnings[0].code, "BUTTON_BOUNCE_IDEALIZED");
      assert.equal(result.warnings.length, 1);
      assert.equal(result.warnings[0].code, "BUTTON_BOUNCE_IDEALIZED");
    }
  }
});

test("evaluateButtonBounce default profile behaves as teaching-default", () => {
  const result = evaluateButtonBounce({ targetPressed: false, elapsedUs: 500 });
  assert.equal(result.ok, true);
  assert.equal(result.result.profile, "teaching-default");
});

test("evaluateButtonBounce invalid inputs emit stable errors", () => {
  const invalidTarget = evaluateButtonBounce({ targetPressed: "true", elapsedUs: 100 });
  assert.equal(invalidTarget.ok, false);
  assert.equal(invalidTarget.errors.length, 1);
  assert.equal(invalidTarget.errors[0].code, "BUTTON_BOUNCE_TARGET_PRESSED_BOOLEAN_REQUIRED");
  assert.deepEqual(invalidTarget.warnings, []);

  const invalidElapsed = evaluateButtonBounce({ targetPressed: true, elapsedUs: 1.5 });
  assert.equal(invalidElapsed.ok, false);
  assert.equal(invalidElapsed.errors.length, 1);
  assert.equal(invalidElapsed.errors[0].code, "BUTTON_BOUNCE_ELAPSED_US_INTEGER_REQUIRED");

  const invalidProfile = evaluateButtonBounce({
    targetPressed: true,
    elapsedUs: 100,
    profile: "realtime",
  });
  assert.equal(invalidProfile.ok, false);
  assert.equal(invalidProfile.errors.length, 1);
  assert.equal(invalidProfile.errors[0].code, "BUTTON_BOUNCE_PROFILE_NOT_SUPPORTED");
});

test("evaluateButtonBounce is deterministic and leaves inputs unchanged", () => {
  const input = { targetPressed: true, elapsedUs: 400, profile: "teaching-default" };
  const first = evaluateButtonBounce(input);
  const second = evaluateButtonBounce(input);
  const third = evaluateButtonBounce(input);

  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(second, third);
  assert.deepEqual(first.result, second.result);
  assert.deepEqual(second.result, third.result);
  assert.deepEqual(input, { targetPressed: true, elapsedUs: 400, profile: "teaching-default" });
});

test("evaluateButtonBounce result and warning objects are deeply frozen", () => {
  const result = evaluateButtonBounce({
    targetPressed: true,
    elapsedUs: 100,
  });

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.result), true);
  assert.equal(Object.isFrozen(result.result.warnings), true);
  assert.equal(Object.isFrozen(result.warnings), true);
  assert.equal(Object.isFrozen(result.result.warnings[0]), true);

  assert.throws(
    () => {
      // @ts-expect-error - testing immutability contract
      result.result.pressed = false;
    },
    {
      name: "TypeError",
    },
  );
});

test("evaluateButtonBounce failures are immutable and stable", () => {
  const failed = evaluateButtonBounce({ targetPressed: "bad", elapsedUs: 100 });

  assert.equal(failed.ok, false);
  assert.equal(Object.isFrozen(failed), true);
  assert.equal(Object.isFrozen(failed.errors), true);
  assert.equal(Object.isFrozen(failed.errors[0]), true);
  assert.deepEqual(failed.warnings, []);
});

test("fehlende Optionen liefern einen stabilen, tief unveränderlichen Fehler", () => {
  for (const input of [undefined, null]) {
    const result = evaluateButtonBounce(input);
    assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TARGET_PRESSED_BOOLEAN_REQUIRED");
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.errors), true);
  }
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
    "net.",
    "require(",
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
  }
});
