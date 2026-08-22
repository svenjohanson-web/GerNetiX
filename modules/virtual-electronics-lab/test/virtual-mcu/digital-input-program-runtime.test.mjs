import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL,
  DIGITAL_INPUT_PROGRAM_START_CODE,
  executeDigitalInputProgram,
} from "../../virtual-mcu/digital-input-program-runtime.mjs";

function executeAndFreezeCheck(source, inputs) {
  return executeDigitalInputProgram({
    sourceFile: source,
    digitalInputs: inputs,
  });
}

test("Modellvertrag und Startcode sind vorhanden und unveraenderlich", () => {
  assert.equal(Object.isFrozen(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL), true);
  assert.equal(Object.isFrozen(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.limits), true);
  assert.equal(Object.isFrozen(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedPin), true);
  assert.equal(Object.isFrozen(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedPinModes), true);
  assert.equal(Object.isFrozen(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedLevels), true);
  assert.equal(typeof DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelId, "string");
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelVersion, "1.1.0");
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.architecture, "interpreter");
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.limits.maxSourceLength, 4096);
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.limits.maxRelevantStatements, 16);
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedPinModes.length, 3);
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedPinModes[2], "INPUT");

  assert.throws(() => {
    DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedPin[0] = 5;
  }, {
    name: "TypeError",
  });
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedPin[0], 4);

  assert.throws(() => {
    DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedLevels.push("FLOAT");
  }, {
    name: "TypeError",
  });
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.supportedLevels.length, 2);

  assert.throws(() => {
    DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.limits.maxSourceLength = 0;
  }, {
    name: "TypeError",
  });
  assert.equal(DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.limits.maxSourceLength, 4096);

  assert.equal(typeof DIGITAL_INPUT_PROGRAM_START_CODE, "string");
  const parsed = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "HIGH" });
  assert.equal(parsed.ok, true);
});

test("fehlende/ungueltige options liefern kontrollierten SOURCE_REQUIRED-Fehler", () => {
  const none = executeDigitalInputProgram();
  assert.equal(none.ok, false);
  assert.equal(none.errorSource, "digital-input-program-runtime");
  assert.equal(none.result, null);
  assert.equal(none.errors[0].code, "DIGITAL_INPUT_PROGRAM_SOURCE_REQUIRED");

  const nullOptions = executeDigitalInputProgram(null);
  assert.equal(nullOptions.ok, false);
  assert.equal(nullOptions.errorSource, "digital-input-program-runtime");
  assert.equal(nullOptions.result, null);
  assert.equal(nullOptions.errors[0].code, "DIGITAL_INPUT_PROGRAM_SOURCE_REQUIRED");

  const nonObject = executeDigitalInputProgram("not-an-object");
  assert.equal(nonObject.ok, false);
  assert.equal(nonObject.errorSource, "digital-input-program-runtime");
  assert.equal(nonObject.result, null);
  assert.equal(nonObject.errors[0].code, "DIGITAL_INPUT_PROGRAM_SOURCE_REQUIRED");
});

test("HIGH und LOW werden korrekt normalisiert", () => {
  const high = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "HIGH" });
  const low = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "LOW" });

  assert.equal(high.ok, true);
  assert.equal(low.ok, true);
  assert.equal(high.result.logicLevel, "HIGH");
  assert.equal(high.result.normalizedValue, 1);
  assert.equal(high.result.variables.buttonState, 1);
  assert.equal(low.result.logicLevel, "LOW");
  assert.equal(low.result.normalizedValue, 0);
  assert.equal(low.result.variables.buttonState, 0);
});

test("Beide Pull-Modi werden akzeptiert", () => {
  const pullUp = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const pullDown = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLDOWN);\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;

  const up = executeAndFreezeCheck(pullUp, { 4: "LOW" });
  const down = executeAndFreezeCheck(pullDown, { 4: "LOW" });

  assert.equal(up.ok, true);
  assert.equal(up.result.pullMode, "INPUT_PULLUP");
  assert.equal(down.ok, true);
  assert.equal(down.result.pullMode, "INPUT_PULLDOWN");
});

test("INPUT ist als weiterer Unterstützungsmodus akzeptiert", () => {
  const pull = DIGITAL_INPUT_PROGRAM_START_CODE.replace("INPUT_PULLUP", "INPUT");
  const input = executeAndFreezeCheck(pull, { 4: "LOW" });

  assert.equal(input.ok, true);
  assert.equal(input.result.pullMode, "INPUT");
  assert.equal(input.result.logicLevel, "LOW");
  assert.equal(input.result.normalizedValue, 0);
});

test("Kommentare und Whitespace veraendern den Ablauf nicht", () => {
  const code = `\n\n// setup\nint buttonState = LOW;\n\n/* block */\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}\n`;
  const result = executeAndFreezeCheck(code, { 4: "HIGH" });

  assert.equal(result.ok, true);
  assert.equal(result.result.normalizedValue, 1);
});

test("fehlendes/dupliziertes setup oder loop wird als Syntaxfehler geliefert", () => {
  const missingLoop = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}`;
  const missing = executeAndFreezeCheck(missingLoop, { 4: "HIGH" });
  assert.equal(missing.ok, false);
  assert.equal(missing.errors[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");

  const double = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const duplicated = executeAndFreezeCheck(double, { 4: "HIGH" });
  assert.equal(duplicated.ok, false);
  assert.equal(duplicated.errors[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
  assert.equal(typeof duplicated.errors[0].line, "number");
  const expectedDuplicatePosition = double.indexOf("void setup() {", double.indexOf("void setup() {") + 1);
  assert.equal(duplicated.errors[0].position, expectedDuplicatePosition);

  const duplicateLoop = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const duplicateLoopResult = executeAndFreezeCheck(duplicateLoop, { 4: "HIGH" });
  assert.equal(duplicateLoopResult.ok, false);
  assert.equal(duplicateLoopResult.errors[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
  assert.equal(typeof duplicateLoopResult.errors[0].position, "number");
  const expectedDuplicateLoopPosition = duplicateLoop.indexOf("void loop() {", duplicateLoop.indexOf("void loop() {") + 1);
  assert.equal(duplicateLoopResult.errors[0].position, expectedDuplicateLoopPosition);
});

test("ungegeschlossene Funktion liefert Position des öffnenden Braces", () => {
  const unclosed = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const result = executeAndFreezeCheck(unclosed, { 4: "HIGH" });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
  assert.equal(result.errors[0].position, unclosed.indexOf("{", unclosed.indexOf("void setup()")));
});

test("falscher Pin wird abgelehnt", () => {
  const wrongSetupPin = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(12, INPUT_PULLUP);\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const wrongLoopPin = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  buttonState = digitalRead(12);\n}`;

  const setupResult = executeAndFreezeCheck(wrongSetupPin, { 4: "HIGH" });
  const loopResult = executeAndFreezeCheck(wrongLoopPin, { 4: "HIGH" });

  assert.equal(setupResult.ok, false);
  assert.equal(setupResult.errors[0].code, "DIGITAL_INPUT_PROGRAM_PIN_NOT_AVAILABLE");
  assert.equal(loopResult.ok, false);
  assert.equal(loopResult.errors[0].code, "DIGITAL_INPUT_PROGRAM_PIN_NOT_AVAILABLE");
});

test("fehlende Eingangskonfiguration wird korrekt erkannt", () => {
  const source = `int buttonState = LOW;\n\nvoid setup() {\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const result = executeAndFreezeCheck(source, { 4: "HIGH" });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "DIGITAL_INPUT_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT");
});

test("fehlender und ungueltiger Eingangspegel wird erkannt", () => {
  const missing = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, {});
  const invalid = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "up" });

  assert.equal(missing.ok, false);
  assert.equal(missing.errors[0].code, "DIGITAL_INPUT_PROGRAM_INPUT_REQUIRED");
  assert.equal(missing.errorSource, "digital-input-program-runtime");
  assert.equal(missing.result, null);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, "DIGITAL_INPUT_PROGRAM_LEVEL_INVALID");
  assert.equal(invalid.errorSource, "digital-input-program-runtime");
  assert.equal(invalid.result, null);
});

test("quellcode- und anweisungslimit wird durchgesetzt", () => {
  const tooLong = "A".repeat(4097);
  const tooLongResult = executeAndFreezeCheck(tooLong, { 4: "HIGH" });

  assert.equal(tooLongResult.ok, false);
  assert.equal(tooLongResult.errors[0].code, "DIGITAL_INPUT_PROGRAM_SOURCE_TOO_LARGE");

  const tooMany = `int buttonState = LOW;\n\nvoid setup() {\n${Array.from({ length: 17 }, () => "  pinMode(4, INPUT_PULLUP);").join("\n")}\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const tooManyParsed = executeAndFreezeCheck(tooMany, { 4: "HIGH" });

  assert.equal(tooManyParsed.ok, false);
  assert.equal(tooManyParsed.errors[0].code, "DIGITAL_INPUT_PROGRAM_STATEMENT_LIMIT_EXCEEDED");
});

test("syntaxfehler enthalten stabile Position", () => {
  const broken = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP)\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;
  const result = executeAndFreezeCheck(broken, { 4: "HIGH" });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
  assert.equal(result.errorSource, "digital-input-program-runtime");
  assert.equal(result.result, null);
  assert.equal(typeof result.errors[0].line, "number");
  assert.equal(typeof result.errors[0].column, "number");
  assert.equal(typeof result.errors[0].position, "number");
});

test("Eingabeobjekt bleibt unveraendert", () => {
  const inputs = { 4: "HIGH" };
  const before = structuredClone(inputs);
  executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, inputs);

  assert.deepEqual(inputs, before);
});

test("Ergebnis und Modell sind tief unveraenderlich", () => {
  const run1 = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "LOW" });
  assert.equal(run1.ok, true);
  const run2 = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "LOW" });

  assert.deepEqual(run1.result, run2.result);
  assert.equal(Object.isFrozen(run1.result), true);
  assert.equal(Object.isFrozen(run1.result.variables), true);
  assert.equal(Object.isFrozen(run2.warnings), true);

  assert.throws(() => {
    run1.result.variables.buttonState = 3;
  }, {
    name: "TypeError",
  });
  assert.equal(run1.result.variables.buttonState, 0);
});

test("deterministischer Hash fuer identische Eingaben", () => {
  const first = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "LOW" });
  const second = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "LOW" });

  assert.equal(first.ok, true);
  assert.equal(first.result.sourceHash, second.result.sourceHash);
});

test("LF und CRLF ergeben identischen Source-Hash", () => {
  const crlfSource = DIGITAL_INPUT_PROGRAM_START_CODE.replace(/\n/g, "\r\n");
  const lf = executeAndFreezeCheck(DIGITAL_INPUT_PROGRAM_START_CODE, { 4: "LOW" });
  const crlf = executeAndFreezeCheck(crlfSource, { 4: "LOW" });

  assert.equal(lf.ok, true);
  assert.equal(crlf.ok, true);
  assert.equal(lf.result.sourceHash, crlf.result.sourceHash);
});

test("Quelle enthält keine verbotenen Laufzeitkonstrukte", () => {
  const filePath = fileURLToPath(new URL("../../virtual-mcu/digital-input-program-runtime.mjs", import.meta.url));
  const source = fs.readFileSync(path.resolve(path.dirname(filePath), "digital-input-program-runtime.mjs"), "utf8");

  const forbidden = [
    "eval(",
    "new Function",
    "WebAssembly",
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
