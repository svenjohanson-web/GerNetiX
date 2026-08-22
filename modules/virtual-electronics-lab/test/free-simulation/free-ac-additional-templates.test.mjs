import assert from "node:assert/strict";
import test from "node:test";

import {
  FREE_CIRCUIT_COMMAND_TYPES,
  createFreeCircuitCommandRuntime,
} from "../../free-simulation/free-circuit-command-runtime.mjs";
import {
  FREE_RC_HIGHPASS_PRESET_ID,
  FREE_SERIES_RLC_PRESET_ID,
  createFreeRcHighpassDocument,
  createFreeRcHighpassMeasurementSetup,
  createFreeSeriesRlcDocument,
  createFreeSeriesRlcMeasurementSetup,
} from "../../free-simulation/free-circuit-presets.mjs";
import { simulateFreeAcSweep } from "../../free-simulation/ac-learning-solver.mjs";
import { evaluateAcVoltageProbes } from "../../free-simulation/ac-voltage-probe-evaluator.mjs";
import { normalizeMeasurementSetup } from "../../free-simulation/measurement-point-contract.mjs";
import { normalizeSimulationRequest } from "../../free-simulation/simulation-request-contract.mjs";
import { getLabTemplate } from "../../lab-template-catalog.mjs";
import { createFreeCircuitSimulationLab } from "../../labs/free-circuit-simulation.js";

const CASES = [
  {
    templateId: "elab-tpl-free-rc-highpass",
    presetId: FREE_RC_HIGHPASS_PRESET_ID,
    createDocument: createFreeRcHighpassDocument,
    createMeasurementSetup: createFreeRcHighpassMeasurementSetup,
    componentTypes: ["capacitor", "gnd", "resistor", "dc-voltage-source"],
    probe: { positivePointId: "mp-out", referencePointId: "mp-gnd" },
  },
  {
    templateId: "elab-tpl-free-series-rlc",
    presetId: FREE_SERIES_RLC_PRESET_ID,
    createDocument: createFreeSeriesRlcDocument,
    createMeasurementSetup: createFreeSeriesRlcMeasurementSetup,
    componentTypes: ["capacitor", "gnd", "inductor", "resistor", "dc-voltage-source"],
    probe: { positivePointId: "mp-input", referencePointId: "mp-after-r" },
  },
];

function simulatePreset(preset, { startFrequencyHz = 10, stopFrequencyHz = 100_000, pointsPerDecade = 10 } = {}) {
  const circuit = preset.createDocument();
  const response = simulateFreeAcSweep({
    schemaVersion: "1.0.0",
    circuit,
    analysis: {
      type: "ac-sweep",
      startFrequencyHz,
      stopFrequencyHz,
      pointsPerDecade,
      excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
    },
  });
  assert.equal(response.ok, true);
  const evaluated = evaluateAcVoltageProbes(preset.createMeasurementSetup(), circuit, response);
  assert.equal(evaluated.ok, true);
  return evaluated.traces[0].samples;
}

for (const preset of CASES) {
  test(`AC-002: ${preset.presetId} besitzt gültiges Template, Messpunkte und AC-Quelle`, () => {
    const template = getLabTemplate(preset.templateId);
    assert.equal(template.entry.presetId, preset.presetId);

    const document = preset.createDocument();
    assert.deepEqual(document.components.map((component) => component.type), preset.componentTypes);
    assert.deepEqual(document.components.filter((component) => component.type === "dc-voltage-source").map((component) => component.id), ["v1"]);

    const setup = preset.createMeasurementSetup();
    const normalizedSetup = normalizeMeasurementSetup(setup, document);
    assert.equal(normalizedSetup.ok, true);
    assert.deepEqual(normalizedSetup.setup.voltageProbes.map((probe) => ({
      positivePointId: probe.positivePointId,
      referencePointId: probe.referencePointId,
    })), [preset.probe]);

    const request = normalizeSimulationRequest({
      schemaVersion: "1.0.0",
      circuit: document,
      analysis: {
        type: "ac-sweep",
        startFrequencyHz: 10,
        stopFrequencyHz: 100_000,
        pointsPerDecade: 10,
        excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
      },
    });
    assert.equal(request.ok, true);
    assert.equal(request.request.analysis.excitation.sourceComponentId, "v1");

    const loaded = createFreeCircuitSimulationLab().loadTemplate(template);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.document, document);
  });

  test(`AC-002: ${preset.presetId} wird nach Änderung vollständig zurückgesetzt`, () => {
    const initial = preset.createDocument();
    const runtime = createFreeCircuitCommandRuntime({ document: initial });
    assert.equal(runtime.dispatch({
      type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter,
      componentId: "v1",
      parameterName: "voltage",
      value: 3.3,
    }).ok, true);
    assert.notDeepEqual(runtime.getSnapshot(), initial);
    assert.equal(runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.ResetCircuit }).ok, true);
    assert.deepEqual(runtime.getSnapshot(), initial);

    const initialSetup = preset.createMeasurementSetup();
    const editedSetup = structuredClone(initialSetup);
    editedSetup.voltageProbes = [];
    assert.notDeepEqual(editedSetup, initialSetup);
    assert.deepEqual(preset.createMeasurementSetup(), initialSetup);
  });
}

test("AC-002: RLC-Preset verwendet die dokumentierten Resonanzwerte", () => {
  const document = createFreeSeriesRlcDocument();
  assert.equal(document.components.find((component) => component.id === "r1").parameters.resistance.value, 100);
  assert.equal(document.components.find((component) => component.id === "l1").parameters.inductance.value, 0.01);
  assert.equal(document.components.find((component) => component.id === "c1").parameters.capacitance.value, 1e-6);
  assert.ok(Math.abs((1 / (2 * Math.PI * Math.sqrt(0.01 * 1e-6))) - 1591.5494309189535) < 1e-9);
});

test("AC-002: RC-Hochpass steigt im Betrag an", () => {
  const samples = simulatePreset(CASES[0]);
  assert.ok(samples[0].gainDb < -20);
  assert.ok(samples.at(-1).gainDb > -0.01);
  assert.ok(samples[0].phaseDeg > samples.at(-1).phaseDeg);
});

test("AC-002: RLC-Messung über R zeigt das Maximum an der Resonanz", () => {
  const samples = simulatePreset(CASES[1], { startFrequencyHz: 100, stopFrequencyHz: 10_000, pointsPerDecade: 20 });
  const maximum = samples.reduce((best, sample) => sample.gainDb > best.gainDb ? sample : best);
  assert.ok(maximum.frequencyHz > 1_500 && maximum.frequencyHz < 1_700);
  assert.ok(maximum.gainDb > -0.01);
  assert.ok(maximum.gainDb > samples[0].gainDb);
  assert.ok(maximum.gainDb > samples.at(-1).gainDb);
});
