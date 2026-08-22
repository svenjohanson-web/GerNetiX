import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_TYPES,
  ELAB_DS_001_START_CODE,
  ELAB_DS_002_PWM_START_CODE,
  createThroughputRuntime,
  parseThroughputProgram,
  runThroughputSimulation,
} from "./gpio-led-throughput-runtime.js";

function withLoop(loopSource) {
  return `void setup() {
  pinMode(5, OUTPUT);
}

void loop() {
${loopSource}
}`;
}

test("Schema: gültiger Startcode wird geparst", () => {
  const parsed = parseThroughputProgram(ELAB_DS_001_START_CODE);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.program.setup.length, 2);
  assert.equal(parsed.program.loop.length, 0);
});

test("HIGH: Ergebnisberechnung ist deterministisch und korrekt", () => {
  const runtime = createThroughputRuntime({ sourceFile: ELAB_DS_001_START_CODE });
  const start = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const { measurement } = runtime.getSnapshot();

  assert.equal(start.ok, true);
  assert.equal(measurement.gpio.logicLevel, "HIGH");
  assert.equal(measurement.gpio.voltageV, 3.3);
  assert.equal(measurement.branch.ledCurrentA, 0.003939394);
  assert.equal(measurement.led.state, "leuchtet");
  assert.deepEqual(measurement.warnings, []);
});

test("LOW: LED-Strom wird auf 0 A reduziert", () => {
  const lowSource = `void setup() {
  pinMode(5, OUTPUT);
}

void loop() {
  digitalWrite(5, LOW);
}`;
  const runtime = createThroughputRuntime({ sourceFile: lowSource });
  const result = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const { measurement } = runtime.getSnapshot();

  assert.equal(result.ok, true);
  assert.equal(measurement.gpio.logicLevel, "LOW");
  assert.equal(measurement.gpio.voltageV, 0);
  assert.equal(measurement.branch.ledCurrentA, 0);
  assert.equal(measurement.led.state, "aus");
});

test("fehlendes pinMode() führt zu GPIO_NOT_CONFIGURED_AS_OUTPUT", () => {
  const source = `void setup() {
}

void loop() {
  digitalWrite(5, HIGH);
}`;
  const runtime = createThroughputRuntime({ sourceFile: source });
  const result = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "GPIO_NOT_CONFIGURED_AS_OUTPUT");
});

test("falscher GPIO-Pin wird als nicht verfügbar abgelehnt", () => {
  const source = withLoop("  digitalWrite(4, HIGH);");
  const runtime = createThroughputRuntime({ sourceFile: source });
  const result = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "GPIO_PIN_NOT_AVAILABLE");
});

test("Syntaxfehler wird als PROGRAM_SYNTAX_ERROR zurückgegeben", () => {
  const source = `void setup() {
  pinMode(5, OUTPUT);
}

void loop() {
  digitalWrite(5, HIGH)
}`;
  const parsed = parseThroughputProgram(source);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "PROGRAM_SYNTAX_ERROR");
});

test("nicht geschlossener Blockkommentar wird als Syntaxfehler abgelehnt", () => {
  const parsed = parseThroughputProgram(`${ELAB_DS_001_START_CODE}\n/* offen`);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "PROGRAM_SYNTAX_ERROR");
  assert.match(parsed.errors[0].message, /Blockkommentar/);
});

test("Quelle > 4.096 Zeichen wird als SOURCE_TOO_LARGE rejected", () => {
  const source = "A".repeat(4097);
  const parsed = parseThroughputProgram(source);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "SOURCE_TOO_LARGE");
});

test("mehr als 32 Statements werden rejected", () => {
  const manyWrites = Array.from({ length: 33 }, () => "  digitalWrite(5, HIGH);").join("\n");
  const source = `void setup() {
  pinMode(5, OUTPUT);
}

void loop() {
${manyWrites}
}`;
  const parsed = parseThroughputProgram(source);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "PROGRAM_STATEMENT_LIMIT_EXCEEDED");
});

test("Warnungsschwellen werden sauber unterschieden", () => {
  const medium = runThroughputSimulation({
    sourceFile: ELAB_DS_001_START_CODE,
    modelValues: { resistorOhm: 100 },
  });
  const high = runThroughputSimulation({
    sourceFile: ELAB_DS_001_START_CODE,
    modelValues: { resistorOhm: 50 },
  });

  assert.equal(medium.ok, true);
  assert.deepEqual(medium.measurement.warnings, ["GPIO_SOURCE_CURRENT_EXCEEDED"]);
  assert.equal(high.ok, true);
  assert.deepEqual(high.measurement.warnings, ["GPIO_SOURCE_CURRENT_EXCEEDED", "LED_CURRENT_EXCEEDED"]);
});

test("LOW erzeugt auch mit kleinem Widerstand keine Überstromwarnung", () => {
  const lowSource = withLoop("  digitalWrite(5, LOW);");
  const result = runThroughputSimulation({
    sourceFile: lowSource,
    modelValues: { resistorOhm: 50 },
  });

  assert.equal(result.ok, true);
  assert.equal(result.measurement.branch.ledCurrentA, 0);
  assert.deepEqual(result.measurement.warnings, []);
});

test("Command-Pfad ist stabil: Update -> Start -> Start (Replay) -> Reset", () => {
  const runtime = createThroughputRuntime({ sourceFile: ELAB_DS_001_START_CODE });

  assert.equal(runtime.dispatch({ type: COMMAND_TYPES.StartSimulation }).ok, true);
  const first = runtime.getSnapshot().measurement;

  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: withLoop("  digitalWrite(5, LOW);"),
  });
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const low = runtime.getSnapshot().measurement;

  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: ELAB_DS_001_START_CODE,
  });
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const replay = runtime.getSnapshot().measurement;

  const reset = runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });

  assert.equal(replay.simulationRunId, first.simulationRunId);
  assert.equal(replay.branch.ledCurrentA, first.branch.ledCurrentA);
  assert.equal(low.gpio.logicLevel, "LOW");
  assert.equal(reset.ok, true);
  assert.equal(runtime.getSnapshot().measurement, null);
  assert.equal(runtime.getSnapshot().sourceFile, ELAB_DS_001_START_CODE);
});

test("LoadLabExample setzt PWM als neue Reset-Basis", () => {
  const runtime = createThroughputRuntime();
  runtime.dispatch({ type: COMMAND_TYPES.LoadLabExample, exampleId: "gpio-pwm-led" });
  runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: withLoop("  digitalWrite(5, LOW);") });
  const reset = runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });

  assert.equal(reset.ok, true);
  assert.equal(reset.sourceFile, ELAB_DS_002_PWM_START_CODE);
  assert.equal(runtime.getSnapshot().labProject.controller.sourceFile, ELAB_DS_002_PWM_START_CODE);
});

test("LabProject enthält den vollständigen kontrollierten Ausgangszustand", () => {
  const runtime = createThroughputRuntime();
  const first = runtime.getSnapshot();

  assert.equal(first.labProject.schemaVersion, "1.0.0");
  assert.equal(first.labProject.metadata.kind, "virtual-electronics-lab-project");
  assert.equal(first.labProject.circuit.controller.gpioPin, 5);
  assert.equal(first.labProject.controller.sourceFile, ELAB_DS_001_START_CODE);
  assert.equal(first.labProject.simulation.modelVersions.electrical, "gpio-led-ideal-v1");

  first.labProject.instruments.instances["scope-1"].channels.ch1.tipConnection = "gpio-5";
  assert.equal(runtime.getSnapshot().scope.tipConnection, null);
});

test("PWM: gültiger 002-Beispielcode wird geparst", () => {
  const parsed = parseThroughputProgram(ELAB_DS_002_PWM_START_CODE);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.program.setup.length, 3);
  assert.equal(parsed.program.loop.length, 0);
});

test("PWM: Konfiguration vor pinMode wird kontrolliert abgelehnt", () => {
  const source = `void setup() {
  pwmConfigure(5, 1000, 25);
}

void loop() {
}`;
  const result = runThroughputSimulation({ sourceFile: source });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "PWM_PIN_NOT_CONFIGURED_AS_OUTPUT");
});

test("PWM: alle PWM-Befehle melden für einen falschen Pin PWM_PIN_NOT_AVAILABLE", () => {
  const commands = [
    "pwmConfigure(4, 1000, 25);",
    "pwmStart(4);",
    "pwmStop(4);",
  ];

  for (const command of commands) {
    const source = `void setup() {
  pinMode(5, OUTPUT);
  ${command}
}

void loop() {
}`;
    const result = runThroughputSimulation({ sourceFile: source });
    assert.equal(result.ok, false, command);
    assert.equal(result.errors[0].code, "PWM_PIN_NOT_AVAILABLE", command);
  }
});

test("PWM: ungültige numerische Literale werden mit PWM_NUMERIC_ARGUMENT_REQUIRED abgelehnt", () => {
  const source = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, abc, 25);
  pwmStart(5);
}

void loop() {
}`;
  const parsed = parseThroughputProgram(source);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "PWM_NUMERIC_ARGUMENT_REQUIRED");
});

test("PWM: Frequenzbereich wird auf 1 bis 100.000 Hz begrenzt", () => {
  const tooLow = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 0, 25);
  pwmStart(5);
}

void loop() {
}`;
  const tooHigh = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 100001, 25);
  pwmStart(5);
}

void loop() {
}`;

  assert.equal(parseThroughputProgram(tooLow).ok, false);
  assert.equal(parseThroughputProgram(tooLow).errors[0].code, "PWM_FREQUENCY_OUT_OF_RANGE");
  assert.equal(parseThroughputProgram(tooHigh).ok, false);
  assert.equal(parseThroughputProgram(tooHigh).errors[0].code, "PWM_FREQUENCY_OUT_OF_RANGE");
});

test("PWM: Tastgrad wird auf 0 bis 100 Prozent begrenzt", () => {
  const tooLow = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, -1);
  pwmStart(5);
}

void loop() {
}`;
  const tooHigh = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 101);
  pwmStart(5);
}

void loop() {
}`;

  assert.equal(parseThroughputProgram(tooLow).ok, false);
  assert.equal(parseThroughputProgram(tooLow).errors[0].code, "PWM_DUTY_CYCLE_OUT_OF_RANGE");
  assert.equal(parseThroughputProgram(tooHigh).ok, false);
  assert.equal(parseThroughputProgram(tooHigh).errors[0].code, "PWM_DUTY_CYCLE_OUT_OF_RANGE");
});

test("Virtual-MCU: 1.000 Hz, 25 Prozent erzeugen 4 Perioden inklusive Zeitflanken", () => {
  const measurement = runThroughputSimulation({ sourceFile: ELAB_DS_002_PWM_START_CODE }).measurement;

  assert.equal(measurement.pwm.frequencyHz, 1000);
  assert.equal(measurement.pwm.running, true);
  assert.equal(measurement.pwm.period, 1000);
  assert.equal(measurement.pwm.highDuration, 250);
  assert.equal(measurement.pwm.lowDuration, 750);
  assert.equal(measurement.simulationDuration, 4000);
  assert.equal(measurement.trace.length, 9);
  assert.equal(measurement.led.state, "pulst mit 1,00 kHz · mittlerer Tastgrad 25,0 %");
  assert.deepEqual(
    measurement.trace.map((entry) => entry.time),
    [0, 250, 1000, 1250, 2000, 2250, 3000, 3250, 4000]
  );
  assert.deepEqual(
    measurement.trace.map((entry) => entry.logicLevel),
    ["HIGH", "LOW", "HIGH", "LOW", "HIGH", "LOW", "HIGH", "LOW", "LOW"]
  );
  assert.equal(measurement.led.highCurrentA, 0.003939394);
  assert.equal(measurement.led.meanCurrentA, 0.000984848);
});

test("Virtual-MCU: 50 Prozent Duty erzeugt 500/500 µs und 1,97 mA Mittelstrom", () => {
  const source = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 50);
  pwmStart(5);
}

void loop() {
}`;
  const measurement = runThroughputSimulation({ sourceFile: source }).measurement;

  assert.equal(measurement.pwm.highDuration, 500);
  assert.equal(measurement.pwm.lowDuration, 500);
  assert.equal(measurement.led.meanCurrentA, 0.001969697);
  assert.equal(measurement.trace.length, 9);
});

test("Virtual-MCU: 0 und 100 Prozent sind stabil ohne künstliche Flanken", () => {
  const zeroDuty = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 0);
  pwmStart(5);
}

void loop() {
}`;
  const fullDuty = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 100);
  pwmStart(5);
}

void loop() {
}`;

  const zeroMeasurement = runThroughputSimulation({ sourceFile: zeroDuty }).measurement;
  const fullMeasurement = runThroughputSimulation({ sourceFile: fullDuty }).measurement;

  assert.equal(zeroMeasurement.pwm.highDuration, 0);
  assert.equal(zeroMeasurement.pwm.lowDuration, 1000);
  assert.deepEqual(
    zeroMeasurement.trace.map((entry) => entry.logicLevel),
    ["LOW", "LOW"]
  );

  assert.equal(fullMeasurement.pwm.highDuration, 1000);
  assert.equal(fullMeasurement.pwm.lowDuration, 0);
  assert.deepEqual(
    fullMeasurement.trace.map((entry) => entry.logicLevel),
    ["HIGH", "HIGH"]
  );
});

test("Virtual-MCU: Frequenzgrenzen 1 Hz und 100.000 Hz werden sauber simuliert", () => {
  const lowFrequency = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1, 25);
  pwmStart(5);
}

void loop() {
}`;
  const highFrequency = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 100000, 25);
  pwmStart(5);
}

void loop() {
}`;

  const lowMeasurement = runThroughputSimulation({ sourceFile: lowFrequency }).measurement;
  const highMeasurement = runThroughputSimulation({ sourceFile: highFrequency }).measurement;

  assert.equal(lowMeasurement.pwm.period, 1000000);
  assert.equal(lowMeasurement.simulationDuration, 4000000);
  assert.equal(highMeasurement.pwm.period, 10);
  assert.equal(highMeasurement.simulationDuration, 40);
});

test("Virtual-MCU: pwmConfigure nach Start wird durch erneutes pwmStart deterministisch übernommen", () => {
  const source = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 25);
  pwmStart(5);
  pwmConfigure(5, 2000, 50);
  pwmStart(5);
}

void loop() {
}`;
  const measurement = runThroughputSimulation({ sourceFile: source }).measurement;

  assert.equal(measurement.pwm.frequencyHz, 2000);
  assert.equal(measurement.pwm.dutyPercent, 50);
  assert.equal(measurement.pwm.highDuration, 250);
  assert.equal(measurement.pwm.lowDuration, 250);
});

test("Virtual-MCU: pwmStop beendet PWM und setzt GPIO auf LOW", () => {
  const source = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 25);
  pwmStart(5);
}

void loop() {
  pwmStop(5);
}`;
  const measurement = runThroughputSimulation({ sourceFile: source }).measurement;

  assert.equal(measurement.gpio.logicLevel, "LOW");
  assert.equal(measurement.trace.length, 1);
  assert.equal(measurement.trace[0].logicLevel, "LOW");
  assert.equal(measurement.trace[0].ledCurrentA, 0);
});

test("Virtual-MCU: digitalWrite nach aktiver PWM beendet die PWM deterministisch", () => {
  const source = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 25);
  pwmStart(5);
}

void loop() {
  digitalWrite(5, HIGH);
}`;
  const measurement = runThroughputSimulation({ sourceFile: source }).measurement;

  assert.equal(measurement.gpio.logicLevel, "HIGH");
  assert.equal(measurement.pwm.period, null);
  assert.equal(measurement.trace.length, 1);
  assert.equal(measurement.trace[0].logicLevel, "HIGH");
  assert.equal(measurement.led.state, "leuchtet");
});

test("Virtual-MCU: Laufzeit-Trace und Mean-Strom sind deterministisch wiederholbar", () => {
  const runtime = createThroughputRuntime({ sourceFile: ELAB_DS_002_PWM_START_CODE });

  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const first = runtime.getSnapshot().measurement;
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const second = runtime.getSnapshot().measurement;

  assert.equal(first.simulationRunId, second.simulationRunId);
  assert.deepEqual(first.trace, second.trace);
  assert.equal(first.led.meanCurrentA, second.led.meanCurrentA);
});

test("WARNUNG: PWM-Überstrombewertung basiert auf dem HIGH-Strom", () => {
  const medium = runThroughputSimulation({
    sourceFile: ELAB_DS_002_PWM_START_CODE,
    modelValues: { resistorOhm: 100 },
  });
  const high = runThroughputSimulation({
    sourceFile: ELAB_DS_002_PWM_START_CODE,
    modelValues: { resistorOhm: 50 },
  });

  assert.deepEqual(medium.measurement.warnings, ["GPIO_SOURCE_CURRENT_EXCEEDED"]);
  assert.equal(medium.measurement.led.highCurrentA, 0.013);
  assert.equal(medium.measurement.led.meanCurrentA, 0.00325);

  assert.deepEqual(high.measurement.warnings, ["GPIO_SOURCE_CURRENT_EXCEEDED", "LED_CURRENT_EXCEEDED"]);
  assert.equal(high.measurement.led.highCurrentA, 0.026);
  assert.equal(high.measurement.led.meanCurrentA, 0.0065);
});

test("Measurement enthält virtuelle Zeitbasis, Trace-Punkte und Modellversionen", () => {
  const measurement = runThroughputSimulation({ sourceFile: ELAB_DS_002_PWM_START_CODE }).measurement;

  assert.equal(measurement.virtualTimeBase, "1e-9 us deterministic rounded trace");
  assert.equal(measurement.virtualTime, 0);
  assert.equal(measurement.modelVersions.model, "virtual-generic");
  assert.equal(measurement.pwm.pin, 5);
  assert.equal(measurement.pwm.phaseOrigin, 0);
  assert.deepEqual(Object.keys(measurement.trace[0]), ["time", "logicLevel", "gpioVoltageV", "ledCurrentA"]);
});

function connectProbe(runtime, lead, pointId) {
  return runtime.dispatch({
    type: COMMAND_TYPES.AttachProbe,
    instrumentId: "scope-1",
    channelId: "ch1",
    lead,
    measurementPointId: pointId,
  });
}

function detachProbe(runtime, lead) {
  return runtime.dispatch({
    type: COMMAND_TYPES.DetachProbe,
    instrumentId: "scope-1",
    channelId: "ch1",
    lead,
  });
}

function scopeSnapshot(runtime) {
  return runtime.getSnapshot().scope;
}

function startWithConnectedScope(sourceFile) {
  const runtime = createThroughputRuntime({ sourceFile });
  const tip = connectProbe(runtime, "tip", "gpio-5");
  const reference = connectProbe(runtime, "reference", "gnd");
  assert.equal(tip.ok, true);
  assert.equal(reference.ok, true);
  const result = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(result.ok, true);
  return runtime;
}

test("DS-003: AttachProbe/DetachProbe funktionieren über Command-Pfad", () => {
  const runtime = createThroughputRuntime({ sourceFile: ELAB_DS_002_PWM_START_CODE });

  const attachTip = connectProbe(runtime, "tip", "gpio-5");
  const attachReference = connectProbe(runtime, "reference", "gnd");
  const detachTip = detachProbe(runtime, "tip");
  const detachReference = detachProbe(runtime, "reference");

  assert.equal(attachTip.ok, true);
  assert.equal(attachReference.ok, true);
  assert.equal(detachTip.ok, true);
  assert.equal(detachReference.ok, true);
});

test("DS-003: Probe-Kommandos melden die erwarteten Fehlercodes bei ungültiger Eingabe", () => {
  const runtime = createThroughputRuntime({ sourceFile: ELAB_DS_002_PWM_START_CODE });

  const missingInstrument = runtime.dispatch({
    type: COMMAND_TYPES.AttachProbe,
    instrumentId: "scope-9",
    channelId: "ch1",
    lead: "tip",
    measurementPointId: "gpio-5",
  });
  const invalidChannel = runtime.dispatch({
    type: COMMAND_TYPES.AttachProbe,
    instrumentId: "scope-1",
    channelId: "ch9",
    lead: "tip",
    measurementPointId: "gpio-5",
  });
  const unsupportedLead = runtime.dispatch({
    type: COMMAND_TYPES.AttachProbe,
    instrumentId: "scope-1",
    channelId: "ch1",
    lead: "wrong",
    measurementPointId: "gpio-5",
  });
  const missingPoint = runtime.dispatch({
    type: COMMAND_TYPES.AttachProbe,
    instrumentId: "scope-1",
    channelId: "ch1",
    lead: "tip",
    measurementPointId: "vcc",
  });

  assert.equal(missingInstrument.ok, false);
  assert.equal(missingInstrument.errors[0].code, "INSTRUMENT_NOT_FOUND");
  assert.equal(invalidChannel.ok, false);
  assert.equal(invalidChannel.errors[0].code, "INSTRUMENT_CHANNEL_NOT_FOUND");
  assert.equal(unsupportedLead.ok, false);
  assert.equal(unsupportedLead.errors[0].code, "PROBE_LEAD_NOT_SUPPORTED");
  assert.equal(missingPoint.ok, false);
  assert.equal(missingPoint.errors[0].code, "MEASUREMENT_POINT_NOT_FOUND");
});

test("DS-003: 1 kHz / 25 Prozent – korrekte Scopewerte und Messbusstruktur", () => {
  const runtime = startWithConnectedScope(ELAB_DS_002_PWM_START_CODE);
  const scope = scopeSnapshot(runtime);

  assert.equal(scope.minimumVoltage, 0);
  assert.equal(scope.maximumVoltage, 3.3);
  assert.equal(scope.peakToPeakVoltage, 3.3);
  assert.equal(scope.frequencyHz, 1000);
  assert.equal(scope.periodUs, 1000);
  assert.equal(scope.dutyCyclePercent, 25);
  assert.equal(scope.triggerTimeUs, 1000);
  assert.equal(scope.modelVersions.oscilloscope, "oscilloscope-shared-trace-v1");
  assert.equal(scope.measurementBus.quantity, "voltage");
  assert.equal(scope.measurementBus.unit, "V");
  assert.equal(scope.measurementBus.measurementPointId, "gpio-5");
  assert.equal(scope.measurementBus.referencePointId, "gnd");
  assert.equal(scope.measurementBus.trace.length, runtime.getSnapshot().measurement.trace.length);
  assert.deepEqual(scope.statusCodes, []);
});

test("DS-003: 2 kHz / 50 Prozent – Trigger- und Periodenwerte aus dem Trace", () => {
  const source = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 2000, 50);
  pwmStart(5);
}

void loop() {
}`;
  const runtime = startWithConnectedScope(source);
  const scope = scopeSnapshot(runtime);

  assert.equal(scope.frequencyHz, 2000);
  assert.equal(scope.periodUs, 500);
  assert.equal(scope.dutyCyclePercent, 50);
  assert.equal(scope.triggerTimeUs, 500);
});

test("DS-003: 0 % und 100 % Tastgrad führen zu keinem periodischen Messwert", () => {
  const zeroSource = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 0);
  pwmStart(5);
}

void loop() {
}`;
  const fullSource = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 100);
  pwmStart(5);
}

void loop() {
}`;

  const zero = scopeSnapshot(startWithConnectedScope(zeroSource));
  const full = scopeSnapshot(startWithConnectedScope(fullSource));

  assert.equal(zero.frequencyHz, null);
  assert.equal(zero.periodUs, null);
  assert.equal(zero.dutyCyclePercent, null);
  assert.equal(full.frequencyHz, null);
  assert.equal(full.periodUs, null);
  assert.equal(full.dutyCyclePercent, null);
  assert.equal(zero.statusCodes.includes("OSCILLOSCOPE_PERIOD_NOT_MEASURABLE"), true);
  assert.equal(full.statusCodes.includes("OSCILLOSCOPE_TRIGGER_NOT_FOUND"), true);
});

test("DS-003: ohne Verbindungen werden Tip/Reference-Status gesetzt; mit Trace nicht vorhanden wird Status gesetzt", () => {
  const runtime = createThroughputRuntime({ sourceFile: ELAB_DS_002_PWM_START_CODE });
  const missingTrace = scopeSnapshot(runtime);
  assert.equal(missingTrace.statusCodes.includes("MEASUREMENT_TRACE_NOT_AVAILABLE"), true);

  const result = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(result.ok, true);
  const afterStartNoConnection = scopeSnapshot(runtime);
  assert.equal(afterStartNoConnection.statusCodes.includes("PROBE_TIP_NOT_CONNECTED"), true);
  assert.equal(afterStartNoConnection.statusCodes.includes("PROBE_REFERENCE_NOT_CONNECTED"), true);

  assert.equal(connectProbe(runtime, "tip", "gpio-5").ok, true);
  const afterTipOnly = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const scopeTip = scopeSnapshot(runtime);
  assert.equal(afterTipOnly.ok, true);
  assert.equal(scopeTip.statusCodes.includes("PROBE_REFERENCE_NOT_CONNECTED"), true);

  assert.equal(connectProbe(runtime, "reference", "gnd").ok, true);
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const withBoth = scopeSnapshot(runtime);
  assert.equal(withBoth.statusCodes.includes("PROBE_TIP_NOT_CONNECTED"), false);
  assert.equal(withBoth.statusCodes.includes("PROBE_REFERENCE_NOT_CONNECTED"), false);
});

test("DS-003: Scope-Ergebnisse sind deterministisch bei Wiederholung", () => {
  const runtime = startWithConnectedScope(ELAB_DS_001_START_CODE);
  const first = scopeSnapshot(runtime);
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const second = scopeSnapshot(runtime);

  assert.deepEqual(first, second);
});

test("DS-003: Triggermessung nutzt den gemeinsamen Trace (keine künstlichen Formeln)", () => {
  const runtime = startWithConnectedScope(ELAB_DS_002_PWM_START_CODE);
  const scope = scopeSnapshot(runtime);
  const trace = runtime.getSnapshot().measurement.trace;

  assert.equal(scope.triggerTimeUs, 1000);
  assert.equal(scope.signalTrace.length, trace.length);
  assert.equal(scope.signalTrace[0].time, trace[0].time);
  assert.equal(scope.signalTrace[0].value, trace[0].gpioVoltageV - 0);
});
