import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMMAND_TYPES,
  createPt1000ThroughputRuntime,
} from "../../labs/pt1000-adc-throughput-runtime.mjs";
import {
  ADC_PROGRAM_RUNTIME_MODEL,
  ADC_PROGRAM_START_CODE,
} from "../../virtual-mcu/adc-program-runtime.mjs";
import {
  PT1000_ADC_DIVIDER_MODEL,
} from "../../learning-circuits/pt1000-adc-divider.mjs";
import { ADC_QUANTIZER_MODEL } from "../../peripherals/adc-quantizer.mjs";

const filePath = fileURLToPath(new URL("../../labs/pt1000-adc-throughput-runtime.mjs", import.meta.url));
const source = fs.readFileSync(filePath, "utf8");

function approximate(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

function expectFrozenDeep(snapshot, pathPrefix = "") {
  assert.equal(Object.isFrozen(snapshot), true);
  for (const key of Object.keys(snapshot)) {
    const value = snapshot[key];
    const fullPath = `${pathPrefix}${pathPrefix ? "." : ""}${key}`;
    if (typeof value === "object" && value !== null) {
      assert.equal(Object.isFrozen(value), true, fullPath);
      expectFrozenDeep(value, fullPath);
    }
  }
}

function makeBadSource() {
  return `int adcValue = 0;

void setup() {
  pinMode(A0, INPUT)
}

void loop() {
  adcValue = analogRead(A0);
}`;
}

test("Defaultzustand und vollständiger LabProject-Vorläufer", () => {
  const runtime = createPt1000ThroughputRuntime({});
  const snapshot = runtime.getSnapshot();

  assert.equal(snapshot.sourceFile, ADC_PROGRAM_START_CODE);
  assert.equal(snapshot.temperatureC, 0);
  assert.equal(snapshot.error, null);
  assert.equal(snapshot.errorSource, null);
  assert.equal(snapshot.measurement, null);

  const labProject = snapshot.labProject;
  assert.equal(labProject.schemaVersion, "1.0.0");
  assert.equal(labProject.metadata.kind, "virtual-electronics-lab-project");
  assert.equal(labProject.environment.ambientTemperatureC, 0);
  assert.equal(labProject.environment.supplyVoltageV, 3.3);
  assert.equal(labProject.environment.referenceVoltageV, 3.3);
  assert.equal(labProject.environment.fixedResistanceOhm, 1000);
  assert.equal(labProject.environment.resolutionBits, 12);
  assert.equal(labProject.controller.sourceFile, ADC_PROGRAM_START_CODE);
  assert.equal(labProject.modelVersions.adcProgramRuntime, ADC_PROGRAM_RUNTIME_MODEL.modelVersion);
  assert.equal(labProject.modelVersions.pt1000AdcDivider, PT1000_ADC_DIVIDER_MODEL.modelVersion);
  assert.equal(labProject.modelVersions.adcQuantizer, ADC_QUANTIZER_MODEL.modelVersion);
});

test("0°C-Golden-Case liefert 1000 Ω, 1,65 V und ADC-Code 2048", () => {
  const runtime = createPt1000ThroughputRuntime({});
  const result = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });

  assert.equal(result.ok, true);
  const measurement = runtime.getSnapshot().measurement;

  assert.equal(measurement.adcValue, 2048);
  approximate(measurement.sensorResistanceOhm, 1000);
  approximate(measurement.senseVoltageV, 1.65);
  assert.equal(measurement.adcCode, 2048);
  assert.equal(measurement.sourceHash.length, 8);
  assert.deepEqual(measurement.warnings, []);
});

test("Monotone Messwerte bei -100, 0, 100 und 850 °C", () => {
  const runtime = createPt1000ThroughputRuntime({});
  const temperatures = [-100, 0, 100, 850];
  const senses = [];

  for (const temperatureC of temperatures) {
    const tempResult = runtime.dispatch({ type: COMMAND_TYPES.SetTemperature, temperatureC });
    assert.equal(tempResult.ok, true);
    const sim = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
    assert.equal(sim.ok, true);
    const measurement = runtime.getSnapshot().measurement;
    senses.push(measurement.senseVoltageV);
  }

  for (let index = 1; index < senses.length; index += 1) {
    assert.ok(senses[index] > senses[index - 1], `sensing not monotone at ${index}`);
  }
});

test("Temperaturänderung und Quellcodeänderung über Commands", () => {
  const runtime = createPt1000ThroughputRuntime({});
  const baseline = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(baseline.ok, true);
  const baselineMeasurement = runtime.getSnapshot().measurement;

  const updatedTemperature = runtime.dispatch({ type: COMMAND_TYPES.SetTemperature, temperatureC: 250 });
  assert.equal(updatedTemperature.ok, true);
  assert.equal(runtime.getSnapshot().temperatureC, 250);
  const changedTemperature = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(changedTemperature.ok, true);
  assert.equal(runtime.getSnapshot().measurement.temperatureC, 250);
  assert.notEqual(runtime.getSnapshot().measurement.adcValue, baselineMeasurement.adcValue);

  const updatedSource = runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: `${ADC_PROGRAM_START_CODE}\n// Command test comment`,
  });
  assert.equal(updatedSource.ok, true);
  assert.equal(runtime.getSnapshot().sourceFile, `${ADC_PROGRAM_START_CODE}\n// Command test comment`);
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.notEqual(runtime.getSnapshot().measurement.sourceHash, baselineMeasurement.sourceHash);
});

test("Syntaxfehler im ADC-Programm wird mit Fehlerherkunft zurückgegeben", () => {
  const runtime = createPt1000ThroughputRuntime({});
  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: makeBadSource(),
  });

  const start = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const snapshot = runtime.getSnapshot();

  assert.equal(start.ok, false);
  assert.equal(start.errorSource, "adc-program-runtime");
  assert.equal(snapshot.errorSource, "adc-program-runtime");
  assert.equal(snapshot.error[0].code, "ADC_PROGRAM_SYNTAX_ERROR");
});

test("Reset setzt Temperatur, Startcode, Ergebnis und Fehler zurück", () => {
  const invalidSource = makeBadSource();
  const runtime = createPt1000ThroughputRuntime({ sourceFile: invalidSource, temperatureC: 120 });
  const start = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(start.ok, false);

  const reset = runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
  const snapshot = runtime.getSnapshot();

  assert.equal(reset.ok, true);
  assert.equal(snapshot.temperatureC, 0);
  assert.equal(snapshot.sourceFile, ADC_PROGRAM_START_CODE);
  assert.equal(snapshot.measurement, null);
  assert.equal(snapshot.error, null);
  assert.equal(snapshot.errorSource, null);
  assert.equal(snapshot.labProject.controller.sourceFile, ADC_PROGRAM_START_CODE);
  assert.equal(snapshot.labProject.environment.ambientTemperatureC, 0);
});

test("Deterministisches Wiederholungsverhalten ohne Seiteneffekte", () => {
  const runtime = createPt1000ThroughputRuntime({});
  const firstRun = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(firstRun.ok, true);

  const before = runtime.getSnapshot();
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const after = runtime.getSnapshot();

  assert.equal(before.sourceFile, after.sourceFile);
  assert.equal(before.temperatureC, after.temperatureC);
  assert.deepEqual(before.measurement, after.measurement);
  assert.equal(firstRun.ok, true);
});

test("GetSnapshot ist defensiv, tief unveränderlich und unverbunden", () => {
  const runtime = createPt1000ThroughputRuntime({});
  const before = runtime.getSnapshot();
  const during = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(during.ok, true);

  const snapshot = runtime.getSnapshot();
  expectFrozenDeep(snapshot);

  assert.throws(
    () => {
      snapshot.measurement.sensorResistanceOhm = 1;
    },
    { name: "TypeError" },
  );
  assert.throws(
    () => {
      snapshot.labProject.controller.sourceFile = "x";
    },
    { name: "TypeError" },
  );
  assert.equal(before.measurement, null);
  assert.equal(before.labProject.controller.sourceFile, ADC_PROGRAM_START_CODE);
});

test("SetTemperature akzeptiert keine ungültigen Werte, PT1000-Fehler bleiben unverändert", () => {
  const runtime = createPt1000ThroughputRuntime({});

  const invalidCommand = runtime.dispatch({ type: COMMAND_TYPES.SetTemperature, temperatureC: Infinity });
  assert.equal(invalidCommand.ok, false);
  assert.equal(invalidCommand.errors[0].code, "PT1000_RUNTIME_COMMAND_INVALID");

  const outOfRange = runtime.dispatch({ type: COMMAND_TYPES.SetTemperature, temperatureC: 900 });
  assert.equal(outOfRange.ok, false);
  assert.equal(outOfRange.errorSource, "pt1000");
  assert.equal(outOfRange.errors[0].code, "PT1000_TEMPERATURE_OUT_OF_RANGE");
  assert.equal(runtime.getSnapshot().temperatureC, 0);
});

test("Mutationen an fehlerhaftem SetTemperature-Return ändern keinen Zustand", () => {
  const runtime = createPt1000ThroughputRuntime({});

  const invalid = runtime.dispatch({ type: COMMAND_TYPES.SetTemperature, temperatureC: 900 });
  const snapshotBefore = runtime.getSnapshot();

  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, "PT1000_TEMPERATURE_OUT_OF_RANGE");
  assert.equal(snapshotBefore.error[0].code, "PT1000_TEMPERATURE_OUT_OF_RANGE");

  invalid.errors[0].code = "MUTATED_BY_RETURN";

  const snapshotAfter = runtime.getSnapshot();
  assert.equal(snapshotAfter.error[0].code, "PT1000_TEMPERATURE_OUT_OF_RANGE");
  assert.notEqual(invalid.errors[0].code, snapshotAfter.error[0].code);
  const secondInvalid = runtime.dispatch({ type: COMMAND_TYPES.SetTemperature, temperatureC: 900 });
  assert.equal(secondInvalid.ok, false);
  assert.equal(secondInvalid.errors[0].code, "PT1000_TEMPERATURE_OUT_OF_RANGE");
  assert.equal(runtime.getSnapshot().error[0].code, "PT1000_TEMPERATURE_OUT_OF_RANGE");
});

test("Unbekannte oder ungültige Commands werden korrekt abgefangen", () => {
  const runtime = createPt1000ThroughputRuntime({});

  const missingType = runtime.dispatch(null);
  assert.equal(missingType.ok, false);
  assert.equal(missingType.errors[0].code, "PT1000_RUNTIME_COMMAND_INVALID");

  const unknownType = runtime.dispatch({ type: "Nope" });
  assert.equal(unknownType.ok, false);
  assert.equal(unknownType.errors[0].code, "PT1000_RUNTIME_COMMAND_NOT_SUPPORTED");

  const missingPayload = runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile });
  assert.equal(missingPayload.ok, false);
  assert.equal(missingPayload.errors[0].code, "PT1000_RUNTIME_COMMAND_INVALID");
});

test("Mutationen an Fehlern nach fehlgeschlagener Simulation bleiben vom Snapshot getrennt", () => {
  const runtime = createPt1000ThroughputRuntime({});
  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: makeBadSource(),
  });

  const simulation = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const snapshotBefore = runtime.getSnapshot();

  assert.equal(simulation.ok, false);
  assert.equal(simulation.errors[0].code, "ADC_PROGRAM_SYNTAX_ERROR");
  assert.equal(snapshotBefore.error[0].code, "ADC_PROGRAM_SYNTAX_ERROR");

  simulation.errors[0].code = "MUTATED_BY_RETURN";

  const snapshotAfter = runtime.getSnapshot();
  assert.equal(snapshotAfter.error[0].code, "ADC_PROGRAM_SYNTAX_ERROR");
  assert.notEqual(simulation.errors[0].code, snapshotAfter.error[0].code);
});

test("No-Forbidden-Runtime-Rules in Runtime-Datei", () => {
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
