const COMPONENT_TYPES = Object.freeze([
  "gnd",
  "dc-voltage-source",
  "resistor",
  "capacitor",
  "inductor",
  "led",
  "push-button",
]);

const COMPONENT_PORTS = Object.freeze({
  gnd: Object.freeze(["0"]),
  "dc-voltage-source": Object.freeze(["p", "n"]),
  resistor: Object.freeze(["p", "n"]),
  capacitor: Object.freeze(["p", "n"]),
  inductor: Object.freeze(["p", "n"]),
  led: Object.freeze(["anode", "cathode"]),
  "push-button": Object.freeze(["a", "b"]),
});

const COMPONENT_PARAMETERS = Object.freeze({
  gnd: Object.freeze([]),
  "dc-voltage-source": Object.freeze(["voltage"]),
  resistor: Object.freeze(["resistance"]),
  capacitor: Object.freeze(["capacitance"]),
  inductor: Object.freeze(["inductance"]),
  led: Object.freeze(["forwardVoltage", "dynamicResistance"]),
  "push-button": Object.freeze(["state"]),
});

const PARAMETER_UNITS = Object.freeze({
  voltage: "V",
  resistance: "Ω",
  capacitance: "F",
  inductance: "H",
  forwardVoltage: "V",
  dynamicResistance: "Ω",
  state: "state",
});

const PARAMETER_RANGES = Object.freeze({
  resistance: Object.freeze({ minimum: 1e-6, maximum: 1e12 }),
  capacitance: Object.freeze({ minimum: 1e-12, maximum: 1 }),
  inductance: Object.freeze({ minimum: 1e-9, maximum: 1e3 }),
  dynamicResistance: Object.freeze({ minimum: 0, maximum: 1e6 }),
});

const MAX_COMPONENTS = 32;
const MAX_NODES = 64;
const ID_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/i;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

export const CIRCUIT_DOCUMENT_CONTRACT = Object.freeze({
  schemaVersion: "1.0.0",
  supportedComponentTypes: COMPONENT_TYPES,
  maxComponents: MAX_COMPONENTS,
  maxNodes: MAX_NODES,
  modelLimits: Object.freeze({
    maxVoltageV: 24,
    maxCurrentA: 5,
  }),
  componentDefinitions: Object.freeze(
    Object.fromEntries(COMPONENT_TYPES.map((type) => [
      type,
      Object.freeze({
        ports: COMPONENT_PORTS[type],
        parameters: COMPONENT_PARAMETERS[type],
      }),
    ])),
  ),
});

const ERRORS = Object.freeze({
  REQUIRED: Object.freeze({ code: "ELAB_FREE_DOCUMENT_REQUIRED", message: "Ein CircuitDocument-Objekt ist erforderlich." }),
  UNKNOWN_KEYS: Object.freeze({ code: "ELAB_FREE_UNKNOWN_KEYS", message: "Das CircuitDocument enthält unbekannte Felder." }),
  ID_INVALID: Object.freeze({ code: "ELAB_FREE_ID_INVALID", message: "Eine stabile ID ist ungültig." }),
  VERSION_INVALID: Object.freeze({ code: "ELAB_FREE_VERSION_INVALID", message: "Die Version muss als SemVer-String vorliegen." }),
  LIMITS_INVALID: Object.freeze({ code: "ELAB_FREE_MODEL_LIMITS_INVALID", message: "Die Modellgrenzen sind ungültig." }),
  NODES_INVALID: Object.freeze({ code: "ELAB_FREE_NODES_INVALID", message: "Die Knotenliste ist ungültig." }),
  COMPONENTS_INVALID: Object.freeze({ code: "ELAB_FREE_COMPONENTS_INVALID", message: "Die Komponentenliste ist ungültig." }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function validId(value) {
  return typeof value === "string" && value.trim() === value && ID_PATTERN.test(value) && !CONTROL_CHARACTER_PATTERN.test(value);
}

function number(value, { positive = false, nonNegative = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (positive && value <= 0) return false;
  if (nonNegative && value < 0) return false;
  return true;
}

function fail(error) {
  return deepFreeze({ ok: false, errors: [error] });
}

function normalizeLimits(input) {
  const source = input === undefined ? {} : input;
  if (!isObject(source) || Object.keys(source).some((key) => !["maxVoltageV", "maxCurrentA"].includes(key))) return null;
  const maxVoltageV = source.maxVoltageV ?? CIRCUIT_DOCUMENT_CONTRACT.modelLimits.maxVoltageV;
  const maxCurrentA = source.maxCurrentA ?? CIRCUIT_DOCUMENT_CONTRACT.modelLimits.maxCurrentA;
  if (!number(maxVoltageV, { positive: true }) || !number(maxCurrentA, { positive: true })) return null;
  if (maxVoltageV > CIRCUIT_DOCUMENT_CONTRACT.modelLimits.maxVoltageV || maxCurrentA > CIRCUIT_DOCUMENT_CONTRACT.modelLimits.maxCurrentA) return null;
  return { maxVoltageV, maxCurrentA };
}

function normalizeParameter(name, parameter, limits) {
  if (!isObject(parameter) || Object.keys(parameter).some((key) => !["value", "unit"].includes(key))) return null;
  const expectedUnit = PARAMETER_UNITS[name];
  if (name === "state") {
    if (parameter.unit !== expectedUnit || !["open", "closed"].includes(parameter.value)) return null;
    return { value: parameter.value, unit: expectedUnit };
  }
  if (parameter.unit !== expectedUnit || !number(parameter.value, { nonNegative: name === "dynamicResistance" })) return null;
  if (name === "voltage" && Math.abs(parameter.value) > limits.maxVoltageV) return null;
  if (name === "forwardVoltage" && (parameter.value <= 0 || parameter.value > limits.maxVoltageV)) return null;
  const range = PARAMETER_RANGES[name];
  if (range && (parameter.value < range.minimum || parameter.value > range.maximum)) return null;
  return { value: parameter.value, unit: expectedUnit };
}

export function normalizeCircuitDocument(input) {
  if (!isObject(input)) return fail(ERRORS.REQUIRED);
  const allowed = ["schemaVersion", "id", "version", "nodes", "components", "modelLimits"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) return fail(ERRORS.UNKNOWN_KEYS);
  if (input.schemaVersion !== undefined && input.schemaVersion !== CIRCUIT_DOCUMENT_CONTRACT.schemaVersion) return fail(ERRORS.VERSION_INVALID);
  if (!validId(input.id) || input.id.length > 64) return fail(ERRORS.ID_INVALID);
  if (typeof input.version !== "string" || !SEMVER_PATTERN.test(input.version)) return fail(ERRORS.VERSION_INVALID);
  const limits = normalizeLimits(input.modelLimits);
  if (!limits) return fail(ERRORS.LIMITS_INVALID);
  if (!Array.isArray(input.nodes) || input.nodes.length > MAX_NODES) return fail(ERRORS.NODES_INVALID);
  const nodes = [];
  const nodeIds = new Set();
  for (const node of input.nodes) {
    if (!isObject(node) || Object.keys(node).some((key) => !["id", "label"].includes(key)) || !validId(node.id) || nodeIds.has(node.id)) return fail(ERRORS.NODES_INVALID);
    if (node.label !== undefined && (typeof node.label !== "string" || !node.label.trim() || node.label.length > 80 || CONTROL_CHARACTER_PATTERN.test(node.label))) return fail(ERRORS.NODES_INVALID);
    nodeIds.add(node.id);
    nodes.push({ id: node.id, ...(node.label === undefined ? {} : { label: node.label.trim() }) });
  }
  if (!Array.isArray(input.components) || input.components.length > MAX_COMPONENTS) return fail(ERRORS.COMPONENTS_INVALID);
  const components = [];
  const componentIds = new Set();
  for (const component of input.components) {
    if (!isObject(component) || Object.keys(component).some((key) => !["id", "type", "ports", "parameters"].includes(key))) return fail(ERRORS.COMPONENTS_INVALID);
    if (!validId(component.id) || componentIds.has(component.id) || !COMPONENT_TYPES.includes(component.type)) return fail(ERRORS.COMPONENTS_INVALID);
    const expectedPorts = COMPONENT_PORTS[component.type];
    if (!Array.isArray(component.ports) || component.ports.length !== expectedPorts.length) return fail(ERRORS.COMPONENTS_INVALID);
    const ports = [];
    const seenPorts = new Set();
    for (const port of component.ports) {
      if (!isObject(port) || Object.keys(port).some((key) => key !== "id" && key !== "nodeId") || !expectedPorts.includes(port.id) || seenPorts.has(port.id) || !validId(port.nodeId) || !nodeIds.has(port.nodeId)) return fail(ERRORS.COMPONENTS_INVALID);
      seenPorts.add(port.id);
      ports.push({ id: port.id, nodeId: port.nodeId });
    }
    if (seenPorts.size !== expectedPorts.length) return fail(ERRORS.COMPONENTS_INVALID);
    ports.sort((left, right) => expectedPorts.indexOf(left.id) - expectedPorts.indexOf(right.id));
    if (!isObject(component.parameters)) return fail(ERRORS.COMPONENTS_INVALID);
    const expectedParameters = COMPONENT_PARAMETERS[component.type];
    if (Object.keys(component.parameters).some((key) => !expectedParameters.includes(key)) || expectedParameters.some((key) => !(key in component.parameters))) return fail(ERRORS.COMPONENTS_INVALID);
    const parameters = {};
    for (const name of expectedParameters) {
      const normalized = normalizeParameter(name, component.parameters[name], limits);
      if (!normalized) return fail(ERRORS.COMPONENTS_INVALID);
      parameters[name] = normalized;
    }
    componentIds.add(component.id);
    components.push({ id: component.id, type: component.type, ports, parameters });
  }
  nodes.sort((a, b) => compareText(a.id, b.id));
  components.sort((a, b) => compareText(a.id, b.id));
  return deepFreeze({
    ok: true,
    document: {
      schemaVersion: CIRCUIT_DOCUMENT_CONTRACT.schemaVersion,
      id: input.id,
      version: input.version,
      nodes,
      components,
      modelLimits: limits,
    },
  });
}

export const validateCircuitDocument = normalizeCircuitDocument;
