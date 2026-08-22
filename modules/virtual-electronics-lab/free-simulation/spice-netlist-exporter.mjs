import { normalizeSimulationRequest } from "./simulation-request-contract.mjs";

export const SPICE_NETLIST_EXPORT_MODEL = Object.freeze({
  schemaVersion: "1.0.0",
  dialect: "gernetix-linear-spice-subset-1",
  supportedComponentTypes: Object.freeze(["gnd", "dc-voltage-source", "resistor", "capacitor", "inductor"]),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message, details = {}) {
  return deepFreeze({ ok: false, errorSource: "spice-netlist-exporter", errors: [{ code, message, ...details }] });
}

function portNode(component, portId) {
  return component.ports.find((port) => port.id === portId)?.nodeId;
}

function formatNumber(value) {
  if (Object.is(value, -0) || value === 0) return "0";
  return Number(value.toPrecision(12)).toString();
}

function componentPrefix(type) {
  return {
    "dc-voltage-source": "V",
    resistor: "R",
    capacitor: "C",
    inductor: "L",
  }[type];
}

function componentNodes(component) {
  if (component.type === "dc-voltage-source") return [portNode(component, "p"), portNode(component, "n")];
  return [portNode(component, "p"), portNode(component, "n")];
}

function componentValue(component, analysis) {
  if (component.type === "dc-voltage-source") {
    const dc = `DC ${formatNumber(component.parameters.voltage.value)}`;
    if (analysis.type !== "ac-sweep" || component.id !== analysis.excitation.sourceComponentId) return dc;
    return `${dc} AC ${formatNumber(analysis.excitation.amplitudeV)} ${formatNumber(analysis.excitation.phaseDeg)}`;
  }
  const parameter = { resistor: "resistance", capacitor: "capacitance", inductor: "inductance" }[component.type];
  return formatNumber(component.parameters[parameter].value);
}

export function exportSpiceNetlist(input) {
  const normalized = normalizeSimulationRequest(input);
  if (!normalized.ok) return failure("ELAB_SPICE_REQUEST_INVALID", "Der Simulationsauftrag kann nicht exportiert werden.", { cause: normalized.errors[0]?.code || "ELAB_SIMULATION_REQUEST_INVALID" });
  const { circuit, analysis } = normalized.request;
  const unsupported = circuit.components.filter((component) => !SPICE_NETLIST_EXPORT_MODEL.supportedComponentTypes.includes(component.type));
  if (unsupported.length) {
    return failure("ELAB_SPICE_COMPONENT_UNSUPPORTED", "Die SPICE-Netlist unterstützt die enthaltene Komponente noch nicht.", {
      componentIds: unsupported.map((component) => component.id),
    });
  }
  const groundNodes = [...new Set(circuit.components.filter((component) => component.type === "gnd").map((component) => portNode(component, "0")))];
  if (groundNodes.length !== 1) return failure("ELAB_SPICE_GROUND_REQUIRED", "Der SPICE-Export benötigt genau einen gemeinsamen GND-Knoten.");
  const active = circuit.components.filter((component) => component.type !== "gnd");
  if (!active.length) return failure("ELAB_SPICE_COMPONENT_REQUIRED", "Der SPICE-Export benötigt mindestens eine aktive Komponente.");

  const groundNode = groundNodes[0];
  const nodeNames = new Map([[groundNode, "0"]]);
  circuit.nodes.filter((node) => node.id !== groundNode).forEach((node, index) => nodeNames.set(node.id, `n${String(index + 1).padStart(3, "0")}`));
  const counts = new Map();
  const componentNames = new Map();
  for (const component of active) {
    const prefix = componentPrefix(component.type);
    const count = (counts.get(prefix) || 0) + 1;
    counts.set(prefix, count);
    componentNames.set(component.id, `${prefix}${count}`);
  }

  const lines = [
    "* GerNetiX deterministic SPICE netlist",
    `* dialect: ${SPICE_NETLIST_EXPORT_MODEL.dialect}`,
    `* circuit: ${circuit.id} ${circuit.version}`,
    `* analysis: ${analysis.type}`,
  ];
  for (const node of circuit.nodes) lines.push(`* node ${nodeNames.get(node.id)} = ${node.id}`);
  for (const component of active) {
    const name = componentNames.get(component.id);
    lines.push(`* component ${name} = ${component.id}`);
    const [positive, negative] = componentNodes(component);
    lines.push(`${name} ${nodeNames.get(positive)} ${nodeNames.get(negative)} ${componentValue(component, analysis)}`);
  }
  if (analysis.type === "dc-operating-point") lines.push(".op");
  else if (analysis.type === "transient") lines.push(`.tran ${formatNumber(analysis.timeStepS)} ${formatNumber(analysis.stopTimeS)} 0 UIC`);
  else lines.push(`.ac dec ${analysis.pointsPerDecade} ${formatNumber(analysis.startFrequencyHz)} ${formatNumber(analysis.stopFrequencyHz)}`);
  lines.push(".end");
  const netlist = `${lines.join("\n")}\n`;

  return deepFreeze({
    ok: true,
    result: {
      schemaVersion: SPICE_NETLIST_EXPORT_MODEL.schemaVersion,
      dialect: SPICE_NETLIST_EXPORT_MODEL.dialect,
      circuitId: circuit.id,
      circuitVersion: circuit.version,
      analysisType: analysis.type,
      netlist,
      mappings: {
        nodes: circuit.nodes.map((node) => ({ circuitNodeId: node.id, spiceNode: nodeNames.get(node.id) })),
        components: active.map((component) => ({ circuitComponentId: component.id, spiceElement: componentNames.get(component.id) })),
      },
    },
  });
}
