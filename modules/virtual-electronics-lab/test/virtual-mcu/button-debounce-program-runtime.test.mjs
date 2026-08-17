import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL,
  BUTTON_DEBOUNCE_PROGRAM_START_CODE,
  executeButtonDebounceProgram,
} from "../../virtual-mcu/button-debounce-program-runtime.mjs";
import { createButtonBounceTrace } from "../../labs/button-bounce-trace.mjs";

const filePath = fileURLToPath(new URL("../../virtual-mcu/button-debounce-program-runtime.mjs", import.meta.url));
const source = fs.readFileSync(path.resolve(path.dirname(filePath), "button-debounce-program-runtime.mjs"), "utf8");

function withDebounceUs(sourceCode, debounceUs) {
  return sourceCode.replace(/const unsigned long debounceUs = \d+;/u, `const unsigned long debounceUs = ${debounceUs};`);
}

function execute(sourceCode, traceInput) {
  return executeButtonDebounceProgram({
    sourceFile: sourceCode,
    measurementTrace: traceInput,
  });
}

function traceSample(timesUs, levels) {
  return timesUs.map((timeUs, index) => ({ timeUs, logicLevel: levels[index] }));
}

function expectDeepFrozen(value, title = "") {
  assert.equal(Object.isFrozen(value), true, `frozen: ${title}`);
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === "object") {
      expectDeepFrozen(child, `${title}.${key}`);
    }
  }
}

const FLAT_TRACE = [
  { timeUs: 0, logicLevel: "HIGH" },
  { timeUs: 100, logicLevel: "HIGH" },
  { timeUs: 200, logicLevel: "HIGH" },
];

test("Modellvertrag und Startcode sind vorhanden", () => {
  assert.equal(Object.isFrozen(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL), true);
  assert.equal(Object.isFrozen(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.limits), true);
  assert.equal(Object.isFrozen(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.supportedPin), true);
  assert.equal(Object.isFrozen(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.supportedPinModes), true);
  assert.equal(Object.isFrozen(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.supportedLevels), true);
  assert.equal(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.modelVersion, "1.0.0");
  assert.equal(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.limits.maxSourceLength, 12_000);
  assert.equal(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.supportedPinModes[0], "INPUT_PULLUP");
  assert.equal(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.supportedLevels[0], "HIGH");

  assert.equal(typeof BUTTON_DEBOUNCE_PROGRAM_START_CODE, "string");
  const baseline = execute(BUTTON_DEBOUNCE_PROGRAM_START_CODE, FLAT_TRACE);
  assert.equal(baseline.ok, true);
});
test("Startcode wird über FS-004-Bounce-Trace korrekt entprellt", () => {
  const bounce = createButtonBounceTrace({
    targetPressed: true,
    pullMode: "pull-up",
    contactReference: "gnd",
    sampleIntervalUs: 100,
    durationUs: 2500,
  });
  assert.equal(bounce.ok, true);

  const measurementTrace = bounce.result.trace.map((sample) => ({
    timeUs: sample.timeUs,
    logicLevel: sample.logicLevel,
  }));
  const result = execute(BUTTON_DEBOUNCE_PROGRAM_START_CODE, measurementTrace);

  assert.equal(result.ok, true);
  assert.equal(result.result.debouncedTrace.length, measurementTrace.length);
  assert.equal(typeof result.result.sourceHash, "string");
  assert.equal(result.result.debounceUs, 700);
  assert.equal(result.result.buttonState, 0);
  assert.equal(result.result.buttonStateLogicLevel, "LOW");
  assert.equal(result.result.modelVersions.buttonDebounceProgramRuntime, "1.0.0");
  assert.equal(result.result.modelVersions.digitalTraceDebouncer, "1.0.0");
  assert.equal(result.result.units.timeUs, "microseconds");
});

test("Debounce-Fenster 300, 700 und 2000 werden akzeptiert und umgesetzt", () => {
  const trace = traceSample([0, 250, 1000], ["HIGH", "LOW", "LOW"]);

  const result300 = execute(withDebounceUs(BUTTON_DEBOUNCE_PROGRAM_START_CODE, 300), trace);
  const result700 = execute(withDebounceUs(BUTTON_DEBOUNCE_PROGRAM_START_CODE, 700), trace);
  const result2000 = execute(withDebounceUs(BUTTON_DEBOUNCE_PROGRAM_START_CODE, 2000), trace);

  assert.equal(result300.ok, true);
  assert.equal(result700.ok, true);
  assert.equal(result2000.ok, true);
  assert.equal(result300.result.buttonState, 0);
  assert.equal(result700.result.buttonState, 0);
  assert.equal(result2000.result.buttonState, 1);
});

test("Kommentare, Whitespace und CRLF werden ignoriert", () => {
  const crlfCode = `// debounce example\n${BUTTON_DEBOUNCE_PROGRAM_START_CODE}`.replace(/\n/g, "\r\n");
  const withInnerComment = crlfCode
    .replace("digitalRead(4);", "/*r*/digitalRead(4);")
    .replace("buttonState = rawState;", "/*b*/buttonState = rawState;") ;

  const result = execute(withInnerComment, FLAT_TRACE);
  assert.equal(result.ok, true);
  assert.equal(typeof result.result.sourceHash, "string");
});

test("Pflichtpin, -modus und -anweisungen werden strikt geprüft", () => {
  const invalidPinSetup = BUTTON_DEBOUNCE_PROGRAM_START_CODE.replace("pinMode(4, INPUT_PULLUP)", "pinMode(5, INPUT_PULLUP)");
  const invalidPinMode = BUTTON_DEBOUNCE_PROGRAM_START_CODE.replace("INPUT_PULLUP", "INPUT_PULLDOWN");
  const invalidLoopPin = BUTTON_DEBOUNCE_PROGRAM_START_CODE.replace("digitalRead(4)", "digitalRead(12)");
  const missingRawState = "const unsigned long debounceUs = 700;\nint buttonState = HIGH;\nint lastRawState = HIGH;\nunsigned long changedAtUs = 0;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (true) {\n    changedAtUs = micros();\n    lastRawState = digitalRead(4);\n  }\n  if (micros() - changedAtUs >= debounceUs) {\n    buttonState = lastRawState;\n  }\n}";

  const invalidPinSetupResult = execute(invalidPinSetup, FLAT_TRACE);
  const invalidPinModeResult = execute(invalidPinMode, FLAT_TRACE);
  const invalidLoopPinResult = execute(invalidLoopPin, FLAT_TRACE);
  const missingRawResult = execute(missingRawState, FLAT_TRACE);

  assert.equal(invalidPinSetupResult.ok, false);
  assert.equal(invalidPinSetupResult.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_PIN_NOT_AVAILABLE");
  assert.equal(invalidPinModeResult.ok, false);
  assert.equal(invalidPinModeResult.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_PIN_MODE_NOT_SUPPORTED");
  assert.equal(invalidLoopPinResult.ok, false);
  assert.equal(invalidLoopPinResult.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_PIN_NOT_AVAILABLE");
  assert.equal(missingRawResult.ok, false);
  assert.equal(missingRawResult.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR");
});

test("Debounce-Fensterbereich wird stabil geprüft", () => {
  const tooSmall = withDebounceUs(BUTTON_DEBOUNCE_PROGRAM_START_CODE, 49);
  const tooLarge = withDebounceUs(BUTTON_DEBOUNCE_PROGRAM_START_CODE, 100_001);
  const minOk = execute(tooSmall, FLAT_TRACE);
  const maxOk = execute(tooLarge, FLAT_TRACE);

  assert.equal(minOk.ok, false);
  assert.equal(minOk.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_DEBOUNCE_WINDOW_INVALID");
  assert.equal(maxOk.ok, false);
  assert.equal(maxOk.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_DEBOUNCE_WINDOW_INVALID");
});

test("Quellcode-Limit und Syntax-/Pinfehler liefern stabile Diagnosen", () => {
  const tooLong = "A".repeat(BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.limits.maxSourceLength + 1);
  const tooLongResult = execute(tooLong, FLAT_TRACE);

  const duplicateLoop = `${BUTTON_DEBOUNCE_PROGRAM_START_CODE}\n\nvoid loop() {\n  int rawState = digitalRead(4);\n}\n`;
  const duplicateResult = execute(duplicateLoop, FLAT_TRACE);

  const brokenSemicolon = `const unsigned long debounceUs = 700;\nint buttonState = HIGH;\nint lastRawState = HIGH;\nunsigned long changedAtUs = 0;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP)\n}\n\nvoid loop() {\n  int rawState = digitalRead(4);\n  if (rawState != lastRawState) {\n    changedAtUs = micros();\n    lastRawState = rawState;\n  }\n  if (micros() - changedAtUs >= debounceUs) {\n    buttonState = rawState;\n  }\n}`;

  assert.equal(tooLongResult.ok, false);
  assert.equal(tooLongResult.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_SOURCE_TOO_LARGE");
  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicateResult.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR");
  assert.equal(duplicateResult.errors[0].position, duplicateLoop.indexOf("void loop() {", duplicateLoop.indexOf("void loop() {") + 1));

  const broken = execute(brokenSemicolon, FLAT_TRACE);
  assert.equal(broken.ok, false);
  assert.equal(broken.errors[0].code, "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR");
  assert.equal(typeof broken.errors[0].line, "number");
  assert.equal(typeof broken.errors[0].column, "number");
  assert.equal(typeof broken.errors[0].position, "number");
});

test("Ungültige measurementTrace wird unverändert ans FS-007-Modell weitergereicht", () => {
  const missingTrace = execute(BUTTON_DEBOUNCE_PROGRAM_START_CODE);
  const badTrace = execute(BUTTON_DEBOUNCE_PROGRAM_START_CODE, [{}]);

  assert.equal(missingTrace.ok, false);
  assert.equal(missingTrace.errorSource, "digital-trace-debouncer");
  assert.equal(missingTrace.errors[0].code, "DIGITAL_TRACE_DEBOUNCE_TRACE_REQUIRED");
  assert.equal(badTrace.ok, false);
  assert.equal(badTrace.errorSource, "digital-trace-debouncer");
  assert.equal(badTrace.errors[0].code, "DIGITAL_TRACE_DEBOUNCE_SAMPLE_TIME_REQUIRED");
});

test("Quelleingaben bleiben unveraendert", () => {
  const sourceCode = BUTTON_DEBOUNCE_PROGRAM_START_CODE;
  const trace = [
    { timeUs: 0, logicLevel: "HIGH" },
    { timeUs: 100, logicLevel: "LOW" },
    { timeUs: 220, logicLevel: "LOW" },
  ];
  const sourceCopy = structuredClone(sourceCode);
  const traceCopy = structuredClone(trace);

  const result = execute(sourceCode, trace);

  assert.equal(result.ok, true);
  assert.deepEqual(sourceCode, sourceCopy);
  assert.deepEqual(trace, traceCopy);
});

test("Deterministisches Ergebnis und tiefe Unveraenderlichkeit", () => {
  const trace = traceSample([0, 50, 110, 300], ["HIGH", "LOW", "LOW", "LOW"]);
  const first = execute(withDebounceUs(BUTTON_DEBOUNCE_PROGRAM_START_CODE, 100), trace);
  const second = execute(withDebounceUs(BUTTON_DEBOUNCE_PROGRAM_START_CODE, 100), trace);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.result, second.result);
  assert.equal(Object.isFrozen(first.warnings), true);
  expectDeepFrozen(first.result);
  expectDeepFrozen(first.result.rawTrace);
  expectDeepFrozen(first.result.debouncedTrace);
});

test("Quellcode enthält keine verbotenen Laufzeitkonstrukte", () => {
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
    "setInterval(",
    "setTimeout(",
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
  }
});
