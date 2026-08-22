import {
  DC_OPERATING_POINT_ANALYSIS,
  DC_SOLVER_MODEL_VERSION,
  DC_SOLVER_SCHEMA_VERSION,
  solveDcOperatingPoint,
} from "../learning-solver/dc-operating-point.mjs";
import { normalizeCircuitDocument } from "./circuit-document-contract.mjs";

export const FREE_DC_ADAPTER_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-free-dc-learning-solver-adapter",
  modelVersion: "1.0.0",
  supportedComponentTypes: Object.freeze(["gnd", "dc-voltage-source", "resistor"]),
  solverSchemaVersion: DC_SOLVER_SCHEMA_VERSION,
  solverModelVersion: DC_SOLVER_MODEL_VERSION,
});

function frozenFailure(code, message, details = {}) {
  return Object.freeze({
    ok: false,
    errorSource: "free-dc-adapter",
    errors: Object.freeze([Object.freeze({ code, message, ...details })]),
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function portNode(component, portId) {
  return component.ports.find((port) => port.id === portId)?.nodeId;
}

export function simulateFreeDcOperatingPoint(document) {
  const normalized = normalizeCircuitDocument(document);
  if (!normalized.ok) {
    return frozenFailure("ELAB_FREE_DC_DOCUMENT_INVALID", normalized.errors[0]?.message || "Schaltungsdokument ist ungültig.", {
      cause: normalized.errors[0]?.code || "ELAB_FREE_UNKNOWN",
    });
  }

  const circuitDocument = normalized.document;
  const unsupported = circuitDocument.components.filter((component) => !FREE_DC_ADAPTER_MODEL.supportedComponentTypes.includes(component.type));
  if (unsupported.length) {
    return frozenFailure(
      "ELAB_FREE_DC_COMPONENT_UNSUPPORTED",
      "Die erste DC-Analyse unterstützt nur GND, ideale Spannungsquellen und Widerstände.",
      { componentIds: Object.freeze(unsupported.map((component) => component.id)) },
    );
  }

  const groundNodes = [...new Set(circuitDocument.components
    .filter((component) => component.type === "gnd")
    .map((component) => portNode(component, "0")))];
  if (groundNodes.length !== 1) {
    return frozenFailure("ELAB_FREE_DC_GROUND_REQUIRED", "Die DC-Analyse benötigt genau einen gemeinsamen GND-Knoten.");
  }

  const components = circuitDocument.components
    .filter((component) => component.type !== "gnd")
    .map((component) => component.type === "resistor"
      ? {
        id: component.id,
        type: "resistor",
        fromNode: portNode(component, "p"),
        toNode: portNode(component, "n"),
        resistanceOhm: component.parameters.resistance.value,
      }
      : {
        id: component.id,
        type: "dc-voltage-source",
        positiveNode: portNode(component, "p"),
        negativeNode: portNode(component, "n"),
        voltageV: component.parameters.voltage.value,
      });
  if (!components.length) return frozenFailure("ELAB_FREE_DC_COMPONENT_REQUIRED", "Die DC-Analyse benötigt mindestens eine Quelle oder einen Widerstand.");

  const solved = solveDcOperatingPoint({
    schemaVersion: DC_SOLVER_SCHEMA_VERSION,
    analysis: DC_OPERATING_POINT_ANALYSIS,
    groundNode: groundNodes[0],
    components,
  });
  if (!solved.ok) {
    return deepFreeze({
      ok: false,
      errorSource: "dc-learning-solver",
      errors: solved.errors,
    });
  }

  return {
    ok: true,
    result: deepFreeze({
      documentId: circuitDocument.id,
      documentVersion: circuitDocument.version,
      analysis: solved.analysis,
      groundNode: solved.groundNode,
      nodeVoltages: solved.nodeVoltages,
      branches: solved.branches,
      diagnostics: solved.diagnostics,
      modelVersions: {
        adapter: FREE_DC_ADAPTER_MODEL.modelVersion,
        solver: DC_SOLVER_MODEL_VERSION,
      },
    }),
  };
}
