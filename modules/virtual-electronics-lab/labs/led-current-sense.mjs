import {
  ADC_QUANTIZER_MODEL,
  quantizeAdcSample,
} from "../peripherals/adc-quantizer.mjs";

const MIN_TRACE_SAMPLES = 1;
const MAX_TRACE_SAMPLES = 501;
const MIN_SHUNT_RESISTANCE_OHM = 0.001;
const MAX_SHUNT_RESISTANCE_OHM = 10;
const MAX_LED_CURRENT_A = 1;

export const LED_CURRENT_SENSE_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-idealized-led-current-sense",
  modelVersion: "1.0.0",
  architecture: "idealized",
  inputQuantity: "pwm-led-trace",
  outputQuantity: "shunt-voltage-and-adc-code-trace",
  shuntResistanceOhm: 1,
  adcReferenceVoltageV: 3.3,
  adcResolutionBits: 12,
  limits: Object.freeze({
    minTraceSamples: MIN_TRACE_SAMPLES,
    maxTraceSamples: MAX_TRACE_SAMPLES,
    minShuntResistanceOhm: MIN_SHUNT_RESISTANCE_OHM,
    maxShuntResistanceOhm: MAX_SHUNT_RESISTANCE_OHM,
    maxLedCurrentA: MAX_LED_CURRENT_A,
  }),
  dependencies: Object.freeze({
    adcQuantizerModelId: ADC_QUANTIZER_MODEL.modelId,
    adcQuantizerModelVersion: ADC_QUANTIZER_MODEL.modelVersion,
    sourceTraceQuantity: "ledCurrentA",
  }),
});

function error(code, message, field) {
  return { code, message, ...(field ? { field } : {}) };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateOptions({ trace, shuntResistanceOhm, referenceVoltageV, resolutionBits }) {
  if (!Array.isArray(trace) || trace.length < MIN_TRACE_SAMPLES || trace.length > MAX_TRACE_SAMPLES) {
    return error(
      "LED_CURRENT_SENSE_TRACE_INVALID",
      `trace muss zwischen ${MIN_TRACE_SAMPLES} und ${MAX_TRACE_SAMPLES} Samples enthalten.`,
      "trace",
    );
  }
  if (!isFiniteNumber(shuntResistanceOhm)
    || shuntResistanceOhm < MIN_SHUNT_RESISTANCE_OHM
    || shuntResistanceOhm > MAX_SHUNT_RESISTANCE_OHM) {
    return error(
      "LED_CURRENT_SENSE_SHUNT_OUT_OF_RANGE",
      `shuntResistanceOhm muss zwischen ${MIN_SHUNT_RESISTANCE_OHM} und ${MAX_SHUNT_RESISTANCE_OHM} Ω liegen.`,
      "shuntResistanceOhm",
    );
  }
  if (!isFiniteNumber(referenceVoltageV) || referenceVoltageV <= 0 || referenceVoltageV > ADC_QUANTIZER_MODEL.maxReferenceVoltageV) {
    return error(
      "LED_CURRENT_SENSE_REFERENCE_INVALID",
      "referenceVoltageV muss größer als 0 V und höchstens 100 V sein.",
      "referenceVoltageV",
    );
  }
  if (!Number.isInteger(resolutionBits)
    || resolutionBits < ADC_QUANTIZER_MODEL.minResolutionBits
    || resolutionBits > ADC_QUANTIZER_MODEL.maxResolutionBits) {
    return error(
      "LED_CURRENT_SENSE_RESOLUTION_INVALID",
      "resolutionBits muss zwischen 1 und 24 liegen.",
      "resolutionBits",
    );
  }
  return null;
}

function validateSample(sample, index) {
  if (!sample || !isFiniteNumber(sample.time) || sample.time < 0) {
    return error("LED_CURRENT_SENSE_SAMPLE_INVALID", `trace[${index}].time muss eine nichtnegative Zahl sein.`, `trace[${index}].time`);
  }
  if (!isFiniteNumber(sample.ledCurrentA) || sample.ledCurrentA < 0 || sample.ledCurrentA > MAX_LED_CURRENT_A) {
    return error(
      "LED_CURRENT_SENSE_CURRENT_OUT_OF_RANGE",
      `trace[${index}].ledCurrentA muss zwischen 0 und ${MAX_LED_CURRENT_A} A liegen.`,
      `trace[${index}].ledCurrentA`,
    );
  }
  return null;
}

/**
 * Maps the existing deterministic LED current trace through an ideal shunt
 * and the shared ADC quantizer. No UI, time source, state, or feedback loop.
 */
export function evaluateLedCurrentSense({
  trace,
  shuntResistanceOhm = LED_CURRENT_SENSE_MODEL.shuntResistanceOhm,
  referenceVoltageV = LED_CURRENT_SENSE_MODEL.adcReferenceVoltageV,
  resolutionBits = LED_CURRENT_SENSE_MODEL.adcResolutionBits,
} = {}) {
  const optionsError = validateOptions({ trace, shuntResistanceOhm, referenceVoltageV, resolutionBits });
  if (optionsError) {
    return {
      ok: false,
      errorSource: "led-current-sense",
      errors: [optionsError],
      modelId: LED_CURRENT_SENSE_MODEL.modelId,
      modelVersion: LED_CURRENT_SENSE_MODEL.modelVersion,
    };
  }

  const samples = [];
  const warnings = [];
  for (let index = 0; index < trace.length; index += 1) {
    const sampleError = validateSample(trace[index], index);
    if (sampleError) {
      return {
        ok: false,
        errorSource: "led-current-sense",
        errors: [sampleError],
        modelId: LED_CURRENT_SENSE_MODEL.modelId,
        modelVersion: LED_CURRENT_SENSE_MODEL.modelVersion,
      };
    }

    const currentA = trace[index].ledCurrentA;
    const shuntVoltageV = Number((currentA * shuntResistanceOhm).toFixed(9));
    const quantized = quantizeAdcSample({
      inputVoltageV: shuntVoltageV,
      referenceVoltageV,
      resolutionBits,
    });
    if (!quantized.ok) {
      return {
        ok: false,
        errorSource: "adc-quantizer",
        errors: quantized.errors,
        modelId: LED_CURRENT_SENSE_MODEL.modelId,
        modelVersion: LED_CURRENT_SENSE_MODEL.modelVersion,
      };
    }

    warnings.push(...quantized.warnings.map((entry) => ({ ...entry, sampleIndex: index })));
    samples.push(Object.freeze({
      time: trace[index].time,
      ledCurrentA: currentA,
      shuntVoltageV,
      adcCode: quantized.result.code,
      adcQuantizedVoltageV: quantized.result.quantizedVoltageV,
    }));
  }

  return {
    ok: true,
    result: Object.freeze({
      modelId: LED_CURRENT_SENSE_MODEL.modelId,
      modelVersion: LED_CURRENT_SENSE_MODEL.modelVersion,
      shuntResistanceOhm,
      referenceVoltageV,
      resolutionBits,
      maxAdcCode: (2 ** resolutionBits) - 1,
      samples: Object.freeze(samples),
      trace: Object.freeze(samples),
      sourceTraceQuantity: "ledCurrentA",
      adcQuantizerModelId: ADC_QUANTIZER_MODEL.modelId,
      adcQuantizerModelVersion: ADC_QUANTIZER_MODEL.modelVersion,
    }),
    warnings: Object.freeze(warnings),
  };
}

export const readLedCurrent = evaluateLedCurrentSense;
