import assert from "node:assert/strict";
import test from "node:test";

import { createFreeDcDividerDocument, createFreeRcChargeDocument } from "../../free-simulation/free-circuit-presets.mjs";
import { SIMULATION_REQUEST_CONTRACT, normalizeSimulationRequest } from "../../free-simulation/simulation-request-contract.mjs";

test("SPICE-001: DC und Transient verwenden denselben versionierten Auftrag", () => {
  const dc = normalizeSimulationRequest({
    schemaVersion: "1.0.0",
    circuit: createFreeDcDividerDocument(),
    analysis: { type: "dc-operating-point" },
  });
  const transient = normalizeSimulationRequest({
    schemaVersion: "1.0.0",
    circuit: createFreeRcChargeDocument(),
    analysis: { type: "transient", timeStepS: 0.0001, stopTimeS: 0.01 },
  });
  assert.equal(dc.ok, true);
  assert.equal(transient.ok, true);
  assert.deepEqual(SIMULATION_REQUEST_CONTRACT.supportedAnalyses, ["dc-operating-point", "transient", "ac-sweep"]);
  assert.equal(Object.isFrozen(dc.request.circuit.components), true);
  assert.equal(Object.isFrozen(transient.request.analysis), true);
});

test("SPICE-001: Vertrag lehnt unbekannte Felder, Versionen und Zeitraster stabil ab", () => {
  const circuit = createFreeRcChargeDocument();
  assert.equal(normalizeSimulationRequest(null).errors[0].code, "ELAB_SIMULATION_REQUEST_REQUIRED");
  assert.equal(normalizeSimulationRequest({ schemaVersion: "1.0.0", circuit, analysis: { type: "dc-operating-point" }, provider: "ngspice" }).errors[0].code, "ELAB_SIMULATION_REQUEST_UNKNOWN_KEYS");
  assert.equal(normalizeSimulationRequest({ schemaVersion: "2.0.0", circuit, analysis: { type: "dc-operating-point" } }).errors[0].code, "ELAB_SIMULATION_REQUEST_VERSION_INVALID");
  assert.equal(normalizeSimulationRequest({ schemaVersion: "1.0.0", circuit, analysis: { type: "noise" } }).errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");
  assert.equal(normalizeSimulationRequest({ schemaVersion: "1.0.0", circuit, analysis: { type: "transient", timeStepS: 0.003, stopTimeS: 0.01 } }).errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");
});

test("SPICE-002: AC-Auftrag bindet Sweep und Kleinsignalquelle", () => {
  const circuit = createFreeRcChargeDocument();
  const result = normalizeSimulationRequest({
    schemaVersion: "1.0.0",
    circuit,
    analysis: {
      type: "ac-sweep",
      startFrequencyHz: 10,
      stopFrequencyHz: 100_000,
      pointsPerDecade: 10,
      excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.request.analysis.excitation, { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 });
  assert.equal(Object.isFrozen(result.request.analysis.excitation), true);
});

test("SPICE-002: AC-Vertrag begrenzt Quelle, Frequenzachse und Samplezahl", () => {
  const circuit = createFreeRcChargeDocument();
  const analysis = {
    type: "ac-sweep",
    startFrequencyHz: 1,
    stopFrequencyHz: 1_000_000,
    pointsPerDecade: 10,
    excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
  };
  assert.equal(normalizeSimulationRequest({ schemaVersion: "1.0.0", circuit, analysis: { ...analysis, excitation: { ...analysis.excitation, sourceComponentId: "r1" } } }).errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");
  assert.equal(normalizeSimulationRequest({ schemaVersion: "1.0.0", circuit, analysis: { ...analysis, pointsPerDecade: 50 } }).errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");
  assert.equal(normalizeSimulationRequest({ schemaVersion: "1.0.0", circuit, analysis: { ...analysis, excitation: { ...analysis.excitation, amplitudeV: 25 } } }).errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");
});

test("SPICE-001: Normalisierung verändert die Eingabe nicht", () => {
  const input = {
    schemaVersion: "1.0.0",
    circuit: structuredClone(createFreeDcDividerDocument()),
    analysis: { type: "dc-operating-point" },
  };
  const before = structuredClone(input);
  normalizeSimulationRequest(input);
  assert.deepEqual(input, before);
});
