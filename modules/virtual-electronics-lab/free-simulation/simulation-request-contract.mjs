import { normalizeCircuitDocument } from "./circuit-document-contract.mjs";

export const SIMULATION_REQUEST_CONTRACT = Object.freeze({
  schemaVersion: "1.0.0",
  supportedAnalyses: Object.freeze(["dc-operating-point", "transient"]),
  transientLimits: Object.freeze({
    minTimeStepS: 1e-6,
    maxTimeStepS: 1e-2,
    maxStopTimeS: 1,
    maxSteps: 1_000,
  }),
});

const ERRORS = Object.freeze({
  REQUIRED: Object.freeze({ code: "ELAB_SIMULATION_REQUEST_REQUIRED", message: "Ein Simulationsauftrag ist erforderlich." }),
  UNKNOWN_KEYS: Object.freeze({ code: "ELAB_SIMULATION_REQUEST_UNKNOWN_KEYS", message: "Der Simulationsauftrag enthält unbekannte Felder." }),
  VERSION: Object.freeze({ code: "ELAB_SIMULATION_REQUEST_VERSION_INVALID", message: "Die Version des Simulationsauftrags wird nicht unterstützt." }),
  CIRCUIT: Object.freeze({ code: "ELAB_SIMULATION_REQUEST_CIRCUIT_INVALID", message: "Das Schaltungsdokument des Simulationsauftrags ist ungültig." }),
  ANALYSIS: Object.freeze({ code: "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID", message: "Die Analysekonfiguration ist ungültig." }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(error, details = {}) {
  return deepFreeze({ ok: false, errors: [{ ...error, ...details }] });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeAnalysis(input) {
  if (!isObject(input) || typeof input.type !== "string") return null;
  if (input.type === "dc-operating-point") {
    if (Object.keys(input).some((key) => key !== "type")) return null;
    return { type: input.type };
  }
  if (input.type !== "transient" || Object.keys(input).some((key) => !["type", "timeStepS", "stopTimeS"].includes(key))) return null;
  const { timeStepS, stopTimeS } = input;
  const limits = SIMULATION_REQUEST_CONTRACT.transientLimits;
  if (!Number.isFinite(timeStepS) || timeStepS < limits.minTimeStepS || timeStepS > limits.maxTimeStepS) return null;
  if (!Number.isFinite(stopTimeS) || stopTimeS < timeStepS || stopTimeS > limits.maxStopTimeS) return null;
  const steps = Math.round(stopTimeS / timeStepS);
  if (steps > limits.maxSteps || Math.abs((steps * timeStepS) - stopTimeS) > Math.max(1e-12, stopTimeS * 1e-9)) return null;
  return { type: input.type, timeStepS, stopTimeS };
}

export function normalizeSimulationRequest(input) {
  if (!isObject(input)) return failure(ERRORS.REQUIRED);
  if (Object.keys(input).some((key) => !["schemaVersion", "circuit", "analysis"].includes(key))) return failure(ERRORS.UNKNOWN_KEYS);
  if (input.schemaVersion !== SIMULATION_REQUEST_CONTRACT.schemaVersion) return failure(ERRORS.VERSION);
  const circuit = normalizeCircuitDocument(input.circuit);
  if (!circuit.ok) return failure(ERRORS.CIRCUIT, { cause: circuit.errors[0]?.code || "ELAB_FREE_UNKNOWN" });
  const analysis = normalizeAnalysis(input.analysis);
  if (!analysis) return failure(ERRORS.ANALYSIS);
  return deepFreeze({
    ok: true,
    request: {
      schemaVersion: SIMULATION_REQUEST_CONTRACT.schemaVersion,
      circuit: circuit.document,
      analysis,
    },
  });
}

export const validateSimulationRequest = normalizeSimulationRequest;
