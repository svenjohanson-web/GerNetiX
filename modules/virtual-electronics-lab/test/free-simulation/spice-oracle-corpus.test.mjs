import assert from "node:assert/strict";
import test from "node:test";

import { simulateFreeAcSweep } from "../../free-simulation/ac-learning-solver.mjs";
import { evaluateAcVoltageProbes } from "../../free-simulation/ac-voltage-probe-evaluator.mjs";
import { simulateFreeDcOperatingPoint } from "../../free-simulation/dc-learning-solver-adapter.mjs";
import { exportSpiceNetlist } from "../../free-simulation/spice-netlist-exporter.mjs";
import { normalizeSimulationRequest } from "../../free-simulation/simulation-request-contract.mjs";
import { simulateFreeTransient } from "../../free-simulation/transient-learning-solver.mjs";
import {
  SPICE_ORACLE_CORPUS,
  createCanonicalAcRequest,
  createCanonicalTransientRequest,
  createFreeDcDividerDocument,
  createFreeRcChargeDocument,
  createPhaseSignMeasurementSetup,
  createRlAcFixture,
  createSingularAcFixture,
  createUnsupportedAcFixture,
} from "./spice-oracle-corpus.mjs";

const { tolerancePolicy: T } = SPICE_ORACLE_CORPUS;

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected} ± ${tolerance}`);
}

function node(sample, nodeId) {
  const result = sample.nodeVoltages.find((entry) => entry.nodeId === nodeId);
  assert.ok(result, `Ergebnisknoten fehlt: ${nodeId}`);
  return result;
}

function branch(result, componentId) {
  const value = result.result.branches.find((entry) => entry.componentId === componentId);
  assert.ok(value, `Ergebniszweig fehlt: ${componentId}`);
  return value;
}

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") assertDeepFrozen(child);
  }
}

test("SPICE-006 Korpus ist versioniert, tief unveränderlich und dokumentiert Toleranzen", () => {
  assert.equal(SPICE_ORACLE_CORPUS.schemaVersion, "1.0.0");
  assert.ok(T.voltageV > 0 && T.gainDb > 0 && T.phaseDeg > 0);
  assertDeepFrozen(SPICE_ORACLE_CORPUS);
});

test("SPICE-006 DC-Orakel: 5-V-Spannungsteiler liefert 2,5 V und 2,5 mA", () => {
  const expected = SPICE_ORACLE_CORPUS.cases.dcDivider.expected;
  const result = simulateFreeDcOperatingPoint(createFreeDcDividerDocument());
  assert.equal(result.ok, true);
  near(node(result.result, "r1-n").voltageV, expected.middleVoltageV, T.voltageV, "Teilermitte");
  near(branch(result, "r1").currentA, expected.dividerCurrentA, T.currentA, "R1-Strom");
  near(branch(result, "v1").currentA, -expected.dividerCurrentA, T.currentA, "Quellenstromvorzeichen");
});

test("SPICE-006 RC-Transient-Orakel prüft Zeitachse und Backward-Euler-Endwert", () => {
  const expected = SPICE_ORACLE_CORPUS.cases.rcTransient;
  const result = simulateFreeTransient(
    createFreeRcChargeDocument(),
    expected.analysis,
  );
  assert.equal(result.ok, true);
  assert.equal(result.result.sampleCount, expected.expected.sampleCount);
  assert.equal(result.result.samples[0].timeS, 0);
  near(result.result.samples.at(-1).timeS, expected.analysis.stopTimeS, T.timeS, "Endzeit");
  near(node(result.result.samples.at(-1), "c1-p").voltageV, expected.expected.finalVoltageV, T.voltageV, "RC-Endspannung");
  assert.equal(result.result.diagnostics.integration, "backward-euler");
});

test("SPICE-006 RC-AC-Orakel prüft -3 dB und -45 Grad mit expliziter Toleranz", () => {
  const expected = SPICE_ORACLE_CORPUS.cases.rcAc.expected;
  const result = simulateFreeAcSweep(createCanonicalAcRequest(createFreeRcChargeDocument()));
  assert.equal(result.ok, true);
  const sample = result.result.samples[10];
  near(sample.frequencyHz, expected.cutoffHz, T.frequencyHz, "RC-Eckfrequenz");
  const output = node(sample, "c1-p");
  near(output.magnitude, expected.magnitudeV, T.magnitudeV, "RC-Betrag");
  near(20 * Math.log10(output.magnitude), expected.gainDb, T.gainDb, "RC-Verstärkung");
  near(output.phaseDeg, expected.phaseDeg, T.phaseDeg, "RC-Phase");
});

test("SPICE-006 RL-AC-Orakel prüft Betrag und positives Phasenverhalten", () => {
  const expected = SPICE_ORACLE_CORPUS.cases.rlAc.expected;
  const result = simulateFreeAcSweep(createCanonicalAcRequest(createRlAcFixture(), {
    startFrequencyHz: expected.cutoffHz / 10,
    stopFrequencyHz: expected.cutoffHz * 10,
  }));
  assert.equal(result.ok, true);
  const sample = result.result.samples[10];
  near(sample.frequencyHz, expected.cutoffHz, T.frequencyHz, "RL-Eckfrequenz");
  const output = node(sample, "l1-p");
  near(output.magnitude, expected.magnitudeV, T.magnitudeV, "RL-Betrag");
  near(output.phaseDeg, expected.phaseDeg, T.phaseDeg, "RL-Phase");
});

test("SPICE-006 Phase, Mapping und Vorzeichen bleiben nachvollziehbar", () => {
  const expected = SPICE_ORACLE_CORPUS.cases.phaseMappingSign;
  const circuit = createFreeRcChargeDocument();
  const request = createCanonicalAcRequest(circuit, { excitation: expected.excitation });
  const ac = simulateFreeAcSweep(request);
  assert.equal(ac.ok, true);
  near(node(ac.result.samples[0], "r1-p").phaseDeg, expected.expected.sourcePhaseDeg, T.phaseDeg, "Quellenphase");

  const netlist = exportSpiceNetlist(request);
  assert.equal(netlist.ok, true);
  assert.deepEqual(netlist.result.mappings.nodes, [
    { circuitNodeId: "c1-p", spiceNode: "n001" },
    { circuitNodeId: "gnd", spiceNode: "0" },
    { circuitNodeId: "r1-p", spiceNode: "n002" },
  ]);
  assert.deepEqual(netlist.result.mappings.components, [
    { circuitComponentId: "c1", spiceElement: "C1" },
    { circuitComponentId: "r1", spiceElement: "R1" },
    { circuitComponentId: "v1", spiceElement: "V1" },
  ]);
  assert.match(netlist.result.netlist, /V1 n002 0 DC 5 AC 2 90/u);

  const normal = evaluateAcVoltageProbes(
    { ...createPhaseSignMeasurementSetup(), voltageProbes: [{ id: "probe-1", label: "normal", positivePointId: "mp-cap", referencePointId: "mp-gnd" }] },
    circuit,
    simulateFreeAcSweep(createCanonicalAcRequest(circuit)),
  );
  const reversed = evaluateAcVoltageProbes(createPhaseSignMeasurementSetup(), circuit, simulateFreeAcSweep(createCanonicalAcRequest(circuit)));
  assert.equal(normal.ok, true);
  assert.equal(reversed.ok, true);
  near(normal.traces[0].samples[10].gainDb, SPICE_ORACLE_CORPUS.cases.rcAc.expected.gainDb, T.gainDb, "normaler Tastkopf");
  near(reversed.traces[0].samples[10].phaseDeg, expected.expected.reversedProbePhaseDeg, T.phaseDeg, "umgekehrte Tastkopfphase");
  assert.ok(reversed.traces[0].samples[10].realV < 0, "Umgekehrter Tastkopf muss negatives Realteil liefern.");
});

test("SPICE-006 singulär, unsupported und Grenzfälle liefern stabile Diagnosen", () => {
  const unsupported = simulateFreeAcSweep(createCanonicalAcRequest(createUnsupportedAcFixture()));
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.errors[0].code, "ELAB_AC_COMPONENT_UNSUPPORTED");
  assert.deepEqual(unsupported.errors[0].componentIds, ["d1"]);

  const singular = simulateFreeAcSweep(createCanonicalAcRequest(createSingularAcFixture()));
  assert.equal(singular.ok, false);
  assert.equal(singular.errors[0].code, "ELAB_AC_SINGULAR_CIRCUIT");

  const base = createCanonicalAcRequest(createFreeRcChargeDocument());
  const invalidFrequency = normalizeSimulationRequest({
    ...base,
    analysis: { ...base.analysis, startFrequencyHz: SPICE_ORACLE_CORPUS.cases.diagnostics.invalidStartFrequencyHz },
  });
  assert.equal(invalidFrequency.ok, false);
  assert.equal(invalidFrequency.errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");

  const transientLimit = normalizeSimulationRequest(createCanonicalTransientRequest(
    createFreeRcChargeDocument(),
    SPICE_ORACLE_CORPUS.cases.diagnostics.transientStepLimit,
  ));
  assert.equal(transientLimit.ok, false);
  assert.equal(transientLimit.errors[0].code, "ELAB_SIMULATION_REQUEST_ANALYSIS_INVALID");
});
