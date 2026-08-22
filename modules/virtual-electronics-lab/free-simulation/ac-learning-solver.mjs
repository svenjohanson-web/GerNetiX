import { solveDeterministicLinearSystem } from "../learning-solver/dc-operating-point.mjs";
import { normalizeSimulationRequest } from "./simulation-request-contract.mjs";

export const FREE_AC_MODEL = Object.freeze({
  schemaVersion: "1.0.0",
  modelVersion: "1.0.0",
  analysis: "ac-sweep",
  sweep: "decade",
  supportedComponentTypes: Object.freeze(["gnd", "dc-voltage-source", "resistor", "capacitor", "inductor"]),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message, details = {}) {
  return deepFreeze({ ok: false, errorSource: "free-ac-learning-solver", errors: [{ code, message, ...details }] });
}

function portNode(component, portId) {
  return component.ports.find((port) => port.id === portId)?.nodeId;
}

function complex(real = 0, imaginary = 0) {
  return { real, imaginary };
}

function addComplex(target, value) {
  target.real += value.real;
  target.imaginary += value.imaginary;
}

function subtract(left, right) {
  return complex(left.real - right.real, left.imaginary - right.imaginary);
}

function multiply(left, right) {
  return complex(
    (left.real * right.real) - (left.imaginary * right.imaginary),
    (left.real * right.imaginary) + (left.imaginary * right.real),
  );
}

function polar(magnitude, phaseDeg) {
  const phaseRad = phaseDeg * Math.PI / 180;
  return complex(magnitude * Math.cos(phaseRad), magnitude * Math.sin(phaseRad));
}

function observable(value) {
  const magnitude = Math.hypot(value.real, value.imaginary);
  return {
    real: Object.is(value.real, -0) ? 0 : value.real,
    imaginary: Object.is(value.imaginary, -0) ? 0 : value.imaginary,
    magnitude,
    phaseDeg: magnitude === 0 ? 0 : Math.atan2(value.imaginary, value.real) * 180 / Math.PI,
  };
}

function createMatrix(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => complex()));
}

function stampAdmittance(matrix, nodeIndex, groundNode, fromNode, toNode, admittance) {
  const from = fromNode === groundNode ? null : nodeIndex.get(fromNode);
  const to = toNode === groundNode ? null : nodeIndex.get(toNode);
  if (from !== null) addComplex(matrix[from][from], admittance);
  if (to !== null) addComplex(matrix[to][to], admittance);
  if (from !== null && to !== null) {
    addComplex(matrix[from][to], complex(-admittance.real, -admittance.imaginary));
    addComplex(matrix[to][from], complex(-admittance.real, -admittance.imaginary));
  }
}

function stampVoltageSource(matrix, rhs, nodeIndex, groundNode, branch, positiveNode, negativeNode, voltage) {
  if (positiveNode !== groundNode) {
    const positive = nodeIndex.get(positiveNode);
    addComplex(matrix[positive][branch], complex(1));
    addComplex(matrix[branch][positive], complex(1));
  }
  if (negativeNode !== groundNode) {
    const negative = nodeIndex.get(negativeNode);
    addComplex(matrix[negative][branch], complex(-1));
    addComplex(matrix[branch][negative], complex(-1));
  }
  addComplex(rhs[branch], voltage);
}

function solveComplexSystem(matrix, rhs) {
  const size = matrix.length;
  const realMatrix = Array.from({ length: size * 2 }, () => Array(size * 2).fill(0));
  const realRhs = Array(size * 2).fill(0);
  for (let row = 0; row < size; row += 1) {
    realRhs[row] = rhs[row].real;
    realRhs[row + size] = rhs[row].imaginary;
    for (let column = 0; column < size; column += 1) {
      const value = matrix[row][column];
      realMatrix[row][column] = value.real;
      realMatrix[row][column + size] = -value.imaginary;
      realMatrix[row + size][column] = value.imaginary;
      realMatrix[row + size][column + size] = value.real;
    }
  }
  const solved = solveDeterministicLinearSystem(realMatrix, realRhs);
  if (!solved.ok) return solved;
  return { ok: true, solution: Array.from({ length: size }, (_, index) => complex(solved.solution[index], solved.solution[index + size])) };
}

function frequencyGrid(analysis) {
  const span = Math.log10(analysis.stopFrequencyHz / analysis.startFrequencyHz);
  const wholeSteps = Math.floor((span * analysis.pointsPerDecade) + 1e-12);
  const frequencies = Array.from({ length: wholeSteps + 1 }, (_, index) => analysis.startFrequencyHz * (10 ** (index / analysis.pointsPerDecade)));
  const last = frequencies.at(-1);
  if (Math.abs(last - analysis.stopFrequencyHz) <= analysis.stopFrequencyHz * 1e-12) frequencies[frequencies.length - 1] = analysis.stopFrequencyHz;
  else frequencies.push(analysis.stopFrequencyHz);
  return frequencies;
}

function componentNodes(component) {
  return [portNode(component, "p"), portNode(component, "n")];
}

function branchCurrent(component, voltage, omega, sourceCurrent) {
  if (component.type === "resistor") return multiply(voltage, complex(1 / component.parameters.resistance.value));
  if (component.type === "capacitor") return multiply(voltage, complex(0, omega * component.parameters.capacitance.value));
  if (component.type === "inductor") return multiply(voltage, complex(0, -1 / (omega * component.parameters.inductance.value)));
  return sourceCurrent;
}

export function simulateFreeAcSweep(input) {
  const normalized = normalizeSimulationRequest(input);
  if (!normalized.ok) return failure("ELAB_AC_REQUEST_INVALID", "Der AC-Simulationsauftrag ist ungültig.", { cause: normalized.errors[0]?.code || "ELAB_SIMULATION_REQUEST_INVALID" });
  const { circuit, analysis } = normalized.request;
  if (analysis.type !== "ac-sweep") return failure("ELAB_AC_ANALYSIS_REQUIRED", "Der AC-Lernsolver benötigt eine AC-Sweep-Analyse.");
  const unsupported = circuit.components.filter((component) => !FREE_AC_MODEL.supportedComponentTypes.includes(component.type));
  if (unsupported.length) return failure("ELAB_AC_COMPONENT_UNSUPPORTED", "Die AC-Analyse unterstützt die enthaltene Komponente noch nicht.", { componentIds: unsupported.map((component) => component.id) });
  const groundNodes = [...new Set(circuit.components.filter((component) => component.type === "gnd").map((component) => portNode(component, "0")))];
  if (groundNodes.length !== 1) return failure("ELAB_AC_GROUND_REQUIRED", "Die AC-Analyse benötigt genau einen gemeinsamen GND-Knoten.");
  const groundNode = groundNodes[0];
  const active = circuit.components.filter((component) => component.type !== "gnd");
  const sources = active.filter((component) => component.type === "dc-voltage-source");
  if (!sources.length) return failure("ELAB_AC_SOURCE_REQUIRED", "Die AC-Analyse benötigt mindestens eine ideale Spannungsquelle.");
  const nonGroundNodes = circuit.nodes.map((node) => node.id).filter((nodeId) => nodeId !== groundNode);
  const nodeIndex = new Map(nonGroundNodes.map((nodeId, index) => [nodeId, index]));
  const branchIndex = new Map(sources.map((source, index) => [source.id, nonGroundNodes.length + index]));
  const dimension = nonGroundNodes.length + sources.length;
  const excitation = polar(analysis.excitation.amplitudeV, analysis.excitation.phaseDeg);
  const samples = [];

  for (const frequencyHz of frequencyGrid(analysis)) {
    const omega = 2 * Math.PI * frequencyHz;
    const matrix = createMatrix(dimension);
    const rhs = Array.from({ length: dimension }, () => complex());
    for (const component of active) {
      const [positiveNode, negativeNode] = componentNodes(component);
      if (component.type === "resistor") stampAdmittance(matrix, nodeIndex, groundNode, positiveNode, negativeNode, complex(1 / component.parameters.resistance.value));
      else if (component.type === "capacitor") stampAdmittance(matrix, nodeIndex, groundNode, positiveNode, negativeNode, complex(0, omega * component.parameters.capacitance.value));
      else if (component.type === "inductor") stampAdmittance(matrix, nodeIndex, groundNode, positiveNode, negativeNode, complex(0, -1 / (omega * component.parameters.inductance.value)));
      else stampVoltageSource(matrix, rhs, nodeIndex, groundNode, branchIndex.get(component.id), positiveNode, negativeNode, component.id === analysis.excitation.sourceComponentId ? excitation : complex());
    }
    const solved = solveComplexSystem(matrix, rhs);
    if (!solved.ok) return failure(`ELAB_AC_${solved.code}`, solved.message, { frequencyHz });
    const voltageByNode = new Map([[groundNode, complex()], ...nonGroundNodes.map((nodeId) => [nodeId, solved.solution[nodeIndex.get(nodeId)]])]);
    const nodeVoltages = circuit.nodes.map((node) => ({ nodeId: node.id, ...observable(voltageByNode.get(node.id)) }));
    const branches = active.map((component) => {
      const [fromNode, toNode] = componentNodes(component);
      const voltage = subtract(voltageByNode.get(fromNode), voltageByNode.get(toNode));
      const current = branchCurrent(component, voltage, omega, component.type === "dc-voltage-source" ? solved.solution[branchIndex.get(component.id)] : null);
      return { componentId: component.id, componentType: component.type, fromNode, toNode, voltage: observable(voltage), current: observable(current) };
    });
    if (nodeVoltages.some((node) => node.magnitude > circuit.modelLimits.maxVoltageV * (1 + 1e-9))
      || branches.some((branch) => branch.current.magnitude > circuit.modelLimits.maxCurrentA * (1 + 1e-9))) {
      return failure("ELAB_AC_RESULT_LIMIT", "AC-Ergebnis überschreitet die Schaltungsgrenzen.", { frequencyHz });
    }
    samples.push({ frequencyHz, nodeVoltages, branches });
  }

  return deepFreeze({
    ok: true,
    result: {
      documentId: circuit.id,
      documentVersion: circuit.version,
      analysis: FREE_AC_MODEL.analysis,
      sweep: FREE_AC_MODEL.sweep,
      excitation: analysis.excitation,
      sampleCount: samples.length,
      samples,
      diagnostics: { solver: "deterministic-complex-linear-mna", dynamicState: "small-signal-steady-state" },
      modelVersion: FREE_AC_MODEL.modelVersion,
    },
  });
}
