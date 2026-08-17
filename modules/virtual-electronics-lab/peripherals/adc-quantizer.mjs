const ADC_QUANTIZER_WARNINGS = Object.freeze([
  Object.freeze({
    code: "ADC_INPUT_BELOW_RANGE",
    description: "Eingangsspannung wurde auf 0 V begrenzt.",
  }),
  Object.freeze({
    code: "ADC_INPUT_ABOVE_RANGE",
    description: "Eingangsspannung wurde auf die Referenzspannung begrenzt.",
  }),
]);

const ADC_QUANTIZER_ERRORS = Object.freeze([
  Object.freeze({
    code: "ADC_INPUT_VOLTAGE_NUMBER_REQUIRED",
    description: "inputVoltageV must be a finite number.",
  }),
  Object.freeze({
    code: "ADC_REFERENCE_VOLTAGE_INVALID",
    description: "referenceVoltageV must be a finite number greater than 0 and at most 100.",
  }),
  Object.freeze({
    code: "ADC_RESOLUTION_BITS_INVALID",
    description: "resolutionBits must be an integer between 1 and 24.",
  }),
]);

export const ADC_QUANTIZER_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-idealized-adc-quantizer",
  modelVersion: "1.0.0",
  architecture: "idealized",
  inputQuantity: "voltage",
  inputUnit: "V",
  outputQuantity: "adc-code-and-quantized-voltage",
  outputUnit: "code/V",
  minResolutionBits: 1,
  maxResolutionBits: 24,
  maxReferenceVoltageV: 100,
  warnings: ADC_QUANTIZER_WARNINGS,
  errors: ADC_QUANTIZER_ERRORS,
});

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function makeError(code, details = {}) {
  return { code, message: `ADC quantization failed for ${code}.`, ...details };
}

function validateInput({ inputVoltageV, referenceVoltageV, resolutionBits }) {
  if (!isFiniteNumber(inputVoltageV)) {
    return {
      ok: false,
      error: makeError("ADC_INPUT_VOLTAGE_NUMBER_REQUIRED", { field: "inputVoltageV" }),
    };
  }

  if (!isFiniteNumber(referenceVoltageV) || referenceVoltageV <= 0 || referenceVoltageV > ADC_QUANTIZER_MODEL.maxReferenceVoltageV) {
    return {
      ok: false,
      error: makeError("ADC_REFERENCE_VOLTAGE_INVALID", { field: "referenceVoltageV" }),
    };
  }

  if (!Number.isInteger(resolutionBits) || resolutionBits < ADC_QUANTIZER_MODEL.minResolutionBits || resolutionBits > ADC_QUANTIZER_MODEL.maxResolutionBits) {
    return {
      ok: false,
      error: makeError("ADC_RESOLUTION_BITS_INVALID", { field: "resolutionBits" }),
    };
  }

  return { ok: true };
}

export function quantizeAdcSample({
  inputVoltageV,
  referenceVoltageV,
  resolutionBits,
}) {
  const validated = validateInput({ inputVoltageV, referenceVoltageV, resolutionBits });
  if (!validated.ok) {
    return { ok: false, errors: [validated.error] };
  }

  const maxCode = 2 ** resolutionBits - 1;
  const clampedVoltageV = Math.min(Math.max(inputVoltageV, 0), referenceVoltageV);

  const warnings = [];

  if (inputVoltageV < 0) {
    warnings.push({
      code: "ADC_INPUT_BELOW_RANGE",
      message: `inputVoltageV clipped to 0 V (min).`,
      valueV: clampedVoltageV,
    });
  } else if (inputVoltageV > referenceVoltageV) {
    warnings.push({
      code: "ADC_INPUT_ABOVE_RANGE",
      message: `inputVoltageV clipped to ${referenceVoltageV} V (max).`,
      valueV: clampedVoltageV,
    });
  }

  const code = Math.round((clampedVoltageV / referenceVoltageV) * maxCode);
  const quantizedVoltageV = (code / maxCode) * referenceVoltageV;

  const result = Object.freeze({
    modelId: ADC_QUANTIZER_MODEL.modelId,
    modelVersion: ADC_QUANTIZER_MODEL.modelVersion,
    inputVoltageV,
    referenceVoltageV,
    resolutionBits,
    maxCode,
    code,
    quantizedVoltageV,
    clampedVoltageV,
  });

  return {
    ok: true,
    result,
    warnings: Object.freeze(warnings),
  };
}
