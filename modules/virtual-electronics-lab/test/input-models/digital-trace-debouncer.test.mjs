import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DIGITAL_TRACE_DEBOUNCE_MODEL,
  debounceDigitalTrace,
} from "../../input-models/digital-trace-debouncer.mjs";
import { createButtonBounceTrace } from "../../labs/button-bounce-trace.mjs";

const filePath = fileURLToPath(
  new URL("../../input-models/digital-trace-debouncer.mjs", import.meta.url),
);
const source = fs.readFileSync(path.resolve(path.dirname(filePath), "digital-trace-debouncer.mjs"), "utf8");

test("digital-trace debouncer model contract is immutable and complete", () => {
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.supportedLevels), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.supportedTraceRange), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.warnings), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.errors), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.warnings[0]), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.errors[0]), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.errors[1]), true);
  assert.equal(Object.isFrozen(DIGITAL_TRACE_DEBOUNCE_MODEL.errors[5]), true);

  assert.equal(DIGITAL_TRACE_DEBOUNCE_MODEL.modelId, "virtual-electronics-lab-idealized-digital-trace-debounce");
  assert.equal(DIGITAL_TRACE_DEBOUNCE_MODEL.modelVersion, "1.0.0");
  assert.equal(DIGITAL_TRACE_DEBOUNCE_MODEL.supportedTraceRange.minSamples, 1);
  assert.equal(DIGITAL_TRACE_DEBOUNCE_MODEL.supportedTraceRange.maxSamples, 501);
  assert.equal(DIGITAL_TRACE_DEBOUNCE_MODEL.supportedLevels[0], "LOW");
  assert.equal(DIGITAL_TRACE_DEBOUNCE_MODEL.supportedLevels[1], "HIGH");
});

test("konstante LOW- und HIGH-Spur bleiben unverändert und liefern korrekt normalisiert", () => {
  const lowTrace = [
    { timeUs: 0, logicLevel: "LOW" },
    { timeUs: 200, logicLevel: "LOW" },
    { timeUs: 500, logicLevel: "LOW" },
  ];
  const highTrace = [
    { timeUs: 0, logicLevel: "HIGH" },
    { timeUs: 200, logicLevel: "HIGH" },
    { timeUs: 500, logicLevel: "HIGH" },
  ];

  const lowResult = debounceDigitalTrace({ trace: lowTrace, stableWindowUs: 300 });
  const highResult = debounceDigitalTrace({ trace: highTrace, stableWindowUs: 300 });

  assert.equal(lowResult.ok, true);
  assert.equal(highResult.ok, true);
  assert.deepEqual(lowResult.result.trace.map((entry) => entry.debouncedLogicLevel), ["LOW", "LOW", "LOW"]);
  assert.deepEqual(highResult.result.trace.map((entry) => entry.debouncedLogicLevel), ["HIGH", "HIGH", "HIGH"]);
  assert.deepEqual(lowResult.result.trace.map((entry) => entry.debouncedNormalizedValue), [0, 0, 0]);
  assert.deepEqual(highResult.result.trace.map((entry) => entry.debouncedNormalizedValue), [1, 1, 1]);
  assert.deepEqual(lowResult.result.trace.map((entry) => entry.changed), [false, false, false]);
  assert.deepEqual(highResult.result.trace.map((entry) => entry.changed), [false, false, false]);
});

test("prellspur aus FS-004 wird mit 300 µs Fenster korrekt entprellt", () => {
  const bounce = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    contactReference: "gnd",
    sampleIntervalUs: 50,
    durationUs: 2500,
  });
  assert.equal(bounce.ok, true);

  const result = debounceDigitalTrace({ trace: bounce.result.trace, stableWindowUs: 300 });
  assert.equal(result.ok, true);
  const changes = result.result.trace.filter((entry) => entry.changed);
  assert.deepEqual(changes.map((entry) => [entry.timeUs, entry.debouncedLogicLevel]), [
    [1000, "LOW"],
    [1500, "HIGH"],
    [2100, "LOW"],
  ]);
  assert.equal(result.result.trace[0].debouncedLogicLevel, "HIGH");
  assert.equal(result.result.trace.at(-1).debouncedLogicLevel, "LOW");
});

test("kurzer Puls unterhalb des Fensters wird unterdrückt", () => {
  const trace = [
    { timeUs: 0, logicLevel: "LOW" },
    { timeUs: 80, logicLevel: "HIGH" },
    { timeUs: 170, logicLevel: "LOW" },
  ];

  const result = debounceDigitalTrace({ trace, stableWindowUs: 150 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.result.trace.map((entry) => entry.debouncedLogicLevel), ["LOW", "LOW", "LOW"]);
  assert.deepEqual(result.result.trace.map((entry) => entry.changed), [false, false, false]);
});

test("stabiler Wechsel wird am ersten zulässigen Sample übernommen", () => {
  const trace = [
    { timeUs: 0, logicLevel: "LOW" },
    { timeUs: 50, logicLevel: "HIGH" },
    { timeUs: 150, logicLevel: "HIGH" },
    { timeUs: 250, logicLevel: "HIGH" },
  ];

  const result = debounceDigitalTrace({ trace, stableWindowUs: 100 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.result.trace.map((entry) => entry.debouncedLogicLevel), ["LOW", "LOW", "HIGH", "HIGH"]);
  assert.deepEqual(result.result.trace.map((entry) => entry.changed), [false, false, true, false]);
});

test("invalides trace-Format, Reihenfolge, Pegel, Samplezahl und Zeitfenster werden mit stabilen Fehlern abgefangen", () => {
  const valid = [{ timeUs: 0, logicLevel: "LOW" }];

  const missing = debounceDigitalTrace({ stableWindowUs: 100 });
  assert.equal(missing.ok, false);
  assert.equal(missing.errors[0].code, "DIGITAL_TRACE_DEBOUNCE_TRACE_REQUIRED");
  assert.deepEqual(missing.warnings, []);

  const badOrder = debounceDigitalTrace({
    trace: [{ timeUs: 200, logicLevel: "LOW" }, { timeUs: 100, logicLevel: "HIGH" }],
    stableWindowUs: 100,
  });
  assert.equal(badOrder.ok, false);
  assert.equal(badOrder.errors[0].code, "DIGITAL_TRACE_DEBOUNCE_SAMPLE_TIME_NOT_SUPPORTED");

  const badLevel = debounceDigitalTrace({
    trace: [{ timeUs: 0, logicLevel: "MID" }],
    stableWindowUs: 100,
  });
  assert.equal(badLevel.ok, false);
  assert.equal(badLevel.errors[0].code, "DIGITAL_TRACE_DEBOUNCE_SAMPLE_LEVEL_NOT_SUPPORTED");

  const tooMany = debounceDigitalTrace({
    trace: Array.from({ length: 502 }, (_, index) => ({ timeUs: index, logicLevel: index % 2 === 0 ? "LOW" : "HIGH" })),
    stableWindowUs: 100,
  });
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.errors[0].code, "DIGITAL_TRACE_DEBOUNCE_TRACE_LENGTH_NOT_SUPPORTED");

  const badWindow = debounceDigitalTrace({ trace: valid, stableWindowUs: 40 });
  assert.equal(badWindow.ok, false);
  assert.equal(badWindow.errors[0].code, "DIGITAL_TRACE_DEBOUNCE_WINDOW_REQUIRED");
});

test("ergebnis enthält Schema-, Modell-, Zeit- und Einheit-Metadaten", () => {
  const result = debounceDigitalTrace({
    trace: [{ timeUs: 0, logicLevel: "LOW" }, { timeUs: 120, logicLevel: "LOW" }],
    stableWindowUs: 50,
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.schemaVersion, "1.0.0");
  assert.equal(result.result.modelId, DIGITAL_TRACE_DEBOUNCE_MODEL.modelId);
  assert.equal(result.result.modelVersion, DIGITAL_TRACE_DEBOUNCE_MODEL.modelVersion);
  assert.equal(result.result.stableWindowUs, 50);
  assert.equal(result.result.units.timeUs, "microseconds");
  assert.equal(result.result.units.debouncedLogicLevel, "binary");
  assert.equal(result.warnings[0].code, "DIGITAL_TRACE_DEBOUNCE_IDEALIZED");
});

test("ergebnisse und fehlerantworten sind tief unveraenderlich", () => {
  const input = {
    trace: [{ timeUs: 0, logicLevel: "LOW" }, { timeUs: 120, logicLevel: "HIGH" }],
    stableWindowUs: 100,
  };
  const before = structuredClone(input);
  const result = debounceDigitalTrace(input);

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.warnings), true);
  assert.equal(Object.isFrozen(result.result), true);
  assert.equal(Object.isFrozen(result.result.trace), true);
  assert.equal(Object.isFrozen(result.result.trace[0]), true);
  assert.equal(Object.isFrozen(result.result.trace[1]), true);
  assert.equal(Object.isFrozen(result.result.units), true);
  assert.deepEqual(input, before);

  const fail = debounceDigitalTrace({ trace: [0], stableWindowUs: 100 });
  assert.equal(fail.ok, false);
  assert.equal(Object.isFrozen(fail), true);
  assert.equal(Object.isFrozen(fail.errors), true);
  assert.equal(Object.isFrozen(fail.errors[0]), true);
  assert.equal(fail.warnings[0], undefined);
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
