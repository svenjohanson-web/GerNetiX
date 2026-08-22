import {
  CIRCUIT_DOCUMENT_CONTRACT,
  normalizeCircuitDocument,
} from "./circuit-document-contract.mjs";

export const FREE_CIRCUIT_COMMAND_TYPES = Object.freeze({
  AddComponent: "AddComponent",
  RemoveComponent: "RemoveComponent",
  ConnectPins: "ConnectPins",
  DisconnectPin: "DisconnectPin",
  DisconnectNet: "DisconnectNet",
  SetComponentParameter: "SetComponentParameter",
  ResetCircuit: "ResetCircuit",
});

export const FREE_CIRCUIT_EMPTY_DOCUMENT = Object.freeze({
  schemaVersion: CIRCUIT_DOCUMENT_CONTRACT.schemaVersion,
  id: "free-circuit",
  version: "1.0.0",
  nodes: Object.freeze([]),
  components: Object.freeze([]),
  modelLimits: CIRCUIT_DOCUMENT_CONTRACT.modelLimits,
});

const DEFAULT_PARAMETERS = Object.freeze({
  gnd: Object.freeze({}),
  "dc-voltage-source": Object.freeze({ voltage: Object.freeze({ value: 5, unit: "V" }) }),
  resistor: Object.freeze({ resistance: Object.freeze({ value: 1_000, unit: "Ω" }) }),
  capacitor: Object.freeze({ capacitance: Object.freeze({ value: 1e-6, unit: "F" }) }),
  inductor: Object.freeze({ inductance: Object.freeze({ value: 1e-3, unit: "H" }) }),
  led: Object.freeze({
    forwardVoltage: Object.freeze({ value: 2, unit: "V" }),
    dynamicResistance: Object.freeze({ value: 10, unit: "Ω" }),
  }),
  "push-button": Object.freeze({ state: Object.freeze({ value: "open", unit: "state" }) }),
});

const COMMAND_KEYS = Object.freeze({
  [FREE_CIRCUIT_COMMAND_TYPES.AddComponent]: Object.freeze(["type", "componentId", "componentType", "parameters"]),
  [FREE_CIRCUIT_COMMAND_TYPES.RemoveComponent]: Object.freeze(["type", "componentId"]),
  [FREE_CIRCUIT_COMMAND_TYPES.ConnectPins]: Object.freeze(["type", "from", "to"]),
  [FREE_CIRCUIT_COMMAND_TYPES.DisconnectPin]: Object.freeze(["type", "componentId", "portId"]),
  [FREE_CIRCUIT_COMMAND_TYPES.DisconnectNet]: Object.freeze(["type", "nodeId"]),
  [FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter]: Object.freeze(["type", "componentId", "parameterName", "value"]),
  [FREE_CIRCUIT_COMMAND_TYPES.ResetCircuit]: Object.freeze(["type"]),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function failure(code, message, details = {}) {
  return Object.freeze({ ok: false, errors: Object.freeze([Object.freeze({ code, message, ...details })]) });
}

function componentById(document, componentId) {
  return document.components.find((component) => component.id === componentId) || null;
}

function portById(component, portId) {
  return component?.ports.find((port) => port.id === portId) || null;
}

function nextPrivateNodeId(document, componentId, portId) {
  const base = `${componentId}-${portId}`;
  const used = new Set(document.nodes.map((node) => node.id));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function pruneUnusedNodes(document) {
  const referenced = new Set(document.components.flatMap((component) => component.ports.map((port) => port.nodeId)));
  document.nodes = document.nodes.filter((node) => referenced.has(node.id));
}

function normalizedUpdate(draft) {
  const normalized = normalizeCircuitDocument(draft);
  if (!normalized.ok) {
    return failure(
      "ELAB_FREE_COMMAND_DOCUMENT_INVALID",
      normalized.errors[0]?.message || "Schaltungsdokument ist nach dem Befehl ungültig.",
      { cause: normalized.errors[0]?.code || "ELAB_FREE_UNKNOWN" },
    );
  }
  return { ok: true, document: normalized.document };
}

function applyAddComponent(document, command) {
  const definition = CIRCUIT_DOCUMENT_CONTRACT.componentDefinitions[command.componentType];
  if (!definition) return failure("ELAB_FREE_COMPONENT_TYPE_UNSUPPORTED", "Komponententyp ist nicht verfügbar.");
  if (typeof command.componentId !== "string" || componentById(document, command.componentId)) {
    return failure("ELAB_FREE_COMPONENT_ID_INVALID", "Komponenten-ID fehlt oder ist bereits vergeben.");
  }

  const draft = clone(document);
  const ports = definition.ports.map((portId) => {
    let nodeId = nextPrivateNodeId(draft, command.componentId, portId);
    if (command.componentType === "gnd" && !draft.nodes.some((node) => node.id === "gnd")) nodeId = "gnd";
    draft.nodes.push({ id: nodeId, label: nodeId === "gnd" ? "GND" : `${command.componentId}.${portId}` });
    return { id: portId, nodeId };
  });
  draft.components.push({
    id: command.componentId,
    type: command.componentType,
    ports,
    parameters: command.parameters === undefined ? clone(DEFAULT_PARAMETERS[command.componentType]) : clone(command.parameters),
  });
  return normalizedUpdate(draft);
}

function applyRemoveComponent(document, command) {
  if (!componentById(document, command.componentId)) return failure("ELAB_FREE_COMPONENT_NOT_FOUND", "Komponente wurde nicht gefunden.");
  const draft = clone(document);
  draft.components = draft.components.filter((component) => component.id !== command.componentId);
  pruneUnusedNodes(draft);
  return normalizedUpdate(draft);
}

function applyConnectPins(document, command) {
  const firstComponent = componentById(document, command.from?.componentId);
  const secondComponent = componentById(document, command.to?.componentId);
  const firstPort = portById(firstComponent, command.from?.portId);
  const secondPort = portById(secondComponent, command.to?.portId);
  if (!firstPort || !secondPort) return failure("ELAB_FREE_PORT_NOT_FOUND", "Mindestens ein Anschluss wurde nicht gefunden.");
  if (firstComponent.id === secondComponent.id && firstPort.id === secondPort.id) {
    return failure("ELAB_FREE_IDENTICAL_PORTS", "Ein Anschluss kann nicht mit sich selbst verbunden werden.");
  }

  const draft = clone(document);
  const canonicalNode = [firstPort.nodeId, secondPort.nodeId].includes("gnd")
    ? "gnd"
    : [firstPort.nodeId, secondPort.nodeId].sort()[0];
  const mergedNode = canonicalNode === firstPort.nodeId ? secondPort.nodeId : firstPort.nodeId;
  for (const component of draft.components) {
    for (const port of component.ports) {
      if (port.nodeId === mergedNode) port.nodeId = canonicalNode;
    }
  }
  pruneUnusedNodes(draft);
  return normalizedUpdate(draft);
}

function applyDisconnectPin(document, command) {
  const component = componentById(document, command.componentId);
  const port = portById(component, command.portId);
  if (!port) return failure("ELAB_FREE_PORT_NOT_FOUND", "Anschluss wurde nicht gefunden.");
  const attachedCount = document.components.flatMap((entry) => entry.ports).filter((entry) => entry.nodeId === port.nodeId).length;
  if (attachedCount < 2) return failure("ELAB_FREE_PORT_ALREADY_ISOLATED", "Anschluss besitzt bereits einen eigenen Knoten.");

  const draft = clone(document);
  const draftComponent = componentById(draft, command.componentId);
  const draftPort = portById(draftComponent, command.portId);
  const nodeId = nextPrivateNodeId(draft, command.componentId, command.portId);
  draftPort.nodeId = nodeId;
  draft.nodes.push({ id: nodeId, label: `${command.componentId}.${command.portId}` });
  return normalizedUpdate(draft);
}

function applyDisconnectNet(document, command) {
  if (!document.nodes.some((node) => node.id === command.nodeId)) return failure("ELAB_FREE_NODE_NOT_FOUND", "Knoten wurde nicht gefunden.");
  const attached = document.components.flatMap((component) => component.ports.map((port) => ({ component, port })))
    .filter((entry) => entry.port.nodeId === command.nodeId);
  if (attached.length < 2) return failure("ELAB_FREE_NET_ALREADY_ISOLATED", "Knoten verbindet weniger als zwei Anschlüsse.");

  const draft = clone(document);
  const ground = attached.find((entry) => entry.component.type === "gnd");
  for (const entry of attached) {
    if (ground && entry.component.id === ground.component.id && entry.port.id === ground.port.id) continue;
    const component = componentById(draft, entry.component.id);
    const port = portById(component, entry.port.id);
    const nodeId = nextPrivateNodeId(draft, component.id, port.id);
    port.nodeId = nodeId;
    draft.nodes.push({ id: nodeId, label: `${component.id}.${port.id}` });
  }
  pruneUnusedNodes(draft);
  return normalizedUpdate(draft);
}

function applySetParameter(document, command) {
  const component = componentById(document, command.componentId);
  if (!component) return failure("ELAB_FREE_COMPONENT_NOT_FOUND", "Komponente wurde nicht gefunden.");
  if (!(command.parameterName in component.parameters)) return failure("ELAB_FREE_PARAMETER_NOT_FOUND", "Parameter wurde nicht gefunden.");
  const draft = clone(document);
  componentById(draft, command.componentId).parameters[command.parameterName].value = command.value;
  return normalizedUpdate(draft);
}

function applyCommand(document, command, initialDocument) {
  if (!command || typeof command !== "object" || Array.isArray(command)) return failure("ELAB_FREE_COMMAND_INVALID", "Befehl muss ein Objekt sein.");
  const allowedKeys = COMMAND_KEYS[command.type];
  if (!allowedKeys) return failure("ELAB_FREE_COMMAND_UNKNOWN", "Befehlstyp ist nicht verfügbar.");
  if (Object.keys(command).some((key) => !allowedKeys.includes(key))) {
    return failure("ELAB_FREE_COMMAND_UNKNOWN_FIELDS", "Befehl enthält unbekannte Felder.");
  }
  if (command.type === FREE_CIRCUIT_COMMAND_TYPES.ConnectPins) {
    for (const endpoint of [command.from, command.to]) {
      if (!endpoint || typeof endpoint !== "object" || Array.isArray(endpoint)
        || Object.keys(endpoint).some((key) => !["componentId", "portId"].includes(key))) {
        return failure("ELAB_FREE_COMMAND_ENDPOINT_INVALID", "Anschlussreferenz ist ungültig.");
      }
    }
  }
  switch (command.type) {
    case FREE_CIRCUIT_COMMAND_TYPES.AddComponent: return applyAddComponent(document, command);
    case FREE_CIRCUIT_COMMAND_TYPES.RemoveComponent: return applyRemoveComponent(document, command);
    case FREE_CIRCUIT_COMMAND_TYPES.ConnectPins: return applyConnectPins(document, command);
    case FREE_CIRCUIT_COMMAND_TYPES.DisconnectPin: return applyDisconnectPin(document, command);
    case FREE_CIRCUIT_COMMAND_TYPES.DisconnectNet: return applyDisconnectNet(document, command);
    case FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter: return applySetParameter(document, command);
    case FREE_CIRCUIT_COMMAND_TYPES.ResetCircuit: return { ok: true, document: initialDocument };
    default: return failure("ELAB_FREE_COMMAND_UNKNOWN", "Befehlstyp ist nicht verfügbar.");
  }
}

export function createFreeCircuitCommandRuntime({ document = FREE_CIRCUIT_EMPTY_DOCUMENT } = {}) {
  const initial = normalizeCircuitDocument(document);
  if (!initial.ok) throw new TypeError(initial.errors[0]?.code || "ELAB_FREE_DOCUMENT_INVALID");
  let currentDocument = initial.document;

  return Object.freeze({
    dispatch(command) {
      const result = applyCommand(currentDocument, command, initial.document);
      if (!result.ok) return result;
      currentDocument = result.document;
      return { ok: true, document: currentDocument };
    },
    getSnapshot() {
      return currentDocument;
    },
  });
}
