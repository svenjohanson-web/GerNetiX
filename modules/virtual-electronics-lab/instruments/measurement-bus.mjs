import { normalizeLabProject } from "../domain/lab-project-contract.mjs";

export const MEASUREMENT_TRACE_SCHEMA_VERSION = "1.0.0";

export const MEASUREMENT_BUS_CONTRACT = Object.freeze({
  schemaVersion: MEASUREMENT_TRACE_SCHEMA_VERSION,
  supportedQuantities: Object.freeze(["node-voltage"]),
  units: Object.freeze({ "node-voltage": "V" }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message) {
  return deepFreeze({ ok: false, errorSource: "measurement-bus", errors: [{ code, message }] });
}

function solverModelVersions(result) {
  if (result?.modelVersions && typeof result.modelVersions === "object" && !Array.isArray(result.modelVersions)) return result.modelVersions;
  return typeof result?.modelVersion === "string" ? { solver: result.modelVersion } : {};
}

function normalizeSamples(samples, nodeIds) {
  if (!Array.isArray(samples) || !samples.length) return null;
  const expected = new Set(nodeIds);
  const normalized = [];
  for (const sample of samples) {
    if (!sample || !Number.isFinite(sample.timeS) || !Array.isArray(sample.nodeVoltages)) return null;
    const seen = new Set();
    const nodeVoltages = [];
    for (const entry of sample.nodeVoltages) {
      if (!entry || !expected.has(entry.nodeId) || seen.has(entry.nodeId) || !Number.isFinite(entry.voltageV)) return null;
      seen.add(entry.nodeId);
      nodeVoltages.push({ nodeId: entry.nodeId, voltageV: entry.voltageV });
    }
    if (seen.size !== expected.size) return null;
    nodeVoltages.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    normalized.push({ timeS: sample.timeS, nodeVoltages });
  }
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].timeS <= normalized[index - 1].timeS) return null;
  }
  return normalized;
}

export function publishNodeVoltageTrace({ labProject, solverResponse } = {}) {
  const normalizedProject = normalizeLabProject(labProject);
  if (!normalizedProject.ok) return failure("ELAB_MEASUREMENT_PROJECT_INVALID", normalizedProject.errors[0]?.message || "LabProject ist ungültig.");
  if (!solverResponse?.ok || !solverResponse.result) return failure("ELAB_MEASUREMENT_SOLVER_RESULT_REQUIRED", "Ein erfolgreiches Solverergebnis ist erforderlich.");
  const project = normalizedProject.project;
  const result = solverResponse.result;
  const document = project.circuit.document;
  const configuredAnalysis = project.simulation.analysisConfiguration.analysis;
  if (result.documentId !== document.id || result.documentVersion !== document.version || result.analysis !== configuredAnalysis) {
    return failure("ELAB_MEASUREMENT_SOLVER_RESULT_MISMATCH", "Solverergebnis passt nicht zum LabProject.");
  }
  const rawSamples = configuredAnalysis === "dc-operating-point"
    ? [{ timeS: 0, nodeVoltages: result.nodeVoltages }]
    : result.samples;
  const samples = normalizeSamples(rawSamples, document.nodes.map((node) => node.id));
  if (!samples) return failure("ELAB_MEASUREMENT_TRACE_INVALID", "Solverergebnis enthält keine vollständige Knotenspannungsspur.");

  return deepFreeze({
    ok: true,
    trace: {
      schemaVersion: MEASUREMENT_TRACE_SCHEMA_VERSION,
      id: `${project.id}:node-voltage`,
      projectId: project.id,
      projectVersion: project.version,
      documentId: document.id,
      documentVersion: document.version,
      quantity: "node-voltage",
      unit: "V",
      analysis: configuredAnalysis,
      samples,
      modelVersions: {
        ...project.simulation.modelVersions,
        ...solverModelVersions(result),
      },
    },
  });
}

export function readVoltageProbes({ labProject, trace } = {}) {
  const normalizedProject = normalizeLabProject(labProject);
  if (!normalizedProject.ok) return failure("ELAB_MEASUREMENT_PROJECT_INVALID", normalizedProject.errors[0]?.message || "LabProject ist ungültig.");
  const project = normalizedProject.project;
  if (!trace || trace.schemaVersion !== MEASUREMENT_TRACE_SCHEMA_VERSION || trace.projectId !== project.id || trace.projectVersion !== project.version || trace.quantity !== "node-voltage" || trace.unit !== "V") {
    return failure("ELAB_MEASUREMENT_TRACE_INVALID", "MeasurementTrace passt nicht zum LabProject.");
  }
  const samples = normalizeSamples(trace.samples, project.circuit.document.nodes.map((node) => node.id));
  if (!samples) return failure("ELAB_MEASUREMENT_TRACE_INVALID", "MeasurementTrace enthält ungültige Samples.");
  const setup = project.instruments.measurementSetup;
  const points = new Map(setup.points.map((point) => [point.id, point]));
  const probes = setup.voltageProbes.map((probe) => {
    const positive = points.get(probe.positivePointId);
    const reference = points.get(probe.referencePointId);
    const probeSamples = samples.map((sample) => {
      const voltages = new Map(sample.nodeVoltages.map((entry) => [entry.nodeId, entry.voltageV]));
      return { timeS: sample.timeS, value: voltages.get(positive.nodeId) - voltages.get(reference.nodeId) };
    });
    return {
      probeId: probe.id,
      label: probe.label,
      positivePointId: positive.id,
      referencePointId: reference.id,
      quantity: "voltage",
      unit: "V",
      samples: probeSamples,
      latestValue: probeSamples.at(-1).value,
    };
  });
  return deepFreeze({ ok: true, probes });
}

