import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { BUTTON_BOUNCE_MODEL } from "../../input-models/button-bounce.mjs";
import { BUTTON_CONTACT_MODEL } from "../../input-models/button-contact.mjs";
import { createButtonBounceTrace } from "../../labs/button-bounce-trace.mjs";

const filePath = fileURLToPath(new URL("../../labs/button-bounce-trace.mjs", import.meta.url));
const source = fs.readFileSync(filePath, "utf8");

test("trace output enthält erwartete Schema- und Versionsfelder", () => {
  const result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    sampleIntervalUs: 200,
    durationUs: 1000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.schemaVersion, "1.0.0");
  assert.equal(result.result.targetPressed, true);
  assert.equal(result.result.sampleIntervalUs, 200);
  assert.equal(result.result.durationUs, 1000);
  assert.equal(result.result.pullMode, "pull-up");
  assert.equal(result.result.units.timeUs, "microseconds");
  assert.equal(result.result.modelVersions.buttonBounce, BUTTON_BOUNCE_MODEL.modelVersion);
  assert.equal(result.result.modelVersions.buttonContact, BUTTON_CONTACT_MODEL.modelVersion);
});

test("trace enthält Rasterpunkte inklusive 0, Endzeit bei Rastergleichheit und erwartete Logikwerte", () => {
  const result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    sampleIntervalUs: 200,
    durationUs: 1000,
  });

  assert.equal(result.ok, true);
  const trace = result.result.trace;

  assert.equal(trace.length, 6);
  assert.deepEqual(trace.map((entry) => entry.timeUs), [0, 200, 400, 600, 800, 1000]);
  assert.deepEqual(trace.map((entry) => entry.pressed), [false, true, false, false, true, true]);
  assert.deepEqual(trace.map((entry) => entry.logicLevel), ["HIGH", "LOW", "HIGH", "HIGH", "LOW", "LOW"]);
  assert.deepEqual(trace.map((entry) => entry.normalizedValue), [1, 0, 1, 1, 0, 0]);
});

test("trace validiert Parameter", () => {
  let result = createButtonBounceTrace({
    targetPressed: "true",
    pullMode: "pull-up",
    sampleIntervalUs: 200,
    durationUs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TARGET_PRESSED_BOOLEAN_REQUIRED");

  result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "floating",
    sampleIntervalUs: 200,
    durationUs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TRACE_PULL_MODE_NOT_SUPPORTED");

  result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    sampleIntervalUs: 5,
    durationUs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TRACE_SAMPLE_INTERVAL_NOT_SUPPORTED");

  result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    sampleIntervalUs: 200,
    durationUs: 1_000_001,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TRACE_DURATION_NOT_SUPPORTED");

  result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    sampleIntervalUs: 1000,
    durationUs: 1_000_000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TRACE_SAMPLE_LIMIT_EXCEEDED");
});

test("trace bricht bei ungültigem Kontaktbezug mit stabilen Fehlern ab", () => {
  const result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    contactReference: "5v",
    sampleIntervalUs: 200,
    durationUs: 1000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TRACE_CONTACT_REFERENCE_NOT_SUPPORTED");
  assert.deepEqual(result.warnings, []);
});

test("trace dedupliziert WARNINGS vollständig ohne Seiteneffekte", () => {
  const result = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-down",
    contactReference: "gnd",
    sampleIntervalUs: 200,
    durationUs: 1800,
    profile: "teaching-default",
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.warnings.length, 2);
  const codes = result.result.warnings.map((entry) => entry.code).sort();
  assert.deepEqual(codes, ["BUTTON_BOUNCE_IDEALIZED", "BUTTON_CONTACT_NO_LEVEL_CHANGE"].sort());
  assert.deepEqual(result.warnings, result.result.warnings);
  assert.equal(Object.isFrozen(result.result.trace), true);
  assert.equal(Object.isFrozen(result.result.trace[0]), true);
});

test("input- und Ergebnisobjekte bleiben unveraendert und deterministisch", () => {
  const options = {
    targetPressed: false,
    pullMode: "pull-down",
    sampleIntervalUs: 250,
    durationUs: 1000,
  };
  const optionsCopy = structuredClone(options);
  const first = createButtonBounceTrace(options);
  const second = createButtonBounceTrace(options);
  assert.deepEqual(first, second);
  assert.deepEqual(options, optionsCopy);
});

test("source code hat keine verbotenen Laufzeitkonstrukte", () => {
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

test("fehlende Optionen und Fehlerantworten bleiben kontrolliert und tief unveränderlich", () => {
  for (const input of [undefined, null]) {
    const result = createButtonBounceTrace(input);
    assert.equal(result.errors[0].code, "BUTTON_BOUNCE_TARGET_PRESSED_BOOLEAN_REQUIRED");
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.errors), true);
    assert.equal(Object.isFrozen(result.errors[0]), true);
    assert.equal(Object.isFrozen(result.warnings), true);
  }
});
