import assert from "node:assert/strict";
import test from "node:test";

import {
  LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL,
  LED_CURRENT_CONTROL_PROGRAM_START_CODE,
  parseLedCurrentControlProgram,
  runLedCurrentControlProgram,
} from "../../virtual-mcu/led-current-control-program-runtime.mjs";

function replace(source, from, to) {
  return source.replace(from, to);
}

test("LED-002: Modell nennt Stromrücklesung und feste Laufzeitgrenzen", () => {
  assert.equal(Object.isFrozen(LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL), true);
  assert.equal(LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL.dependencies.currentSenseModelId, "virtual-electronics-lab-idealized-led-current-sense");
  assert.equal(LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL.limits.maxControlSteps, 64);
  assert.equal(LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL.limits.controlStepUs, 1000);
});

test("LED-002: Startcode wird als enger Quellcodevertrag geparst", () => {
  const parsed = parseLedCurrentControlProgram(LED_CURRENT_CONTROL_PROGRAM_START_CODE);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.program, {
    targetCurrentA: 0.002,
    proportionalGain: 10000,
    controlSteps: 16,
    initialDutyPercent: 0,
  });
});

test("LED-002: Programm liest ADC und nähert sich deterministisch dem Sollstrom", () => {
  const first = runLedCurrentControlProgram();
  const second = runLedCurrentControlProgram();
  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.equal(first.result.trace.length, 16);
  assert.equal(first.result.trace[0].adcCode, 0);
  assert.ok(first.result.finalDutyPercent > 35 && first.result.finalDutyPercent < 65);
  assert.ok(first.result.finalMeasuredCurrentA > 0.001 && first.result.finalMeasuredCurrentA < 0.003);
  assert.equal(first.result.simulationDurationUs, 16000);
});

test("LED-002: PWM ändert sich ausschließlich als Ergebnis der Programmschritte", () => {
  const result = runLedCurrentControlProgram();
  assert.equal(result.ok, true);
  for (let index = 1; index < result.result.trace.length; index += 1) {
    assert.equal(result.result.trace[index].dutyPercent, result.result.trace[index - 1].nextDutyPercent);
  }
});

test("LED-002: Sollwert, Verstärkung, Schritte und Start-Tastgrad sind hart begrenzt", () => {
  const target = parseLedCurrentControlProgram(replace(LED_CURRENT_CONTROL_PROGRAM_START_CODE, "0.002", "0.2"));
  const gain = parseLedCurrentControlProgram(replace(LED_CURRENT_CONTROL_PROGRAM_START_CODE, "10000.0", "100001"));
  const steps = parseLedCurrentControlProgram(replace(LED_CURRENT_CONTROL_PROGRAM_START_CODE, "16", "65"));
  const duty = parseLedCurrentControlProgram(replace(
    LED_CURRENT_CONTROL_PROGRAM_START_CODE,
    "float pwmDutyPercent = 0.0;",
    "float pwmDutyPercent = 101.0;",
  ));
  assert.equal(target.errors[0].code, "LED_CONTROL_TARGET_OUT_OF_RANGE");
  assert.equal(gain.errors[0].code, "LED_CONTROL_GAIN_OUT_OF_RANGE");
  assert.equal(steps.errors[0].code, "LED_CONTROL_STEP_LIMIT_EXCEEDED");
  assert.equal(duty.errors[0].code, "LED_CONTROL_INITIAL_DUTY_OUT_OF_RANGE");
});

test("LED-002: abweichende Befehle werden nicht als allgemeines C++ ausgeführt", () => {
  const source = replace(LED_CURRENT_CONTROL_PROGRAM_START_CODE, "analogRead(A0)", "analogRead(A1)");
  const result = runLedCurrentControlProgram({ sourceFile: source });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "LED_CONTROL_PROGRAM_SYNTAX_ERROR");
  assert.equal(result.errors[0].line, 1);
  assert.equal(result.errors[0].column, 1);
});

test("LED-002: Sättigung und fehlende Konvergenz werden kontrolliert diagnostiziert", () => {
  const source = replace(
    replace(LED_CURRENT_CONTROL_PROGRAM_START_CODE, "0.002", "0.02"),
    "10000.0",
    "100000.0",
  );
  const result = runLedCurrentControlProgram({ sourceFile: source });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((entry) => entry.code === "LED_CONTROL_SATURATED"));
  assert.ok(result.warnings.some((entry) => entry.code === "LED_CONTROL_NOT_CONVERGED"));
});

test("LED-002: instabile Verstärkung wird über Vorzeichenwechsel erkannt", () => {
  const source = replace(LED_CURRENT_CONTROL_PROGRAM_START_CODE, "10000.0", "100000.0");
  const result = runLedCurrentControlProgram({ sourceFile: source });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((entry) => entry.code === "LED_CONTROL_UNSTABLE"));
});

test("LED-002: Quelle enthält keine Wall-Clock-, Netzwerk- oder Persistenzpfade", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../../virtual-mcu/led-current-control-program-runtime.mjs", import.meta.url), "utf8"));
  for (const forbidden of ["Date.now", "setTimeout", "fetch(", "localStorage", "Math.random"]) {
    assert.equal(source.includes(forbidden), false, `forbidden token found: ${forbidden}`);
  }
});
