import { SIMULATION_REQUEST_CONTRACT } from "./simulation-request-contract.mjs";

const AXIS_LIMITS = Object.freeze({
  "dc-operating-point": 1,
  transient: SIMULATION_REQUEST_CONTRACT.transientLimits.maxSteps + 1,
  "ac-sweep": SIMULATION_REQUEST_CONTRACT.acSweepLimits.maxSamples,
});

export const SOLVER_RESULT_CONTRACT = Object.freeze({
  schemaVersion: "1.0.0",
  requestSchemaVersion: SIMULATION_REQUEST_CONTRACT.schemaVersion,
  supportedAnalyses: Object.freeze(["dc-operating-point", "transient", "ac-sweep"]),
  limits: Object.freeze({
    maxIdentifierLength: 64,
    maxAxisValuesByAnalysis: AXIS_LIMITS,
    maxNodeSeries: 64,
    maxBranchSeries: 32,
    maxOutputValues: 64_000,
    maxModels: 8,
    maxDiagnostics: 32,
    maxDiagnosticMessageLength: 512,
  }),
});

const AXIS_BY_ANALYSIS = Object.freeze({
  "dc-operating-point": Object.freeze({ kind: "operating-point", unit: "index" }),
  transient: Object.freeze({ kind: "time", unit: "s" }),
  "ac-sweep": Object.freeze({ kind: "frequency", unit: "Hz" }),
});

const ERRORS = Object.freeze({
  REQUIRED: Object.freeze({ code: "ELAB_SOLVER_RESULT_REQUIRED", message: "Ein Solverergebnis ist erforderlich." }),
  UNKNOWN_KEYS: Object.freeze({ code: "ELAB_SOLVER_RESULT_UNKNOWN_KEYS", message: "Das Solverergebnis enthält unbekannte Felder." }),
  VERSION: Object.freeze({ code: "ELAB_SOLVER_RESULT_VERSION_INVALID", message: "Die Version des Solverergebnisses wird nicht unterstützt." }),
  IDENTITY: Object.freeze({ code: "ELAB_SOLVER_RESULT_IDENTITY_INVALID", message: "Die Dokumentidentität des Solverergebnisses ist ungültig." }),
  ANALYSIS: Object.freeze({ code: "ELAB_SOLVER_RESULT_ANALYSIS_INVALID", message: "Die Analyseart des Solverergebnisses ist ungültig." }),
  AXIS: Object.freeze({ code: "ELAB_SOLVER_RESULT_AXIS_INVALID", message: "Die Ergebnisachse ist ungültig oder nicht streng monoton." }),
  NODES: Object.freeze({ code: "ELAB_SOLVER_RESULT_NODES_INVALID", message: "Die Knotenserien des Solverergebnisses sind ungültig." }),
  BRANCHES: Object.freeze({ code: "ELAB_SOLVER_RESULT_BRANCHES_INVALID", message: "Die Zweigserien des Solverergebnisses sind ungültig." }),
  MODELS: Object.freeze({ code: "ELAB_SOLVER_RESULT_MODELS_INVALID", message: "Die Modellversionen des Solverergebnisses sind ungültig." }),
  DIAGNOSTICS: Object.freeze({ code: "ELAB_SOLVER_RESULT_DIAGNOSTICS_INVALID", message: "Die Diagnosen des Solverergebnisses sind ungültig." }),
  VALUE_LIMIT: Object.freeze({ code: "ELAB_SOLVER_RESULT_VALUE_LIMIT", message: "Das Solverergebnis überschreitet die Wertgrenze." }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(error) {
  return deepFreeze({ ok: false, errors: [{ ...error }] });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validIdentifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= SOLVER_RESULT_CONTRACT.limits.maxIdentifierLength
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeAxis(input, analysis) {
  const expected = AXIS_BY_ANALYSIS[analysis];
  if (!isRecord(input) || !hasOnlyKeys(input, ["kind", "unit", "values"])) return null;
  if (input.kind !== expected.kind || input.unit !== expected.unit || !Array.isArray(input.values)) return null;
  if (input.values.length < 1 || input.values.length > SOLVER_RESULT_CONTRACT.limits.maxAxisValuesByAnalysis[analysis]) return null;
  if (!input.values.every(finiteNumber)) return null;
  if (analysis === "dc-operating-point") {
    if (input.values.length !== 1 || input.values[0] !== 0) return null;
  } else {
    if ((analysis === "transient" && input.values[0] < 0) || (analysis === "ac-sweep" && input.values[0] <= 0)) return null;
    for (let index = 1; index < input.values.length; index += 1) {
      if (input.values[index] <= input.values[index - 1]) return null;
    }
  }
  return { kind: expected.kind, unit: expected.unit, values: [...input.values] };
}

function normalizeComplex(value) {
  if (!isRecord(value) || !hasOnlyKeys(value, ["real", "imaginary", "magnitude", "phaseDeg"])) return null;
  if (![value.real, value.imaginary, value.magnitude, value.phaseDeg].every(finiteNumber) || value.magnitude < 0) return null;
  return { real: value.real, imaginary: value.imaginary, magnitude: value.magnitude, phaseDeg: value.phaseDeg };
}

function normalizeNodeValue(value, complex) {
  if (complex) return normalizeComplex(value);
  if (!isRecord(value) || !hasOnlyKeys(value, ["voltageV"]) || !finiteNumber(value.voltageV)) return null;
  return { voltageV: value.voltageV };
}

function normalizeBranchValue(value, complex) {
  if (!isRecord(value)) return null;
  if (complex) {
    if (!hasOnlyKeys(value, ["voltage", "current"])) return null;
    const voltage = normalizeComplex(value.voltage);
    const current = normalizeComplex(value.current);
    return voltage && current ? { voltage, current } : null;
  }
  if (!hasOnlyKeys(value, ["voltageV", "currentA", "powerW"])) return null;
  if (![value.voltageV, value.currentA, value.powerW].every(finiteNumber)) return null;
  return { voltageV: value.voltageV, currentA: value.currentA, powerW: value.powerW };
}

function normalizeSeries(input, analysis, axisLength, kind) {
  const isNode = kind === "node";
  const limit = isNode ? SOLVER_RESULT_CONTRACT.limits.maxNodeSeries : SOLVER_RESULT_CONTRACT.limits.maxBranchSeries;
  const allowedKeys = isNode ? ["nodeId", "values"] : ["componentId", "componentType", "fromNode", "toNode", "values"];
  if (!Array.isArray(input) || input.length > limit) return null;
  const seen = new Set();
  const complex = analysis === "ac-sweep";
  const normalized = [];
  for (const series of input) {
    if (!isRecord(series) || !hasOnlyKeys(series, allowedKeys) || !Array.isArray(series.values) || series.values.length !== axisLength) return null;
    const id = isNode ? series.nodeId : series.componentId;
    if (!validIdentifier(id) || seen.has(id)) return null;
    seen.add(id);
    if (!isNode && (![series.componentType, series.fromNode, series.toNode].every(validIdentifier) || series.fromNode === series.toNode)) return null;
    const values = series.values.map((value) => isNode ? normalizeNodeValue(value, complex) : normalizeBranchValue(value, complex));
    if (values.some((value) => value === null)) return null;
    normalized.push(isNode
      ? { nodeId: id, values }
      : { componentId: id, componentType: series.componentType, fromNode: series.fromNode, toNode: series.toNode, values });
  }
  normalized.sort((left, right) => (isNode ? left.nodeId.localeCompare(right.nodeId) : left.componentId.localeCompare(right.componentId)));
  return normalized;
}

function normalizeModels(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > SOLVER_RESULT_CONTRACT.limits.maxModels) return null;
  const seen = new Set();
  const models = [];
  for (const model of input) {
    if (!isRecord(model) || !hasOnlyKeys(model, ["modelId", "modelVersion"]) || !validIdentifier(model.modelId) || !validIdentifier(model.modelVersion) || seen.has(model.modelId)) return null;
    seen.add(model.modelId);
    models.push({ modelId: model.modelId, modelVersion: model.modelVersion });
  }
  models.sort((left, right) => left.modelId.localeCompare(right.modelId));
  return models;
}

function normalizeDiagnostics(input) {
  if (!Array.isArray(input) || input.length > SOLVER_RESULT_CONTRACT.limits.maxDiagnostics) return null;
  const diagnostics = [];
  for (const diagnostic of input) {
    if (!isRecord(diagnostic) || !hasOnlyKeys(diagnostic, ["code", "severity", "message"])) return null;
    if (!validIdentifier(diagnostic.code) || !["info", "warning"].includes(diagnostic.severity)) return null;
    if (typeof diagnostic.message !== "string" || diagnostic.message.length < 1 || diagnostic.message.length > SOLVER_RESULT_CONTRACT.limits.maxDiagnosticMessageLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(diagnostic.message)) return null;
    diagnostics.push({ code: diagnostic.code, severity: diagnostic.severity, message: diagnostic.message });
  }
  return diagnostics;
}

function numericValueCount(axis, nodes, branches, analysis) {
  const nodeWidth = analysis === "ac-sweep" ? 4 : 1;
  const branchWidth = analysis === "ac-sweep" ? 8 : 3;
  return axis.values.length + (nodes.length * axis.values.length * nodeWidth) + (branches.length * axis.values.length * branchWidth);
}

export function normalizeSolverResult(input) {
  if (!isRecord(input)) return failure(ERRORS.REQUIRED);
  const rootKeys = ["schemaVersion", "requestSchemaVersion", "documentId", "documentVersion", "analysis", "axis", "nodes", "branches", "models", "diagnostics"];
  if (!hasOnlyKeys(input, rootKeys)) return failure(ERRORS.UNKNOWN_KEYS);
  if (input.schemaVersion !== SOLVER_RESULT_CONTRACT.schemaVersion || input.requestSchemaVersion !== SOLVER_RESULT_CONTRACT.requestSchemaVersion) return failure(ERRORS.VERSION);
  if (!validIdentifier(input.documentId) || !validIdentifier(input.documentVersion)) return failure(ERRORS.IDENTITY);
  if (!SOLVER_RESULT_CONTRACT.supportedAnalyses.includes(input.analysis)) return failure(ERRORS.ANALYSIS);
  const axis = normalizeAxis(input.axis, input.analysis);
  if (!axis) return failure(ERRORS.AXIS);
  const nodes = normalizeSeries(input.nodes, input.analysis, axis.values.length, "node");
  if (!nodes) return failure(ERRORS.NODES);
  const branches = normalizeSeries(input.branches, input.analysis, axis.values.length, "branch");
  if (!branches) return failure(ERRORS.BRANCHES);
  const models = normalizeModels(input.models);
  if (!models) return failure(ERRORS.MODELS);
  const diagnostics = normalizeDiagnostics(input.diagnostics);
  if (!diagnostics) return failure(ERRORS.DIAGNOSTICS);
  if (numericValueCount(axis, nodes, branches, input.analysis) > SOLVER_RESULT_CONTRACT.limits.maxOutputValues) return failure(ERRORS.VALUE_LIMIT);
  return deepFreeze({
    ok: true,
    result: {
      schemaVersion: SOLVER_RESULT_CONTRACT.schemaVersion,
      requestSchemaVersion: SOLVER_RESULT_CONTRACT.requestSchemaVersion,
      documentId: input.documentId,
      documentVersion: input.documentVersion,
      analysis: input.analysis,
      axis,
      nodes,
      branches,
      models,
      diagnostics,
    },
  });
}

export const validateSolverResult = normalizeSolverResult;
