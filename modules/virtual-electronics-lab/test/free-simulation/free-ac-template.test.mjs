import assert from "node:assert/strict";
import test from "node:test";

import { getLabTemplate } from "../../lab-template-catalog.mjs";
import { createFreeCircuitSimulationLab } from "../../labs/free-circuit-simulation.js";

test("SPICE-003: Katalogvorlage lädt das RC-Netzwerk im bestehenden freien Labor", () => {
  const template = getLabTemplate("elab-tpl-free-rc-lowpass");
  assert.equal(template.entry.presetId, "rc-lowpass");
  const response = createFreeCircuitSimulationLab().loadTemplate(template);
  assert.equal(response.ok, true);
  assert.deepEqual(response.document.components.map((component) => component.type), [
    "capacitor",
    "gnd",
    "resistor",
    "dc-voltage-source",
  ]);
  assert.equal(response.document.components.find((component) => component.id === "c1").parameters.capacitance.value, 1e-6);
  assert.equal(response.document.components.find((component) => component.id === "r1").parameters.resistance.value, 1_000);
});
