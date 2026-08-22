const DIGITAL_INPUT_FLOATING_WARNING = Object.freeze({
  code: "DIGITAL_INPUT_FLOATING_IDEALIZED",
  message:
    "Das digitale Floating-Verhalten ist ein Lernmuster und keine Vorhersage einer realen Leiterplatte.",
});

const FLOATING_DIGITAL_INPUT_MODEL_ERRORS = Object.freeze([
  Object.freeze({
    code: "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_REQUIRED",
    message: "sampleIndex ist erforderlich und muss eine ganze Zahl zwischen 0 und 63 sein.",
    description: "sampleIndex must be an integer between 0 and 63.",
  }),
  Object.freeze({
    code: "DIGITAL_INPUT_FLOATING_SAMPLE_INDEX_NOT_SUPPORTED",
    message: "sampleIndex muss eine ganze Zahl zwischen 0 und 63 sein.",
    description: "sampleIndex is limited to 0..63.",
  }),
]);

const FLOATING_SEQUENCE = Object.freeze(["LOW", "HIGH", "HIGH", "LOW"]);

export const FLOATING_DIGITAL_INPUT_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-idealized-floating-digital-input",
  modelVersion: "1.0.0",
  architecture: "idealized",
  inputQuantity: "sample-index",
  inputUnit: "index",
  outputQuantity: "logic-level",
  outputUnit: "boolean",
  supportedSequence: FLOATING_SEQUENCE,
  supportedSampleRange: Object.freeze({
    min: 0,
    max: 63,
  }),
  warnings: Object.freeze([DIGITAL_INPUT_FLOATING_WARNING]),
  errors: FLOATING_DIGITAL_INPUT_MODEL_ERRORS,
});

const SAMPLE_INDEX_MIN = 0;
const SAMPLE_INDEX_MAX = 63;

function validateSampleIndex(sampleIndex) {
  if (!Number.isInteger(sampleIndex)) {
    return {
      ok: false,
      error: FLOATING_DIGITAL_INPUT_MODEL_ERRORS[0],
    };
  }

  if (sampleIndex < SAMPLE_INDEX_MIN || sampleIndex > SAMPLE_INDEX_MAX) {
    return {
      ok: false,
      error: FLOATING_DIGITAL_INPUT_MODEL_ERRORS[1],
    };
  }

  return { ok: true };
}
export function evaluateFloatingDigitalInput(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([FLOATING_DIGITAL_INPUT_MODEL_ERRORS[0]]),
      warnings: Object.freeze([]),
    });
  }

  const { sampleIndex } = options;
  const validated = validateSampleIndex(sampleIndex);
  if (!validated.ok) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([validated.error]),
      warnings: Object.freeze([]),
    });
  }

  const normalizedSampleIndex = Number(sampleIndex);
  const logicLevel = FLOATING_SEQUENCE[normalizedSampleIndex % 4];
  const normalizedValue = logicLevel === "HIGH" ? 1 : 0;

  return Object.freeze({
    ok: true,
    result: Object.freeze({
      logicLevel,
      normalizedValue,
      sampleIndex: normalizedSampleIndex,
      modelId: FLOATING_DIGITAL_INPUT_MODEL.modelId,
      modelVersion: FLOATING_DIGITAL_INPUT_MODEL.modelVersion,
      warnings: Object.freeze([DIGITAL_INPUT_FLOATING_WARNING]),
    }),
    warnings: Object.freeze([DIGITAL_INPUT_FLOATING_WARNING]),
  });
}
