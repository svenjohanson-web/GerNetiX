import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADC_PROGRAM_RUNTIME_MODEL,
  ADC_PROGRAM_START_CODE,
  parseAdcProgram,
  executeAdcProgram,
} from "../../virtual-mcu/adc-program-runtime.mjs";

function makeLongStatementProgram(statement, count) {
  const body = Array.from({ length: count }, () => `  ${statement}\n`).join("\n");
  return `int adcValue = 0;

void setup() {
  pinMode(A0, INPUT);
}

void loop() {
${body}
}`;
}

test("Schema: Standard-Startcode wird geparst", () => {
  const parsed = parseAdcProgram(ADC_PROGRAM_START_CODE);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.program.setup.length, 1);
  assert.equal(parsed.program.loop.length, 1);
});

test("Erfolgreich: 1,65V bei 3,3V / 12 Bit erzeugt 2048", () => {
  const result = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 1.65 },
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.adc.code, 2048);
  assert.equal(result.result.variables.adcValue, 2048);
  assert.equal(result.result.adc.quantizedVoltageV, (2048 / 4095) * 3.3);
  assert.deepEqual(result.warnings, []);
});

test("Erfolgreich: 0V und 3,3V ergeben 0 und Maximalcode", () => {
  const zero = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 0 },
  });
  const top = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 3.3 },
  });

  assert.equal(zero.ok, true);
  assert.equal(top.ok, true);
  assert.equal(zero.result.adc.code, 0);
  assert.equal(top.result.adc.code, 4095);
  assert.equal(zero.result.adc.quantizedVoltageV, 0);
  assert.equal(top.result.adc.quantizedVoltageV, 3.3);
});

test("Warncodes aus dem ADC-Quantisierer werden 1:1 übernommen", () => {
  const below = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: -0.5 },
  });
  const above = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 4.2 },
  });

  assert.equal(below.ok, true);
  assert.equal(above.ok, true);
  assert.equal(below.warnings[0].code, "ADC_INPUT_BELOW_RANGE");
  assert.equal(above.warnings[0].code, "ADC_INPUT_ABOVE_RANGE");
  assert.equal(below.result.adc.code, 0);
  assert.equal(above.result.adc.code, 4095);
});

test("fehlt pinMode(A0, INPUT), liefert ADC_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT", () => {
  const source = `int adcValue = 0;

void setup() {
}

void loop() {
  adcValue = analogRead(A0);
}`;

  const result = executeAdcProgram({
    sourceFile: source,
    analogInputs: { A0: 1.2 },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorSource, "adc-program-runtime");
  assert.equal(result.errors[0].code, "ADC_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT");
});

test("falscher Pin in setup liefert ADC_PROGRAM_PIN_NOT_AVAILABLE", () => {
  const source = `int adcValue = 0;

void setup() {
  pinMode(A1, INPUT);
}

void loop() {
  adcValue = analogRead(A0);
}`;

  const result = executeAdcProgram({
    sourceFile: source,
    analogInputs: { A0: 1.2 },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorSource, "adc-program-runtime");
  assert.equal(result.errors[0].code, "ADC_PROGRAM_PIN_NOT_AVAILABLE");
});

test("falscher Pin in loop liefert ADC_PROGRAM_PIN_NOT_AVAILABLE", () => {
  const source = `int adcValue = 0;

void setup() {
  pinMode(A0, INPUT);
}

void loop() {
  adcValue = analogRead(A1);
}`;

  const result = executeAdcProgram({
    sourceFile: source,
    analogInputs: { A0: 1.2 },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorSource, "adc-program-runtime");
  assert.equal(result.errors[0].code, "ADC_PROGRAM_PIN_NOT_AVAILABLE");
});

test("fehlende Eingangsdaten für A0 liefern ADC_PROGRAM_ANALOG_INPUT_REQUIRED", () => {
  const result = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorSource, "adc-program-runtime");
  assert.equal(result.errors[0].code, "ADC_PROGRAM_ANALOG_INPUT_REQUIRED");
});

test("nicht geschlossener Blockkommentar wird als Syntaxfehler abgewiesen", () => {
  const parsed = parseAdcProgram(`${ADC_PROGRAM_START_CODE}\n/* unclosed`);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errorSource, "adc-program-runtime");
  assert.equal(parsed.errors[0].code, "ADC_PROGRAM_SYNTAX_ERROR");
});

test("analogRead im setup wird als Syntaxfehler abgewiesen", () => {
  const source = `int adcValue = 0;

void setup() {
  adcValue = analogRead(A0);
}

void loop() {
  adcValue = analogRead(A0);
}`;
  const parsed = parseAdcProgram(source);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.errorSource, "adc-program-runtime");
  assert.equal(parsed.errors[0].code, "ADC_PROGRAM_SYNTAX_ERROR");
});

test("pinMode im loop wird als Syntaxfehler abgewiesen", () => {
  const source = `int adcValue = 0;

void setup() {
  pinMode(A0, INPUT);
}

void loop() {
  pinMode(A0, INPUT);
}`;
  const parsed = parseAdcProgram(source);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.errorSource, "adc-program-runtime");
  assert.equal(parsed.errors[0].code, "ADC_PROGRAM_SYNTAX_ERROR");
});

test("ADC-Parameterfehler werden mit errorSource adc-quantizer weitergereicht", () => {
  const invalidReference = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 1 },
    referenceVoltageV: 0,
  });
  const invalidResolution = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 1 },
    resolutionBits: 0,
  });

  assert.equal(invalidReference.ok, false);
  assert.equal(invalidReference.errorSource, "adc-quantizer");
  assert.equal(invalidReference.errors[0].code, "ADC_REFERENCE_VOLTAGE_INVALID");
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.errorSource, "adc-quantizer");
  assert.equal(invalidResolution.errors[0].code, "ADC_RESOLUTION_BITS_INVALID");
});

test("quell- und anweisungslimits werden durchgesetzt", () => {
  const tooLong = "A".repeat(4097);
  const longSource = parseAdcProgram(tooLong);
  assert.equal(longSource.ok, false);
  assert.equal(longSource.errors[0].code, "ADC_PROGRAM_SOURCE_TOO_LARGE");

  const tooManyStatements = makeLongStatementProgram("adcValue = analogRead(A0);", 17);
  const parsed = parseAdcProgram(tooManyStatements);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "ADC_PROGRAM_STATEMENT_LIMIT_EXCEEDED");
});

test("Ergebnismodell und Versionen sind unveraenderlich", () => {
  const first = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 1.65 },
  });
  const second = executeAdcProgram({
    sourceFile: ADC_PROGRAM_START_CODE,
    analogInputs: { A0: 1.65 },
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.result, second.result);
  assert.deepEqual(first.result.modelVersions, {
    runtime: ADC_PROGRAM_RUNTIME_MODEL.modelVersion,
    adcQuantizer: "1.0.0",
  });
  assert.equal(Object.isFrozen(first.result), true);
  assert.equal(Object.isFrozen(first.result.adc), true);
  assert.equal(Object.isFrozen(first.result.variables), true);
  assert.equal(Object.isFrozen(first.result.pinModes), true);
  assert.equal(Object.isFrozen(first.result.modelVersions), true);
  assert.equal(Object.isFrozen(first.warnings), true);
});

test("ADC_PROGRAM_RUNTIME_MODEL ist tief unveraenderlich inkl. dependencies", () => {
  assert.equal(Object.isFrozen(ADC_PROGRAM_RUNTIME_MODEL), true);
  assert.equal(Object.isFrozen(ADC_PROGRAM_RUNTIME_MODEL.dependencies), true);
  assert.equal(typeof ADC_PROGRAM_RUNTIME_MODEL.dependencies.adcQuantizerModelId, "string");
  assert.equal(typeof ADC_PROGRAM_RUNTIME_MODEL.dependencies.adcQuantizerModelVersion, "string");

  assert.throws(
    () => {
      ADC_PROGRAM_RUNTIME_MODEL.dependencies.adcQuantizerModelId = "mutated";
    },
    {
      name: "TypeError",
    },
  );

  assert.equal(
    ADC_PROGRAM_RUNTIME_MODEL.dependencies.adcQuantizerModelId,
    "virtual-electronics-lab-idealized-adc-quantizer",
  );
});

test("Quellcode enthält keine verbotenen Laufzeit- oder Netzwerk-Abhängigkeiten", () => {
  const filePath = fileURLToPath(new URL("../../virtual-mcu/adc-program-runtime.mjs", import.meta.url));
  const source = fs.readFileSync(path.resolve(path.dirname(filePath), "adc-program-runtime.mjs"), "utf8");
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
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
  }
});
