import {
  AC_RESULT_EVALUATOR_MODEL,
  evaluateAcResult,
} from "./ac-result-evaluator.mjs";

const MAX_ERRORS = 32;
const MAX_TEXT_LENGTH = 512;

export const AC_RESULT_VIEW_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-ac-result-view-model",
  modelVersion: "1.0.0",
  evaluatorModelId: AC_RESULT_EVALUATOR_MODEL.modelId,
  evaluatorModelVersion: AC_RESULT_EVALUATOR_MODEL.modelVersion,
  supportedStates: Object.freeze(["empty", "success", "error", "invalidated"]),
  plotCoordinates: "normalized-log10-frequency-and-linear-value",
});

const STATE_STATUS = Object.freeze({
  empty: Object.freeze({
    tone: "neutral",
    code: "ELAB_AC_VIEW_EMPTY",
    message: "AC-Analyse noch nicht gestartet.",
  }),
  invalidated: Object.freeze({
    tone: "warning",
    code: "ELAB_AC_VIEW_INVALIDATED",
    message: "Schaltung geändert; AC-Analyse erneut berechnen.",
  }),
  success: Object.freeze({
    tone: "success",
    code: "ELAB_AC_VIEW_SUCCESS",
    message: "AC-Analyse erfolgreich ausgewertet.",
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message, details = {}) {
  return deepFreeze({
    ok: false,
    errorSource: "ac-result-view-model",
    errors: [{ code, message, ...details }],
    modelId: AC_RESULT_VIEW_MODEL.modelId,
    modelVersion: AC_RESULT_VIEW_MODEL.modelVersion,
  });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function shell(state, status) {
  return {
    ok: true,
    view: {
      modelId: AC_RESULT_VIEW_MODEL.modelId,
      modelVersion: AC_RESULT_VIEW_MODEL.modelVersion,
      evaluatorModelId: AC_RESULT_VIEW_MODEL.evaluatorModelId,
      evaluatorModelVersion: AC_RESULT_VIEW_MODEL.evaluatorModelVersion,
      state,
      status: { ...status },
      plots: null,
      metricCards: [],
      table: null,
      warnings: [],
    },
  };
}

function normalizeErrors(errors) {
  if (!Array.isArray(errors) || errors.length < 1 || errors.length > MAX_ERRORS) return null;
  const normalized = [];
  for (const error of errors) {
    if (!isRecord(error) || !hasOnlyKeys(error, ["code", "message"])) return null;
    if (typeof error.code !== "string"
      || error.code.length < 1
      || error.code.length > MAX_TEXT_LENGTH
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(error.code)) return null;
    if (typeof error.message !== "string"
      || error.message.length < 1
      || error.message.length > MAX_TEXT_LENGTH
      || /[\u0000-\u001f\u007f]/u.test(error.message)) return null;
    normalized.push({ code: error.code, message: error.message });
  }
  return normalized;
}

function validDisplayText(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validTraceIdentity(traces) {
  const probeIds = new Set();
  for (const trace of traces) {
    if (!validDisplayText(trace.probeId) || !validDisplayText(trace.label) || probeIds.has(trace.probeId)) return false;
    probeIds.add(trace.probeId);
  }
  return true;
}

function extent(values) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return { minimum, maximum };
}

function normalizedLinear(value, range) {
  const span = range.maximum - range.minimum;
  return span === 0 ? 0.5 : (range.maximum - value) / span;
}

function normalizedLogarithmic(value, range) {
  const minimum = Math.log10(range.minimum);
  const span = Math.log10(range.maximum) - minimum;
  return span === 0 ? 0 : (Math.log10(value) - minimum) / span;
}

function createPlots(traces) {
  const samples = traces.flatMap((trace) => trace.samples);
  const frequencyRange = extent(samples.map((sample) => sample.frequencyHz));
  const gainRange = extent(samples.map((sample) => sample.gainDb));
  const phaseRange = extent(samples.map((sample) => sample.phaseDeg));
  const mapTrace = (trace, valueKey, valueRange) => ({
    probeId: trace.probeId,
    label: trace.label,
    points: trace.samples.map((sample) => ({
      frequencyHz: sample.frequencyHz,
      value: sample[valueKey],
      x: normalizedLogarithmic(sample.frequencyHz, frequencyRange),
      y: normalizedLinear(sample[valueKey], valueRange),
    })),
  });
  return {
    frequencyAxis: { scale: "log10", unit: "Hz", minimum: frequencyRange.minimum, maximum: frequencyRange.maximum },
    magnitude: {
      valueAxis: { scale: "linear", unit: "dB", minimum: gainRange.minimum, maximum: gainRange.maximum },
      traces: traces.map((trace) => mapTrace(trace, "gainDb", gainRange)),
    },
    phase: {
      valueAxis: { scale: "linear", unit: "deg", minimum: phaseRange.minimum, maximum: phaseRange.maximum },
      traces: traces.map((trace) => mapTrace(trace, "phaseDeg", phaseRange)),
    },
  };
}

function createMetricCards(traces) {
  return traces.map((trace) => ({
    probeId: trace.probeId,
    label: trace.label,
    metrics: [
      { id: "start-gain", label: "Startverstärkung", value: trace.startGainDb, unit: "dB", available: true },
      { id: "stop-gain", label: "Stoppverstärkung", value: trace.stopGainDb, unit: "dB", available: true },
      { id: "maximum-gain", label: "Maximale Verstärkung", value: trace.maximumGainDb, unit: "dB", available: true },
      { id: "maximum-frequency", label: "Frequenz des Maximums", value: trace.maximumFrequencyHz, unit: "Hz", available: true },
      { id: "three-db-frequency", label: "−3-dB-Eckfrequenz", value: trace.threeDbFrequencyHz, unit: "Hz", available: trace.threeDbFrequencyHz !== null },
      { id: "phase-at-three-db", label: "Phase an der Eckfrequenz", value: trace.phaseAtThreeDbFrequencyDeg, unit: "deg", available: trace.phaseAtThreeDbFrequencyDeg !== null },
    ],
  }));
}

function createTable(traces) {
  return {
    columns: [
      { id: "probe", label: "Tastkopf", unit: null },
      { id: "startGainDb", label: "Start", unit: "dB" },
      { id: "stopGainDb", label: "Stopp", unit: "dB" },
      { id: "maximumGainDb", label: "Maximum", unit: "dB" },
      { id: "threeDbFrequencyHz", label: "−3-dB-Eckfrequenz", unit: "Hz" },
      { id: "phaseAtThreeDbFrequencyDeg", label: "Phase an der Eckfrequenz", unit: "deg" },
    ],
    rows: traces.map((trace) => ({
      probeId: trace.probeId,
      label: trace.label,
      startGainDb: trace.startGainDb,
      stopGainDb: trace.stopGainDb,
      maximumGainDb: trace.maximumGainDb,
      threeDbFrequencyHz: trace.threeDbFrequencyHz,
      phaseAtThreeDbFrequencyDeg: trace.phaseAtThreeDbFrequencyDeg,
    })),
  };
}

function createSuccessView(probeEvaluation) {
  const evaluated = evaluateAcResult(probeEvaluation);
  if (!evaluated.ok) {
    return failure("ELAB_AC_VIEW_EVALUATION_INVALID", "Die AC-Spuren konnten nicht für die Darstellung ausgewertet werden.", {
      cause: evaluated.errors[0]?.code || "ELAB_AC_RESULT_INPUT_INVALID",
    });
  }
  const traces = probeEvaluation.traces;
  if (!validTraceIdentity(traces)) {
    return failure("ELAB_AC_VIEW_TRACE_IDENTITY_INVALID", "Tastkopf-ID und Beschriftung müssen eindeutig und darstellbar sein.");
  }
  const result = evaluated.result.traces;
  const output = shell("success", STATE_STATUS.success);
  output.view.plots = createPlots(traces);
  output.view.metricCards = createMetricCards(result);
  output.view.table = createTable(result);
  output.view.warnings = evaluated.warnings.map((warning) => ({ ...warning }));
  return deepFreeze(output);
}

/**
 * Adapts validated AC probe traces to a DOM-independent presentation model.
 * Explicit non-success states never retain traces or measurements.
 */
export function createAcResultViewModel(input) {
  if (!isRecord(input) || typeof input.state !== "string") {
    return failure("ELAB_AC_VIEW_INPUT_INVALID", "Ein AC-Darstellungszustand ist erforderlich.");
  }
  if (!AC_RESULT_VIEW_MODEL.supportedStates.includes(input.state)) {
    return failure("ELAB_AC_VIEW_STATE_INVALID", "Der AC-Darstellungszustand wird nicht unterstützt.");
  }
  if (input.state === "success") {
    if (!hasOnlyKeys(input, ["state", "probeEvaluation"])) {
      return failure("ELAB_AC_VIEW_UNKNOWN_KEYS", "Der AC-Erfolgszustand enthält unbekannte Felder.");
    }
    return createSuccessView(input.probeEvaluation);
  }
  if (input.state === "error") {
    if (!hasOnlyKeys(input, ["state", "errors"])) {
      return failure("ELAB_AC_VIEW_UNKNOWN_KEYS", "Der AC-Fehlerzustand enthält unbekannte Felder.");
    }
    const errors = normalizeErrors(input.errors);
    if (!errors) return failure("ELAB_AC_VIEW_ERRORS_INVALID", "Der AC-Fehlerzustand enthält ungültige Fehlerdetails.");
    const output = shell("error", {
      tone: "error",
      code: "ELAB_AC_VIEW_ERROR",
      message: errors[0].message,
    });
    output.view.errors = errors;
    return deepFreeze(output);
  }
  if (!hasOnlyKeys(input, ["state"])) {
    return failure("ELAB_AC_VIEW_UNKNOWN_KEYS", "Der AC-Darstellungszustand enthält unbekannte Felder.");
  }
  return deepFreeze(shell(input.state, STATE_STATUS[input.state]));
}

export const adaptAcResultViewModel = createAcResultViewModel;
