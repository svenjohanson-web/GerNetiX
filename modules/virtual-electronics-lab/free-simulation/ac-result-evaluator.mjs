import { SIMULATION_REQUEST_CONTRACT } from "./simulation-request-contract.mjs";

const MAX_TRACES = 8;
const MAX_SAMPLES = SIMULATION_REQUEST_CONTRACT.acSweepLimits.maxSamples;
const DB_DROP = 3;

export const AC_RESULT_EVALUATOR_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-ac-result-evaluator",
  modelVersion: "1.0.0",
  analysis: "ac-sweep",
  maxTraces: MAX_TRACES,
  maxSamplesPerTrace: MAX_SAMPLES,
  threeDbDrop: DB_DROP,
  interpolation: "linear-in-gainDb-over-log10-frequency; phase-linear-at-crossing",
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
    errorSource: "ac-result-evaluator",
    errors: [{ code, message, ...details }],
    modelId: AC_RESULT_EVALUATOR_MODEL.modelId,
    modelVersion: AC_RESULT_EVALUATOR_MODEL.modelVersion,
  });
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateTrace(trace, traceIndex) {
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    return failure("ELAB_AC_RESULT_TRACE_INVALID", "AC-Tastkopfspur muss ein Objekt sein.", { traceIndex });
  }
  if (!Array.isArray(trace.samples) || trace.samples.length < 1 || trace.samples.length > MAX_SAMPLES) {
    return failure("ELAB_AC_RESULT_SAMPLES_INVALID", `AC-Tastkopfspur muss 1 bis ${MAX_SAMPLES} Samples enthalten.`, { traceIndex });
  }

  let previousFrequency = null;
  for (let sampleIndex = 0; sampleIndex < trace.samples.length; sampleIndex += 1) {
    const sample = trace.samples[sampleIndex];
    if (!sample || !isFiniteNumber(sample.frequencyHz) || sample.frequencyHz <= 0) {
      return failure("ELAB_AC_RESULT_FREQUENCY_INVALID", "Frequenzen müssen endliche Werte größer 0 sein.", { traceIndex, sampleIndex });
    }
    if (previousFrequency !== null && sample.frequencyHz <= previousFrequency) {
      return failure("ELAB_AC_RESULT_FREQUENCY_NOT_MONOTONIC", "Die Frequenzachse muss strikt aufsteigend sein.", { traceIndex, sampleIndex });
    }
    if (!isFiniteNumber(sample.gainDb) || !isFiniteNumber(sample.phaseDeg)) {
      return failure("ELAB_AC_RESULT_SAMPLE_INVALID", "Jedes AC-Sample benötigt endliche gainDb- und phaseDeg-Werte.", { traceIndex, sampleIndex });
    }
    previousFrequency = sample.frequencyHz;
  }
  return null;
}

function interpolate(left, right, thresholdDb) {
  if (left.gainDb === thresholdDb) return { frequencyHz: left.frequencyHz, phaseDeg: left.phaseDeg };
  if (right.gainDb === thresholdDb) return { frequencyHz: right.frequencyHz, phaseDeg: right.phaseDeg };

  const gainSpan = right.gainDb - left.gainDb;
  if (gainSpan === 0) return null;
  const fraction = (thresholdDb - left.gainDb) / gainSpan;
  if (!(fraction > 0 && fraction < 1)) return null;

  const logLeft = Math.log10(left.frequencyHz);
  const logRight = Math.log10(right.frequencyHz);
  const frequencyHz = 10 ** (logLeft + ((logRight - logLeft) * fraction));
  const phaseDeg = left.phaseDeg + ((right.phaseDeg - left.phaseDeg) * fraction);
  return { frequencyHz, phaseDeg };
}

function evaluateTrace(trace) {
  const samples = trace.samples;
  const start = samples[0];
  const stop = samples[samples.length - 1];
  let maximum = samples[0];
  for (const sample of samples) {
    if (sample.gainDb > maximum.gainDb) maximum = sample;
  }

  const thresholdDb = maximum.gainDb - DB_DROP;
  let crossing = null;
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    if (current.gainDb === thresholdDb) {
      crossing = { frequencyHz: current.frequencyHz, phaseDeg: current.phaseDeg };
      break;
    }
    const next = samples[index + 1];
    if (!next) break;
    if (current.gainDb > thresholdDb && next.gainDb < thresholdDb) {
      crossing = interpolate(current, next, thresholdDb);
      break;
    }
  }

  const warnings = [];
  if (samples.length < 2) warnings.push({
    code: "ELAB_AC_RESULT_SWEEP_TOO_SHORT",
    message: "Der AC-Sweep enthält weniger als zwei Frequenzpunkte.",
  });
  if (!crossing) warnings.push({
    code: "ELAB_AC_RESULT_NO_3DB_CROSSING",
    message: "Im vorhandenen Sweep wurde kein erster −3-dB-Durchgang gefunden.",
  });

  return {
    probeId: trace.probeId,
    label: trace.label,
    startGainDb: start.gainDb,
    stopGainDb: stop.gainDb,
    maximumGainDb: maximum.gainDb,
    maximumFrequencyHz: maximum.frequencyHz,
    start: { frequencyHz: start.frequencyHz, gainDb: start.gainDb, phaseDeg: start.phaseDeg },
    stop: { frequencyHz: stop.frequencyHz, gainDb: stop.gainDb, phaseDeg: stop.phaseDeg },
    maximum: { frequencyHz: maximum.frequencyHz, gainDb: maximum.gainDb, phaseDeg: maximum.phaseDeg },
    threeDb: {
      thresholdDb,
      frequencyHz: crossing?.frequencyHz ?? null,
      phaseDeg: crossing?.phaseDeg ?? null,
      interpolation: crossing ? AC_RESULT_EVALUATOR_MODEL.interpolation : null,
    },
    threeDbFrequencyHz: crossing?.frequencyHz ?? null,
    phaseAtThreeDbFrequencyDeg: crossing?.phaseDeg ?? null,
    warnings,
  };
}

/**
 * Evaluates the already differentiated AC voltage-probe traces. The first
 * descending crossing of max(gainDb) - 3 dB is interpolated linearly in dB
 * over log10(frequency); phase uses the same interpolation fraction.
 */
export function evaluateAcResult(probeEvaluation) {
  if (!probeEvaluation?.ok || !Array.isArray(probeEvaluation.traces)) {
    return failure("ELAB_AC_RESULT_INPUT_INVALID", "Für die AC-Kennwertauswertung werden gültige Tastkopfspuren benötigt.");
  }
  if (probeEvaluation.traces.length < 1 || probeEvaluation.traces.length > MAX_TRACES) {
    return failure("ELAB_AC_RESULT_TRACE_COUNT_INVALID", `Es sind 1 bis ${MAX_TRACES} AC-Tastkopfspuren zulässig.`);
  }

  for (let traceIndex = 0; traceIndex < probeEvaluation.traces.length; traceIndex += 1) {
    const validation = validateTrace(probeEvaluation.traces[traceIndex], traceIndex);
    if (validation) return validation;
  }

  const traces = probeEvaluation.traces.map(evaluateTrace);
  const warnings = traces.flatMap((trace, traceIndex) => trace.warnings.map((warning) => ({ ...warning, traceIndex, probeId: trace.probeId })));
  return deepFreeze({
    ok: true,
    result: {
      modelId: AC_RESULT_EVALUATOR_MODEL.modelId,
      modelVersion: AC_RESULT_EVALUATOR_MODEL.modelVersion,
      threeDbDrop: DB_DROP,
      interpolation: AC_RESULT_EVALUATOR_MODEL.interpolation,
      traces,
    },
    warnings,
  });
}

export const evaluateAcResults = evaluateAcResult;
