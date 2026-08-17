import {
  ELAB_DS_002_PWM_START_CODE,
  runThroughputSimulation,
} from "../labs/gpio-led-throughput-runtime.js";
import {
  LED_CURRENT_SENSE_MODEL,
  evaluateLedCurrentSense,
} from "../labs/led-current-sense.mjs";

const PWM_PIN = 5;
const PWM_FREQUENCY_HZ = 1_000;
const CONTROL_STEP_US = 1_000;
const SHUNT_RESISTANCE_OHM = 10;
const ADC_REFERENCE_VOLTAGE_V = 3.3;
const ADC_RESOLUTION_BITS = 12;
const MIN_TARGET_CURRENT_A = 0;
const MAX_TARGET_CURRENT_A = 0.02;
const MIN_PROPORTIONAL_GAIN = 0;
const MAX_PROPORTIONAL_GAIN = 100_000;
const MIN_CONTROL_STEPS = 1;
const MAX_CONTROL_STEPS = 64;
const MAX_SOURCE_LENGTH = 8_192;

export const LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-virtual-mcu-led-current-control-program-runtime",
  modelVersion: "1.0.0",
  architecture: "controlled-interpreter",
  inputQuantity: "arduino-source-code",
  outputQuantity: "virtual-time-led-current-control-trace",
  dependencies: Object.freeze({
    pwmLedStartCode: ELAB_DS_002_PWM_START_CODE,
    currentSenseModelId: LED_CURRENT_SENSE_MODEL.modelId,
    currentSenseModelVersion: LED_CURRENT_SENSE_MODEL.modelVersion,
  }),
  hardware: Object.freeze({
    pwmPin: PWM_PIN,
    adcPin: "A0",
    pwmFrequencyHz: PWM_FREQUENCY_HZ,
    shuntResistanceOhm: SHUNT_RESISTANCE_OHM,
    adcReferenceVoltageV: ADC_REFERENCE_VOLTAGE_V,
    adcResolutionBits: ADC_RESOLUTION_BITS,
  }),
  limits: Object.freeze({
    minTargetCurrentA: MIN_TARGET_CURRENT_A,
    maxTargetCurrentA: MAX_TARGET_CURRENT_A,
    minProportionalGain: MIN_PROPORTIONAL_GAIN,
    maxProportionalGain: MAX_PROPORTIONAL_GAIN,
    minControlSteps: MIN_CONTROL_STEPS,
    maxControlSteps: MAX_CONTROL_STEPS,
    maxSourceLength: MAX_SOURCE_LENGTH,
    controlStepUs: CONTROL_STEP_US,
    minDutyPercent: 0,
    maxDutyPercent: 100,
  }),
});

export const LED_CURRENT_CONTROL_PROGRAM_START_CODE = `const float targetCurrentA = 0.002;
const float proportionalGain = 10000.0;
const int controlSteps = 16;
float pwmDutyPercent = 0.0;

void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, pwmDutyPercent);
  pwmStart(5);
}

void loop() {
  int currentAdc = analogRead(A0);
  float measuredCurrentA = adcToCurrent(currentAdc);
  float errorA = targetCurrentA - measuredCurrentA;
  pwmDutyPercent = pwmDutyPercent + proportionalGain * errorA;
  pwmWrite(5, pwmDutyPercent);
  delayMicroseconds(1000);
}`;

const NUMBER_PATTERN = "([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)";
const PROGRAM_PATTERN = new RegExp(
  `^\\s*const\\s+float\\s+targetCurrentA\\s*=\\s*${NUMBER_PATTERN}\\s*;`
  + `\\s*const\\s+float\\s+proportionalGain\\s*=\\s*${NUMBER_PATTERN}\\s*;`
  + "\\s*const\\s+int\\s+controlSteps\\s*=\\s*(\\d+)\\s*;"
  + `\\s*float\\s+pwmDutyPercent\\s*=\\s*${NUMBER_PATTERN}\\s*;`
  + "\\s*void\\s+setup\\s*\\(\\s*\\)\\s*\\{"
  + "\\s*pinMode\\s*\\(\\s*5\\s*,\\s*OUTPUT\\s*\\)\\s*;"
  + "\\s*pwmConfigure\\s*\\(\\s*5\\s*,\\s*1000\\s*,\\s*pwmDutyPercent\\s*\\)\\s*;"
  + "\\s*pwmStart\\s*\\(\\s*5\\s*\\)\\s*;\\s*\\}"
  + "\\s*void\\s+loop\\s*\\(\\s*\\)\\s*\\{"
  + "\\s*int\\s+currentAdc\\s*=\\s*analogRead\\s*\\(\\s*A0\\s*\\)\\s*;"
  + "\\s*float\\s+measuredCurrentA\\s*=\\s*adcToCurrent\\s*\\(\\s*currentAdc\\s*\\)\\s*;"
  + "\\s*float\\s+errorA\\s*=\\s*targetCurrentA\\s*-\\s*measuredCurrentA\\s*;"
  + "\\s*pwmDutyPercent\\s*=\\s*pwmDutyPercent\\s*\\+\\s*proportionalGain\\s*\\*\\s*errorA\\s*;"
  + "\\s*pwmWrite\\s*\\(\\s*5\\s*,\\s*pwmDutyPercent\\s*\\)\\s*;"
  + "\\s*delayMicroseconds\\s*\\(\\s*1000\\s*\\)\\s*;\\s*\\}\\s*$",
);

function failure(code, message, field = "sourceFile") {
  return {
    ok: false,
    errors: [{ code, message, field, line: 1, column: 1 }],
    result: null,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finiteInRange(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function parseLedCurrentControlProgram(sourceFile) {
  const source = String(sourceFile ?? "").replace(/\r\n/g, "\n");
  if (source.length > MAX_SOURCE_LENGTH) {
    return failure("LED_CONTROL_SOURCE_TOO_LARGE", `Quellcode darf höchstens ${MAX_SOURCE_LENGTH} Zeichen enthalten.`);
  }

  const match = PROGRAM_PATTERN.exec(source);
  if (!match) {
    return failure(
      "LED_CONTROL_PROGRAM_SYNTAX_ERROR",
      "Nur der kontrollierte LED-Stromregelungs-Startcode mit änderbaren Zahlenwerten ist erlaubt.",
    );
  }

  const targetCurrentA = Number(match[1]);
  const proportionalGain = Number(match[2]);
  const controlSteps = Number(match[3]);
  const initialDutyPercent = Number(match[4]);

  if (!finiteInRange(targetCurrentA, MIN_TARGET_CURRENT_A, MAX_TARGET_CURRENT_A)) {
    return failure("LED_CONTROL_TARGET_OUT_OF_RANGE", `targetCurrentA muss zwischen ${MIN_TARGET_CURRENT_A} und ${MAX_TARGET_CURRENT_A} A liegen.`, "targetCurrentA");
  }
  if (!finiteInRange(proportionalGain, MIN_PROPORTIONAL_GAIN, MAX_PROPORTIONAL_GAIN)) {
    return failure("LED_CONTROL_GAIN_OUT_OF_RANGE", `proportionalGain muss zwischen ${MIN_PROPORTIONAL_GAIN} und ${MAX_PROPORTIONAL_GAIN} liegen.`, "proportionalGain");
  }
  if (!Number.isInteger(controlSteps) || controlSteps < MIN_CONTROL_STEPS || controlSteps > MAX_CONTROL_STEPS) {
    return failure("LED_CONTROL_STEP_LIMIT_EXCEEDED", `controlSteps muss zwischen ${MIN_CONTROL_STEPS} und ${MAX_CONTROL_STEPS} liegen.`, "controlSteps");
  }
  if (!finiteInRange(initialDutyPercent, 0, 100)) {
    return failure("LED_CONTROL_INITIAL_DUTY_OUT_OF_RANGE", "pwmDutyPercent muss zwischen 0 und 100 Prozent liegen.", "pwmDutyPercent");
  }

  return {
    ok: true,
    program: Object.freeze({ targetCurrentA, proportionalGain, controlSteps, initialDutyPercent }),
  };
}

function pwmSource(dutyPercent) {
  return `void setup() {
  pinMode(${PWM_PIN}, OUTPUT);
  pwmConfigure(${PWM_PIN}, ${PWM_FREQUENCY_HZ}, ${dutyPercent});
  pwmStart(${PWM_PIN});
}

void loop() {
}`;
}

function warning(code, message) {
  return { code, message };
}

export function runLedCurrentControlProgram({
  sourceFile = LED_CURRENT_CONTROL_PROGRAM_START_CODE,
  modelValues,
} = {}) {
  const parsed = parseLedCurrentControlProgram(sourceFile);
  if (!parsed.ok) return parsed;

  const { targetCurrentA, proportionalGain, controlSteps, initialDutyPercent } = parsed.program;
  let dutyPercent = initialDutyPercent;
  let saturationSeen = false;
  let errorSignChanges = 0;
  let previousErrorSign = 0;
  const trace = [];

  for (let step = 0; step < controlSteps; step += 1) {
    const electrical = runThroughputSimulation({ sourceFile: pwmSource(dutyPercent), modelValues });
    if (!electrical.ok) {
      return failure("LED_CONTROL_ELECTRICAL_MODEL_FAILED", electrical.errors?.[0]?.message || "Elektrisches LED-Modell fehlgeschlagen.");
    }

    const ledCurrentA = electrical.measurement.led.meanCurrentA;
    const sensed = evaluateLedCurrentSense({
      trace: [{ time: step * CONTROL_STEP_US, ledCurrentA }],
      shuntResistanceOhm: SHUNT_RESISTANCE_OHM,
      referenceVoltageV: ADC_REFERENCE_VOLTAGE_V,
      resolutionBits: ADC_RESOLUTION_BITS,
    });
    if (!sensed.ok) {
      return failure("LED_CONTROL_CURRENT_SENSE_FAILED", sensed.errors?.[0]?.message || "Stromrücklesung fehlgeschlagen.");
    }

    const sample = sensed.result.samples[0];
    const measuredCurrentA = sample.adcQuantizedVoltageV / SHUNT_RESISTANCE_OHM;
    const errorA = targetCurrentA - measuredCurrentA;
    const requestedDutyPercent = dutyPercent + (proportionalGain * errorA);
    const nextDutyPercent = Math.min(100, Math.max(0, requestedDutyPercent));
    if (nextDutyPercent !== requestedDutyPercent) saturationSeen = true;

    const errorSign = Math.sign(errorA);
    if (previousErrorSign && errorSign && errorSign !== previousErrorSign) errorSignChanges += 1;
    if (errorSign) previousErrorSign = errorSign;

    trace.push({
      step,
      virtualTimeUs: step * CONTROL_STEP_US,
      dutyPercent: Number(dutyPercent.toFixed(6)),
      ledCurrentA: Number(ledCurrentA.toFixed(9)),
      shuntVoltageV: sample.shuntVoltageV,
      adcCode: sample.adcCode,
      measuredCurrentA: Number(measuredCurrentA.toFixed(9)),
      errorA: Number(errorA.toFixed(9)),
      nextDutyPercent: Number(nextDutyPercent.toFixed(6)),
    });
    dutyPercent = nextDutyPercent;
  }

  const last = trace[trace.length - 1];
  const toleranceA = ADC_REFERENCE_VOLTAGE_V / ((2 ** ADC_RESOLUTION_BITS) - 1) / SHUNT_RESISTANCE_OHM;
  const warnings = [];
  if (saturationSeen) warnings.push(warning("LED_CONTROL_SATURATED", "Der berechnete PWM-Tastgrad wurde auf 0 bis 100 Prozent begrenzt."));
  if (errorSignChanges >= 4) warnings.push(warning("LED_CONTROL_UNSTABLE", "Der Regelfehler wechselt wiederholt das Vorzeichen."));
  if (Math.abs(last.errorA) > toleranceA) warnings.push(warning("LED_CONTROL_NOT_CONVERGED", "Der Sollstrom wurde innerhalb der begrenzten Regelschritte nicht erreicht."));

  return {
    ok: true,
    result: deepFreeze({
      modelId: LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL.modelId,
      modelVersion: LED_CURRENT_CONTROL_PROGRAM_RUNTIME_MODEL.modelVersion,
      sourceFile,
      targetCurrentA,
      proportionalGain,
      controlSteps,
      controlStepUs: CONTROL_STEP_US,
      simulationDurationUs: controlSteps * CONTROL_STEP_US,
      finalDutyPercent: Number(dutyPercent.toFixed(6)),
      finalMeasuredCurrentA: last.measuredCurrentA,
      trace,
      modelVersions: {
        currentSense: LED_CURRENT_SENSE_MODEL.modelVersion,
        electrical: "gpio-led-ideal-v1",
      },
    }),
    warnings: deepFreeze(warnings),
  };
}
