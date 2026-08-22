import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPONENT_CAPABILITY_CONTRACT,
  getComponentCapability,
  normalizeComponentCapabilities,
} from "../../free-simulation/component-capability-contract.mjs";
import { CIRCUIT_DOCUMENT_CONTRACT } from "../../free-simulation/circuit-document-contract.mjs";

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") assertDeepFrozen(child);
  }
}

test("beschreibt alle sieben funktionalen Komponenten mit stabiler Capability-Matrix", () => {
  assert.deepEqual(COMPONENT_CAPABILITY_CONTRACT.supportedComponentTypes, [
    "gnd",
    "dc-voltage-source",
    "resistor",
    "capacitor",
    "inductor",
    "led",
    "push-button",
  ]);
  assert.deepEqual(COMPONENT_CAPABILITY_CONTRACT.definitions.resistor, {
    componentType: "resistor",
    model: "linear-resistor",
    analyses: { dc: true, transient: true, ac: true },
    netlist: true,
  });
  assert.deepEqual(COMPONENT_CAPABILITY_CONTRACT.definitions.led.analyses, {
    dc: false,
    transient: false,
    ac: false,
  });
  assert.equal(COMPONENT_CAPABILITY_CONTRACT.definitions.led.netlist, false);
  assertDeepFrozen(COMPONENT_CAPABILITY_CONTRACT);
});

test("leitet die Capability-Typen exakt aus dem CircuitDocument-Vertrag ab", () => {
  assert.deepEqual(
    COMPONENT_CAPABILITY_CONTRACT.supportedComponentTypes,
    CIRCUIT_DOCUMENT_CONTRACT.supportedComponentTypes,
  );
  assert.strictEqual(
    COMPONENT_CAPABILITY_CONTRACT.supportedComponentTypes,
    CIRCUIT_DOCUMENT_CONTRACT.supportedComponentTypes,
  );
});

test("normalisiert Typen dedupliziert, sortiert und tief unveränderlich", () => {
  const result = normalizeComponentCapabilities([
    " resistor ",
    "led",
    "resistor",
    "gnd",
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.schemaVersion, "1.0.0");
  assert.deepEqual(result.capabilities.map((entry) => entry.componentType), ["gnd", "led", "resistor"]);
  assertDeepFrozen(result);
  assert.equal(normalizeComponentCapabilities(result.capabilities.map((entry) => entry.componentType)).ok, true);
});

test("macht Grenzen explizit: Taster nur transient, LED noch nicht freigegeben", () => {
  const button = getComponentCapability("push-button");
  assert.equal(button.ok, true);
  assert.deepEqual(button.capability.analyses, { dc: false, transient: true, ac: false });
  assert.equal(button.capability.netlist, false);

  const led = getComponentCapability("led");
  assert.equal(led.ok, true);
  assert.equal(led.capability.model, "not-modeled");
  assert.match(led.capability.limitation, /noch nicht freigegeben/u);
});

test("lehnt unbekannte, leere und nicht-stringartige Typen mit stabilen Fehlern ab", () => {
  assert.equal(normalizeComponentCapabilities([]).errors[0].code, "ELAB_SPICE_CAPABILITY_REQUIRED");
  assert.equal(normalizeComponentCapabilities(["unknown"]).errors[0].code, "ELAB_SPICE_CAPABILITY_TYPE_UNKNOWN");
  assert.equal(normalizeComponentCapabilities([""]).errors[0].code, "ELAB_SPICE_CAPABILITY_TYPE_INVALID");
  assert.equal(getComponentCapability("unknown").errors[0].code, "ELAB_SPICE_CAPABILITY_TYPE_UNKNOWN");
  assert.equal(getComponentCapability(null).errors[0].code, "ELAB_SPICE_CAPABILITY_TYPE_INVALID");
});
