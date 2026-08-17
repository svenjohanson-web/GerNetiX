import {
  FREE_CIRCUIT_COMMAND_TYPES,
  createFreeCircuitCommandRuntime,
} from "../../free-simulation/free-circuit-command-runtime.mjs";
import {
  createFreeDcDividerDocument,
  createFreeRcChargeDocument,
  createFreeRcLowpassMeasurementSetup,
} from "../../free-simulation/free-circuit-presets.mjs";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const SPICE_ORACLE_CORPUS = deepFreeze({
  schemaVersion: "1.0.0",
  tolerancePolicy: {
    voltageV: 1e-9,
    currentA: 1e-12,
    magnitudeV: 1e-9,
    gainDb: 1e-9,
    phaseDeg: 1e-9,
    frequencyHz: 1e-9,
    timeS: 1e-12,
  },
  cases: {
    dcDivider: {
      id: "dc-divider-5v-1k-1k",
      expected: { middleVoltageV: 2.5, dividerCurrentA: 0.0025 },
    },
    rcTransient: {
      id: "rc-charge-5v-1k-1uf-10ms",
      analysis: { timeStepS: 0.0001, stopTimeS: 0.01 },
      expected: { sampleCount: 101, finalVoltageV: 5 * (1 - (1 / 1.1) ** 100) },
    },
    rcAc: {
      id: "rc-lowpass-1k-1uf-cutoff",
      expected: {
        cutoffHz: 1 / (2 * Math.PI * 1_000 * 1e-6),
        magnitudeV: 1 / Math.sqrt(2),
        gainDb: 20 * Math.log10(1 / Math.sqrt(2)),
        phaseDeg: -45,
      },
    },
    rlAc: {
      id: "rl-lowpass-1k-1h-cutoff",
      expected: {
        cutoffHz: 1_000 / (2 * Math.PI),
        magnitudeV: 1 / Math.sqrt(2),
        phaseDeg: 45,
      },
    },
    phaseMappingSign: {
      id: "rc-phase-90deg-and-differential-sign",
      excitation: { sourceComponentId: "v1", amplitudeV: 2, phaseDeg: 90 },
      expected: { sourcePhaseDeg: 90, reversedProbePhaseDeg: 135 },
    },
    diagnostics: {
      unsupportedComponentType: "led",
      singularComponentId: "r-floating",
      invalidStartFrequencyHz: 0,
      transientStepLimit: { timeStepS: 1e-6, stopTimeS: 0.01 },
    },
  },
});

function add(runtime, componentId, componentType) {
  const result = runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent,
    componentId,
    componentType,
  });
  if (!result.ok) throw new Error(`Fixture-Komponente konnte nicht angelegt werden: ${componentId}`);
}

function connect(runtime, fromComponent, fromPort, toComponent, toPort) {
  const result = runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: fromComponent, portId: fromPort },
    to: { componentId: toComponent, portId: toPort },
  });
  if (!result.ok) throw new Error(`Fixture-Verbindung konnte nicht angelegt werden: ${fromComponent}.${fromPort}`);
}

export function createRlAcFixture() {
  const runtime = createFreeCircuitCommandRuntime();
  add(runtime, "gnd1", "gnd");
  add(runtime, "v1", "dc-voltage-source");
  add(runtime, "r1", "resistor");
  add(runtime, "l1", "inductor");
  connect(runtime, "v1", "n", "gnd1", "0");
  connect(runtime, "v1", "p", "r1", "p");
  connect(runtime, "r1", "n", "l1", "p");
  connect(runtime, "l1", "n", "gnd1", "0");
  const parameter = runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter,
    componentId: "l1",
    parameterName: "inductance",
    value: 1,
  });
  if (!parameter.ok) throw new Error("RL-Fixtureparameter konnte nicht gesetzt werden.");
  return runtime.getSnapshot();
}

export function createUnsupportedAcFixture() {
  const runtime = createFreeCircuitCommandRuntime({ document: createFreeRcChargeDocument() });
  add(runtime, "d1", SPICE_ORACLE_CORPUS.cases.diagnostics.unsupportedComponentType);
  return runtime.getSnapshot();
}

export function createSingularAcFixture() {
  const runtime = createFreeCircuitCommandRuntime({ document: createFreeRcChargeDocument() });
  add(runtime, SPICE_ORACLE_CORPUS.cases.diagnostics.singularComponentId, "resistor");
  return runtime.getSnapshot();
}

export function createPhaseSignMeasurementSetup() {
  const setup = createFreeRcLowpassMeasurementSetup();
  return {
    ...setup,
    voltageProbes: [{
      ...setup.voltageProbes[0],
      positivePointId: "mp-gnd",
      referencePointId: "mp-cap",
    }],
  };
}

export function createCanonicalAcRequest(circuit, overrides = {}) {
  const expected = SPICE_ORACLE_CORPUS.cases.rcAc.expected;
  return {
    schemaVersion: "1.0.0",
    circuit,
    analysis: {
      type: "ac-sweep",
      startFrequencyHz: expected.cutoffHz / 10,
      stopFrequencyHz: expected.cutoffHz * 10,
      pointsPerDecade: 10,
      excitation: { sourceComponentId: "v1", amplitudeV: 1, phaseDeg: 0 },
      ...overrides,
    },
  };
}

export function createCanonicalTransientRequest(circuit, overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    circuit,
    analysis: {
      type: "transient",
      ...SPICE_ORACLE_CORPUS.cases.rcTransient.analysis,
      ...overrides,
    },
  };
}

export {
  createFreeDcDividerDocument,
  createFreeRcChargeDocument,
};
