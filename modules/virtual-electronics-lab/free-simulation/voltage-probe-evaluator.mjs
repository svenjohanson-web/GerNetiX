import { createLabProjectSlice } from "../domain/lab-project-contract.mjs";
import { publishNodeVoltageTrace, readVoltageProbes } from "../instruments/measurement-bus.mjs";

function measurementFailure(result) {
  return Object.freeze({ ok: false, errors: result?.errors || Object.freeze([]) });
}

function projectFor(setup, circuitDocument, analysisConfiguration, modelVersions = {}) {
  return createLabProjectSlice({
    circuitDocument,
    measurementSetup: setup,
    analysisConfiguration,
    modelVersions,
  });
}

export function evaluateVoltageProbes(setup, circuitDocument, dcResponse) {
  if (!dcResponse?.ok) return measurementFailure(dcResponse);
  const projectResult = projectFor(setup, circuitDocument, { analysis: "dc-operating-point" }, dcResponse.result?.modelVersions);
  if (!projectResult.ok) return measurementFailure(projectResult);
  const traceResult = publishNodeVoltageTrace({ labProject: projectResult.project, solverResponse: dcResponse });
  if (!traceResult.ok) return measurementFailure(traceResult);
  const measured = readVoltageProbes({ labProject: projectResult.project, trace: traceResult.trace });
  if (!measured.ok) return measurementFailure(measured);
  return Object.freeze({
    ok: true,
    readings: Object.freeze(measured.probes.map((probe) => Object.freeze({
      probeId: probe.probeId,
      label: probe.label,
      positivePointId: probe.positivePointId,
      referencePointId: probe.referencePointId,
      voltageV: probe.latestValue,
    }))),
  });
}

export function evaluateTransientVoltageProbes(setup, circuitDocument, transientResponse) {
  if (!transientResponse?.ok) return measurementFailure(transientResponse);
  const result = transientResponse.result;
  const projectResult = projectFor(setup, circuitDocument, {
    analysis: "transient-step-response",
    timeStepS: result.timeStepS,
    stopTimeS: result.stopTimeS,
  }, { solver: result.modelVersion });
  if (!projectResult.ok) return measurementFailure(projectResult);
  const traceResult = publishNodeVoltageTrace({ labProject: projectResult.project, solverResponse: transientResponse });
  if (!traceResult.ok) return measurementFailure(traceResult);
  const measured = readVoltageProbes({ labProject: projectResult.project, trace: traceResult.trace });
  if (!measured.ok) return measurementFailure(measured);
  return Object.freeze({
    ok: true,
    traces: Object.freeze(measured.probes.map((probe) => Object.freeze({
      probeId: probe.probeId,
      label: probe.label,
      positivePointId: probe.positivePointId,
      referencePointId: probe.referencePointId,
      samples: Object.freeze(probe.samples.map((sample) => Object.freeze({ timeS: sample.timeS, voltageV: sample.value }))),
    }))),
  });
}
