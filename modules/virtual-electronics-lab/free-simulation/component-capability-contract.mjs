import { CIRCUIT_DOCUMENT_CONTRACT } from "./circuit-document-contract.mjs";

const ANALYSIS_TYPES = Object.freeze(["dc", "transient", "ac"]);

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

const DEFINITIONS = {
  gnd: {
    componentType: "gnd",
    model: "ideal-reference",
    analyses: { dc: true, transient: true, ac: true },
    netlist: true,
  },
  "dc-voltage-source": {
    componentType: "dc-voltage-source",
    model: "ideal-voltage-source",
    analyses: { dc: true, transient: true, ac: true },
    netlist: true,
  },
  resistor: {
    componentType: "resistor",
    model: "linear-resistor",
    analyses: { dc: true, transient: true, ac: true },
    netlist: true,
  },
  capacitor: {
    componentType: "capacitor",
    model: "linear-capacitor",
    analyses: { dc: false, transient: true, ac: true },
    netlist: true,
    limitation: "Der aktuelle DC-Lernsolver unterstützt den Kondensator noch nicht.",
  },
  inductor: {
    componentType: "inductor",
    model: "linear-inductor",
    analyses: { dc: false, transient: true, ac: true },
    netlist: true,
    limitation: "Der aktuelle DC-Lernsolver unterstützt die Spule noch nicht.",
  },
  led: {
    componentType: "led",
    model: "not-modeled",
    analyses: { dc: false, transient: false, ac: false },
    netlist: false,
    limitation: "Das LED-Modell ist für den SPICE-/Solverpfad noch nicht freigegeben.",
  },
  "push-button": {
    componentType: "push-button",
    model: "static-switch",
    analyses: { dc: false, transient: true, ac: false },
    netlist: false,
    limitation: "Der Taster ist nur im begrenzten Transienten-Lernmodell verfügbar.",
  },
};

export const COMPONENT_CAPABILITY_CONTRACT = freeze({
  schemaVersion: "1.0.0",
  supportedAnalysisTypes: ANALYSIS_TYPES,
  supportedComponentTypes: CIRCUIT_DOCUMENT_CONTRACT.supportedComponentTypes,
  definitions: DEFINITIONS,
});

const ERRORS = Object.freeze({
  REQUIRED: Object.freeze({
    code: "ELAB_SPICE_CAPABILITY_REQUIRED",
    message: "Eine Liste funktionaler Komponententypen ist erforderlich.",
  }),
  UNKNOWN_TYPE: Object.freeze({
    code: "ELAB_SPICE_CAPABILITY_TYPE_UNKNOWN",
    message: "Der Komponententyp ist im Capability-Vertrag nicht bekannt.",
  }),
  INVALID_TYPE: Object.freeze({
    code: "ELAB_SPICE_CAPABILITY_TYPE_INVALID",
    message: "Der Komponententyp muss als nichtleerer String vorliegen.",
  }),
});

function failure(error, details = {}) {
  return freeze({ ok: false, errors: [{ ...error, ...details }] });
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function capabilityFor(type) {
  if (typeof type !== "string" || !type.trim()) return failure(ERRORS.INVALID_TYPE);
  const normalizedType = type.trim();
  const capability = DEFINITIONS[normalizedType];
  if (!capability) return failure(ERRORS.UNKNOWN_TYPE, { componentType: normalizedType });
  return freeze({ ok: true, capability });
}

export function getComponentCapability(componentType) {
  return capabilityFor(componentType);
}

export function normalizeComponentCapabilities(componentTypes) {
  if (!Array.isArray(componentTypes) || componentTypes.length === 0) return failure(ERRORS.REQUIRED);
  const uniqueTypes = new Set();
  for (const type of componentTypes) {
    if (typeof type !== "string" || !type.trim()) return failure(ERRORS.INVALID_TYPE);
    const normalizedType = type.trim();
    if (!DEFINITIONS[normalizedType]) return failure(ERRORS.UNKNOWN_TYPE, { componentType: normalizedType });
    uniqueTypes.add(normalizedType);
  }
  const capabilities = [...uniqueTypes]
    .sort(compareText)
    .map((type) => DEFINITIONS[type]);
  return freeze({
    ok: true,
    schemaVersion: COMPONENT_CAPABILITY_CONTRACT.schemaVersion,
    capabilities,
  });
}

export const validateComponentCapabilities = normalizeComponentCapabilities;
