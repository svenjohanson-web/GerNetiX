import assert from "node:assert/strict";
import test from "node:test";
import { CIRCUIT_DOCUMENT_CONTRACT, validateCircuitDocument } from "../../free-simulation/circuit-document-contract.mjs";

const validDocument = {
  id: "free-led-demo",
  version: "1.0.0",
  nodes: [
    { id: "gnd" },
    { id: "vcc", label: "Versorgung" },
    { id: "led-a" },
  ],
  components: [
    { id: "gnd1", type: "gnd", ports: [{ id: "0", nodeId: "gnd" }], parameters: {} },
    { id: "v1", type: "dc-voltage-source", ports: [{ id: "p", nodeId: "vcc" }, { id: "n", nodeId: "gnd" }], parameters: { voltage: { value: 5, unit: "V" } } },
    { id: "r1", type: "resistor", ports: [{ id: "p", nodeId: "vcc" }, { id: "n", nodeId: "led-a" }], parameters: { resistance: { value: 220, unit: "Ω" } } },
    { id: "d1", type: "led", ports: [{ id: "anode", nodeId: "led-a" }, { id: "cathode", nodeId: "gnd" }], parameters: { forwardVoltage: { value: 2, unit: "V" }, dynamicResistance: { value: 10, unit: "Ω" } } },
  ],
};

function draft(overrides = {}) {
  return { ...validDocument, ...overrides };
}

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) if (child && typeof child === "object") assertDeepFrozen(child);
}

test("normalisiert CircuitDocument versioniert, sortiert und tief unveränderlich", () => {
  const result = validateCircuitDocument(draft({
    nodes: [...validDocument.nodes].reverse(),
    components: [...validDocument.components].reverse(),
  }));
  assert.equal(result.ok, true);
  assert.equal(result.document.schemaVersion, CIRCUIT_DOCUMENT_CONTRACT.schemaVersion);
  assert.deepEqual(result.document.nodes.map((node) => node.id), ["gnd", "led-a", "vcc"]);
  assert.deepEqual(result.document.components.map((component) => component.id), ["d1", "gnd1", "r1", "v1"]);
  assertDeepFrozen(result.document);
  assert.equal(validateCircuitDocument(result.document).ok, true);
});

test("deckt alle erlaubten funktionalen Komponententypen und Einheiten ab", () => {
  const components = [
    { id: "c1", type: "capacitor", ports: [{ id: "p", nodeId: "vcc" }, { id: "n", nodeId: "gnd" }], parameters: { capacitance: { value: 1e-6, unit: "F" } } },
    { id: "l1", type: "inductor", ports: [{ id: "p", nodeId: "vcc" }, { id: "n", nodeId: "gnd" }], parameters: { inductance: { value: 1e-3, unit: "H" } } },
    { id: "s1", type: "push-button", ports: [{ id: "a", nodeId: "vcc" }, { id: "b", nodeId: "gnd" }], parameters: { state: { value: "open", unit: "state" } } },
  ];
  assert.equal(validateCircuitDocument(draft({ components: [...validDocument.components, ...components] })).ok, true);
});

test("verwirft unbekannte Typen, falsche Ports, Einheiten und Verbindungen", () => {
  assert.equal(validateCircuitDocument(draft({ components: [{ ...validDocument.components[1], type: "diode" }] })).errors[0].code, "ELAB_FREE_COMPONENTS_INVALID");
  assert.equal(validateCircuitDocument(draft({ components: [{ ...validDocument.components[1], ports: [{ id: "p", nodeId: "vcc" }, { id: "x", nodeId: "gnd" }] }] })).errors[0].code, "ELAB_FREE_COMPONENTS_INVALID");
  assert.equal(validateCircuitDocument(draft({ components: [{ ...validDocument.components[1], parameters: { voltage: { value: 5, unit: "A" } } }] })).errors[0].code, "ELAB_FREE_COMPONENTS_INVALID");
  assert.equal(validateCircuitDocument(draft({ components: [{ ...validDocument.components[1], ports: [{ id: "p", nodeId: "missing" }, { id: "n", nodeId: "gnd" }] }] })).errors[0].code, "ELAB_FREE_COMPONENTS_INVALID");
});

test("setzt feste Grenzen und verwirft Überschreitungen sowie Duplikate", () => {
  const defaults = validateCircuitDocument(validDocument);
  assert.deepEqual(defaults.document.modelLimits, { maxVoltageV: 24, maxCurrentA: 5 });
  assert.equal(validateCircuitDocument(draft({ modelLimits: { maxVoltageV: 25, maxCurrentA: 5 } })).errors[0].code, "ELAB_FREE_MODEL_LIMITS_INVALID");
  assert.equal(validateCircuitDocument(draft({ nodes: [...validDocument.nodes, { id: "gnd" }] })).errors[0].code, "ELAB_FREE_NODES_INVALID");
  const excessiveVoltage = structuredClone(validDocument);
  excessiveVoltage.components[1].parameters.voltage.value = 25;
  assert.equal(validateCircuitDocument(excessiveVoltage).errors[0].code, "ELAB_FREE_COMPONENTS_INVALID");
  assert.equal(CIRCUIT_DOCUMENT_CONTRACT.componentDefinitions.resistor.ports.join(","), "p,n");
  assertDeepFrozen(CIRCUIT_DOCUMENT_CONTRACT.componentDefinitions);
});

test("verändert das Eingabedokument nicht", () => {
  const input = structuredClone(validDocument);
  const before = structuredClone(input);
  validateCircuitDocument(input);
  assert.deepEqual(input, before);
});
