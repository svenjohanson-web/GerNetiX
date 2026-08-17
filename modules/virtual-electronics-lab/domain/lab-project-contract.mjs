import { normalizeCircuitDocument } from "../free-simulation/circuit-document-contract.mjs";
import { normalizeMeasurementSetup } from "../free-simulation/measurement-point-contract.mjs";

export const LAB_PROJECT_SCHEMA_VERSION = "1.0.0";

export const LAB_PROJECT_SLICE_CONTRACT = Object.freeze({
  schemaVersion: LAB_PROJECT_SCHEMA_VERSION,
  capabilities: Object.freeze(["circuit", "instruments", "simulation"]),
  supportedAnalyses: Object.freeze(["dc-operating-point", "transient-step-response"]),
});

const ID_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message, path) {
  return deepFreeze({ ok: false, errors: [{ code, message, path }] });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value, allowed) {
  return isObject(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function normalizeAnalysisConfiguration(input) {
  if (!onlyKeys(input, ["analysis", "timeStepS", "stopTimeS"])) return null;
  if (!LAB_PROJECT_SLICE_CONTRACT.supportedAnalyses.includes(input.analysis)) return null;
  if (input.analysis === "dc-operating-point") {
    if (input.timeStepS !== undefined || input.stopTimeS !== undefined) return null;
    return { analysis: input.analysis };
  }
  if (!Number.isFinite(input.timeStepS) || input.timeStepS <= 0 || !Number.isFinite(input.stopTimeS) || input.stopTimeS < input.timeStepS) return null;
  return { analysis: input.analysis, timeStepS: input.timeStepS, stopTimeS: input.stopTimeS };
}

function normalizeModelVersions(input) {
  if (!isObject(input)) return null;
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ID_PATTERN.test(key) || typeof value !== "string" || !value.trim() || value.length > 80) return null;
    output[key] = value.trim();
  }
  return output;
}

export function normalizeLabProject(input) {
  if (!onlyKeys(input, ["schemaVersion", "id", "version", "circuit", "instruments", "simulation"])) {
    return failure("ELAB_PROJECT_INVALID", "LabProject enthält ungültige oder unbekannte Felder.", "project");
  }
  if (input.schemaVersion !== LAB_PROJECT_SCHEMA_VERSION) return failure("ELAB_PROJECT_SCHEMA_UNSUPPORTED", "LabProject-Schemaversion wird nicht unterstützt.", "schemaVersion");
  if (!ID_PATTERN.test(input.id || "")) return failure("ELAB_PROJECT_ID_INVALID", "LabProject-ID ist ungültig.", "id");
  if (!SEMVER_PATTERN.test(input.version || "")) return failure("ELAB_PROJECT_VERSION_INVALID", "LabProject-Version ist ungültig.", "version");
  if (!onlyKeys(input.circuit, ["document"])) return failure("ELAB_PROJECT_CIRCUIT_INVALID", "Schaltungsbereich des LabProject ist ungültig.", "circuit");
  const circuit = normalizeCircuitDocument(input.circuit.document);
  if (!circuit.ok) return failure("ELAB_PROJECT_CIRCUIT_INVALID", circuit.errors[0]?.message || "Schaltung ist ungültig.", "circuit.document");
  if (!onlyKeys(input.instruments, ["measurementSetup"])) return failure("ELAB_PROJECT_INSTRUMENTS_INVALID", "Instrumentenbereich des LabProject ist ungültig.", "instruments");
  const instruments = normalizeMeasurementSetup(input.instruments.measurementSetup, circuit.document);
  if (!instruments.ok) return failure("ELAB_PROJECT_INSTRUMENTS_INVALID", instruments.errors[0]?.message || "Messaufbau ist ungültig.", "instruments.measurementSetup");
  if (!onlyKeys(input.simulation, ["providerSelection", "analysisConfiguration", "modelVersions"]) || !ID_PATTERN.test(input.simulation.providerSelection || "")) {
    return failure("ELAB_PROJECT_SIMULATION_INVALID", "Simulationsbereich des LabProject ist ungültig.", "simulation");
  }
  const analysisConfiguration = normalizeAnalysisConfiguration(input.simulation.analysisConfiguration);
  const modelVersions = normalizeModelVersions(input.simulation.modelVersions);
  if (!analysisConfiguration || !modelVersions) return failure("ELAB_PROJECT_SIMULATION_INVALID", "Analysekonfiguration oder Modellversionen sind ungültig.", "simulation");

  return deepFreeze({
    ok: true,
    project: {
      schemaVersion: LAB_PROJECT_SCHEMA_VERSION,
      id: input.id,
      version: input.version,
      circuit: { document: circuit.document },
      instruments: { measurementSetup: instruments.setup },
      simulation: {
        providerSelection: input.simulation.providerSelection,
        analysisConfiguration,
        modelVersions,
      },
    },
  });
}

export function createLabProjectSlice({
  id = "free-circuit-project",
  version = "1.0.0",
  circuitDocument,
  measurementSetup,
  providerSelection = "deterministic-learning-solver",
  analysisConfiguration = { analysis: "dc-operating-point" },
  modelVersions = {},
} = {}) {
  return normalizeLabProject({
    schemaVersion: LAB_PROJECT_SCHEMA_VERSION,
    id,
    version,
    circuit: { document: circuitDocument },
    instruments: { measurementSetup },
    simulation: { providerSelection, analysisConfiguration, modelVersions },
  });
}

