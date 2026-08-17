import { solveDeterministicLinearSystem } from "../learning-solver/dc-operating-point.mjs";
import { normalizeCircuitDocument } from "./circuit-document-contract.mjs";

export const FREE_TRANSIENT_MODEL = Object.freeze({
  schemaVersion: "1.0.0",
  modelVersion: "1.0.0",
  analysis: "transient-step-response",
  integration: "backward-euler",
  supportedComponentTypes: Object.freeze(["gnd", "dc-voltage-source", "resistor", "capacitor", "inductor", "push-button"]),
  limits: Object.freeze({
    minTimeStepS: 1e-6,
    maxTimeStepS: 1e-2,
    maxStopTimeS: 1,
    maxSteps: 1_000,
    closedButtonResistanceOhm: 0.1,
  }),
  initialConditions: Object.freeze({ capacitorVoltageV: 0, inductorCurrentA: 0 }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message, details = {}) {
  return deepFreeze({ ok: false, errorSource: "free-transient-learning-solver", errors: [{ code, message, ...details }] });
}

function portNode(component, portId) {
  return component.ports.find((port) => port.id === portId)?.nodeId;
}

function orientedNodes(component) {
  if (["resistor", "capacitor", "inductor"].includes(component.type)) return [portNode(component, "p"), portNode(component, "n")];
  if (component.type === "push-button") return [portNode(component, "a"), portNode(component, "b")];
  return [portNode(component, "p"), portNode(component, "n")];
}

function createZeroMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function stampConductance(matrix, nodeIndex, groundNode, fromNode, toNode, conductanceS) {
  const from = fromNode === groundNode ? null : nodeIndex.get(fromNode);
  const to = toNode === groundNode ? null : nodeIndex.get(toNode);
  if (from !== null) matrix[from][from] += conductanceS;
  if (to !== null) matrix[to][to] += conductanceS;
  if (from !== null && to !== null) {
    matrix[from][to] -= conductanceS;
    matrix[to][from] -= conductanceS;
  }
}

function stampCurrent(rhs, nodeIndex, groundNode, positiveNode, negativeNode, currentA) {
  if (positiveNode !== groundNode) rhs[nodeIndex.get(positiveNode)] -= currentA;
  if (negativeNode !== groundNode) rhs[nodeIndex.get(negativeNode)] += currentA;
}

function stampBranch(matrix, rhs, nodeIndex, groundNode, branchIndex, positiveNode, negativeNode, diagonal, value) {
  if (positiveNode !== groundNode) {
    const positive = nodeIndex.get(positiveNode);
    matrix[positive][branchIndex] += 1;
    matrix[branchIndex][positive] += 1;
  }
  if (negativeNode !== groundNode) {
    const negative = nodeIndex.get(negativeNode);
    matrix[negative][branchIndex] -= 1;
    matrix[branchIndex][negative] -= 1;
  }
  matrix[branchIndex][branchIndex] += diagonal;
  rhs[branchIndex] += value;
}

function normalizeAnalysis(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["timeStepS", "stopTimeS"].includes(key))) {
    return failure("ELAB_TRANSIENT_ANALYSIS_INVALID", "Transientenparameter sind ungültig.");
  }
  const { timeStepS, stopTimeS } = input;
  if (!Number.isFinite(timeStepS) || timeStepS < FREE_TRANSIENT_MODEL.limits.minTimeStepS || timeStepS > FREE_TRANSIENT_MODEL.limits.maxTimeStepS) {
    return failure("ELAB_TRANSIENT_TIME_STEP_INVALID", "Zeitschritt liegt außerhalb der Modellgrenzen.");
  }
  if (!Number.isFinite(stopTimeS) || stopTimeS < timeStepS || stopTimeS > FREE_TRANSIENT_MODEL.limits.maxStopTimeS) {
    return failure("ELAB_TRANSIENT_STOP_TIME_INVALID", "Simulationsdauer liegt außerhalb der Modellgrenzen.");
  }
  const steps = Math.round(stopTimeS / timeStepS);
  if (steps > FREE_TRANSIENT_MODEL.limits.maxSteps) return failure("ELAB_TRANSIENT_STEP_LIMIT", "Maximale Anzahl Transientenschritte überschritten.");
  if (Math.abs(steps * timeStepS - stopTimeS) > Math.max(1e-12, stopTimeS * 1e-9)) {
    return failure("ELAB_TRANSIENT_TIME_GRID_INVALID", "Simulationsdauer muss ein ganzzahliges Vielfaches des Zeitschritts sein.");
  }
  return { ok: true, timeStepS, stopTimeS, steps };
}

export function simulateFreeTransient(document, analysis) {
  const normalized = normalizeCircuitDocument(document);
  if (!normalized.ok) return failure("ELAB_TRANSIENT_DOCUMENT_INVALID", normalized.errors[0]?.message || "Schaltungsdokument ist ungültig.");
  const config = normalizeAnalysis(analysis);
  if (!config.ok) return config;
  const circuit = normalized.document;
  const unsupported = circuit.components.filter((component) => !FREE_TRANSIENT_MODEL.supportedComponentTypes.includes(component.type));
  if (unsupported.length) return failure("ELAB_TRANSIENT_COMPONENT_UNSUPPORTED", "Transientenanalyse unterstützt die enthaltene Komponente noch nicht.", { componentIds: unsupported.map((component) => component.id) });
  const groundNodes = [...new Set(circuit.components.filter((component) => component.type === "gnd").map((component) => portNode(component, "0")))];
  if (groundNodes.length !== 1) return failure("ELAB_TRANSIENT_GROUND_REQUIRED", "Transientenanalyse benötigt genau einen gemeinsamen GND-Knoten.");
  const groundNode = groundNodes[0];
  const activeComponents = circuit.components.filter((component) => component.type !== "gnd");
  if (!activeComponents.length) return failure("ELAB_TRANSIENT_COMPONENT_REQUIRED", "Transientenanalyse benötigt mindestens eine aktive Komponente.");

  const nonGroundNodes = circuit.nodes.map((node) => node.id).filter((nodeId) => nodeId !== groundNode);
  const nodeIndex = new Map(nonGroundNodes.map((nodeId, index) => [nodeId, index]));
  const branchComponents = activeComponents.filter((component) => component.type === "dc-voltage-source" || component.type === "inductor");
  const branchIndex = new Map(branchComponents.map((component, index) => [component.id, nonGroundNodes.length + index]));
  const dimension = nonGroundNodes.length + branchComponents.length;
  if (!dimension) return failure("ELAB_TRANSIENT_SYSTEM_EMPTY", "Transientensystem besitzt keine Unbekannten.");

  let previousCapacitorVoltage = new Map(activeComponents.filter((component) => component.type === "capacitor").map((component) => [component.id, 0]));
  let previousInductorCurrent = new Map(activeComponents.filter((component) => component.type === "inductor").map((component) => [component.id, 0]));
  const zeroNodes = circuit.nodes.map((node) => Object.freeze({ nodeId: node.id, voltageV: 0 }));
  const samples = [Object.freeze({ timeS: 0, nodeVoltages: Object.freeze(zeroNodes), branches: Object.freeze([]) })];

  for (let step = 1; step <= config.steps; step += 1) {
    const matrix = createZeroMatrix(dimension);
    const rhs = Array(dimension).fill(0);
    for (const component of activeComponents) {
      const [positiveNode, negativeNode] = orientedNodes(component);
      if (component.type === "resistor") {
        stampConductance(matrix, nodeIndex, groundNode, positiveNode, negativeNode, 1 / component.parameters.resistance.value);
      } else if (component.type === "push-button") {
        if (component.parameters.state.value === "closed") stampConductance(matrix, nodeIndex, groundNode, positiveNode, negativeNode, 1 / FREE_TRANSIENT_MODEL.limits.closedButtonResistanceOhm);
      } else if (component.type === "capacitor") {
        const conductanceS = component.parameters.capacitance.value / config.timeStepS;
        stampConductance(matrix, nodeIndex, groundNode, positiveNode, negativeNode, conductanceS);
        stampCurrent(rhs, nodeIndex, groundNode, positiveNode, negativeNode, -conductanceS * previousCapacitorVoltage.get(component.id));
      } else if (component.type === "dc-voltage-source") {
        stampBranch(matrix, rhs, nodeIndex, groundNode, branchIndex.get(component.id), positiveNode, negativeNode, 0, component.parameters.voltage.value);
      } else if (component.type === "inductor") {
        const equivalentResistance = component.parameters.inductance.value / config.timeStepS;
        stampBranch(matrix, rhs, nodeIndex, groundNode, branchIndex.get(component.id), positiveNode, negativeNode, -equivalentResistance, -equivalentResistance * previousInductorCurrent.get(component.id));
      }
    }
    const solved = solveDeterministicLinearSystem(matrix, rhs);
    if (!solved.ok) return failure(`ELAB_TRANSIENT_${solved.code}`, solved.message, { step, timeS: step * config.timeStepS });
    const voltageByNode = new Map([[groundNode, 0], ...nonGroundNodes.map((nodeId) => [nodeId, solved.solution[nodeIndex.get(nodeId)]])]);
    const nextCapacitorVoltage = new Map();
    const nextInductorCurrent = new Map();
    const branches = [];
    for (const component of activeComponents) {
      const [fromNode, toNode] = orientedNodes(component);
      const voltageV = voltageByNode.get(fromNode) - voltageByNode.get(toNode);
      let currentA = 0;
      if (component.type === "resistor") currentA = voltageV / component.parameters.resistance.value;
      else if (component.type === "push-button") currentA = component.parameters.state.value === "closed" ? voltageV / FREE_TRANSIENT_MODEL.limits.closedButtonResistanceOhm : 0;
      else if (component.type === "capacitor") {
        currentA = component.parameters.capacitance.value * (voltageV - previousCapacitorVoltage.get(component.id)) / config.timeStepS;
        nextCapacitorVoltage.set(component.id, voltageV);
      } else if (component.type === "inductor") {
        currentA = solved.solution[branchIndex.get(component.id)];
        nextInductorCurrent.set(component.id, currentA);
      } else currentA = solved.solution[branchIndex.get(component.id)];
      if (Math.abs(voltageV) > circuit.modelLimits.maxVoltageV * (1 + 1e-9) || Math.abs(currentA) > circuit.modelLimits.maxCurrentA * (1 + 1e-9)) {
        return failure("ELAB_TRANSIENT_RESULT_LIMIT", "Transientenergebnis überschreitet die Schaltungsgrenzen.", { step, componentId: component.id });
      }
      branches.push(Object.freeze({ componentId: component.id, componentType: component.type, fromNode, toNode, voltageV, currentA, powerW: voltageV * currentA }));
    }
    previousCapacitorVoltage = nextCapacitorVoltage;
    previousInductorCurrent = nextInductorCurrent;
    samples.push(Object.freeze({
      timeS: step * config.timeStepS,
      nodeVoltages: Object.freeze(circuit.nodes.map((node) => Object.freeze({ nodeId: node.id, voltageV: voltageByNode.get(node.id) }))),
      branches: Object.freeze(branches),
    }));
  }
  return deepFreeze({
    ok: true,
    result: {
      documentId: circuit.id,
      documentVersion: circuit.version,
      analysis: FREE_TRANSIENT_MODEL.analysis,
      timeStepS: config.timeStepS,
      stopTimeS: config.stopTimeS,
      sampleCount: samples.length,
      samples,
      diagnostics: {
        solver: "deterministic-linear-mna",
        integration: FREE_TRANSIENT_MODEL.integration,
        sourceApplication: "dc-source-step-at-zero-plus",
        initialDynamicState: "zero",
        closedButtonResistanceOhm: FREE_TRANSIENT_MODEL.limits.closedButtonResistanceOhm,
      },
      modelVersion: FREE_TRANSIENT_MODEL.modelVersion,
    },
  });
}

