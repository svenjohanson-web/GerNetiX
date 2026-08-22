const DIGITAL_TRACE_DEBOUNCE_WARNING = Object.freeze({
  code: "DIGITAL_TRACE_DEBOUNCE_IDEALIZED",
  message: "Digitale Entprellung ist ein idealisiertes Modell.",
});

const DIGITAL_TRACE_DEBOUNCE_ERRORS = Object.freeze([
  Object.freeze({
    code: "DIGITAL_TRACE_DEBOUNCE_TRACE_REQUIRED",
    message: "trace ist erforderlich und muss ein Array aus 1 bis 501 Samples sein.",
    description: "trace is required and must be an array of 1 to 501 samples.",
  }),
  Object.freeze({
    code: "DIGITAL_TRACE_DEBOUNCE_TRACE_LENGTH_NOT_SUPPORTED",
    message: "trace muss mindestens 1 und maximal 501 Samples enthalten.",
    description: "trace must contain at least 1 and at most 501 samples.",
  }),
  Object.freeze({
    code: "DIGITAL_TRACE_DEBOUNCE_SAMPLE_TIME_REQUIRED",
    message: "trace[].timeUs ist erforderlich und muss eine ganze Zahl zwischen 0 und 1_000_000 sein.",
    description: "trace sample timeUs is required and must be an integer between 0 and 1_000_000.",
  }),
  Object.freeze({
    code: "DIGITAL_TRACE_DEBOUNCE_SAMPLE_TIME_NOT_SUPPORTED",
    message: "trace[].timeUs muss strikt steigend sein.",
    description: "trace sample timeUs must be strictly increasing.",
  }),
  Object.freeze({
    code: "DIGITAL_TRACE_DEBOUNCE_SAMPLE_LEVEL_NOT_SUPPORTED",
    message: "trace[].logicLevel muss LOW oder HIGH sein.",
    description: "trace sample logicLevel must be LOW or HIGH.",
  }),
  Object.freeze({
    code: "DIGITAL_TRACE_DEBOUNCE_WINDOW_REQUIRED",
    message: "stableWindowUs ist erforderlich und muss eine ganze Zahl zwischen 50 und 100_000 sein.",
    description: "stableWindowUs is required and must be an integer between 50 and 100_000.",
  }),
]);

export const DIGITAL_TRACE_DEBOUNCE_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-idealized-digital-trace-debounce",
  modelVersion: "1.0.0",
  architecture: "idealized",
  inputQuantity: "digital-trace",
  inputUnit: "sample-array-microseconds",
  outputQuantity: "debounced-digital-trace",
  outputUnit: "logic-level",
  supportedTraceRange: Object.freeze({
    minSamples: 1,
    maxSamples: 501,
    minTimeUs: 0,
    maxTimeUs: 1_000_000,
    minWindowUs: 50,
    maxWindowUs: 100_000,
  }),
  supportedLevels: Object.freeze(["LOW", "HIGH"]),
  warnings: Object.freeze([DIGITAL_TRACE_DEBOUNCE_WARNING]),
  errors: DIGITAL_TRACE_DEBOUNCE_ERRORS,
});

const LOW = "LOW";
const HIGH = "HIGH";
const LOW_NORMALIZED = 0;
const HIGH_NORMALIZED = 1;
const SCHEMA_VERSION = "1.0.0";
const MIN_TIME_US = 0;
const MAX_TIME_US = 1_000_000;
const MIN_STABLE_WINDOW_US = 50;
const MAX_STABLE_WINDOW_US = 100_000;
const MIN_SAMPLE_COUNT = 1;
const MAX_SAMPLE_COUNT = 501;

const DEFAULT_UNITS = Object.freeze({
  timeUs: "microseconds",
  rawLogicLevel: "binary",
  debouncedLogicLevel: "binary",
  debouncedNormalizedValue: "ratio",
});

function validateTrace(trace) {
  if (!Array.isArray(trace)) {
    return {
      ok: false,
      error: DIGITAL_TRACE_DEBOUNCE_ERRORS[0],
    };
  }

  if (trace.length < MIN_SAMPLE_COUNT || trace.length > MAX_SAMPLE_COUNT) {
    return {
      ok: false,
      error: DIGITAL_TRACE_DEBOUNCE_ERRORS[1],
    };
  }

  let previousTimeUs = -1;
  for (const sample of trace) {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
      return {
        ok: false,
        error: DIGITAL_TRACE_DEBOUNCE_ERRORS[2],
      };
    }

    const timeUs = sample.timeUs;
    if (!Number.isInteger(timeUs) || timeUs < MIN_TIME_US || timeUs > MAX_TIME_US) {
      return {
        ok: false,
        error: DIGITAL_TRACE_DEBOUNCE_ERRORS[2],
      };
    }

    if (timeUs <= previousTimeUs) {
      return {
        ok: false,
        error: DIGITAL_TRACE_DEBOUNCE_ERRORS[3],
      };
    }

    const logicLevel = sample.logicLevel;
    if (logicLevel !== LOW && logicLevel !== HIGH) {
      return {
        ok: false,
        error: DIGITAL_TRACE_DEBOUNCE_ERRORS[4],
      };
    }

    previousTimeUs = timeUs;
  }

  return { ok: true };
}
function validateStableWindowUs(stableWindowUs) {
  if (!Number.isInteger(stableWindowUs) ||
      stableWindowUs < MIN_STABLE_WINDOW_US ||
      stableWindowUs > MAX_STABLE_WINDOW_US) {
    return {
      ok: false,
      error: DIGITAL_TRACE_DEBOUNCE_ERRORS[5],
    };
  }

  return { ok: true };
}

function failure(errorCode) {
  return Object.freeze({
    ok: false,
    errors: Object.freeze([errorCode]),
    warnings: Object.freeze([]),
  });
}

function buildResultSample(rawLogicLevel, debouncedLogicLevel, timeUs, changed) {
  return Object.freeze({
    timeUs,
    rawLogicLevel,
    debouncedLogicLevel,
    debouncedNormalizedValue: debouncedLogicLevel === LOW ? LOW_NORMALIZED : HIGH_NORMALIZED,
    changed,
  });
}

function toWarning() {
  return Object.freeze([DIGITAL_TRACE_DEBOUNCE_WARNING]);
}

export function debounceDigitalTrace(options) {
  const trace = options?.trace;
  const stableWindowUs = options?.stableWindowUs;

  const validatedTrace = validateTrace(trace);
  if (!validatedTrace.ok) {
    return failure(validatedTrace.error);
  }

  const validatedWindow = validateStableWindowUs(stableWindowUs);
  if (!validatedWindow.ok) {
    return failure(validatedWindow.error);
  }

  let debouncedLogicLevel = trace[0].logicLevel;
  let candidate = null;
  let candidateStartedAt = null;
  const debouncedTrace = [];

  for (const sample of trace) {
    const rawLogicLevel = sample.logicLevel;
    let changed = false;

    if (rawLogicLevel !== debouncedLogicLevel) {
      if (candidate === rawLogicLevel) {
        if (sample.timeUs - candidateStartedAt >= stableWindowUs) {
          debouncedLogicLevel = rawLogicLevel;
          candidate = null;
          candidateStartedAt = null;
          changed = true;
        }
      } else {
        candidate = rawLogicLevel;
        candidateStartedAt = sample.timeUs;
      }
    } else {
      candidate = null;
      candidateStartedAt = null;
    }

    debouncedTrace.push(buildResultSample(rawLogicLevel, debouncedLogicLevel, sample.timeUs, changed));
  }

  const warnings = toWarning();
  return Object.freeze({
    ok: true,
    result: Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      modelId: DIGITAL_TRACE_DEBOUNCE_MODEL.modelId,
      modelVersion: DIGITAL_TRACE_DEBOUNCE_MODEL.modelVersion,
      stableWindowUs,
      units: DEFAULT_UNITS,
      trace: Object.freeze(debouncedTrace),
      warnings,
    }),
    warnings,
  });
}
