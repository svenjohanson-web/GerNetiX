import { normalizeMeasurementSetup } from "./measurement-point-contract.mjs";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message) {
  return deepFreeze({ ok: false, errors: [{ code, message }] });
}

function normalizePhase(value) {
  let phase = value;
  while (phase > 180) phase -= 360;
  while (phase <= -180) phase += 360;
  return phase;
}

export function evaluateAcVoltageProbes(setup, circuitDocument, acResponse) {
  if (!acResponse?.ok || acResponse.result?.analysis !== "ac-sweep") {
    return failure("ELAB_AC_PROBE_RESPONSE_INVALID", "Für die AC-Tastkopfauswertung ist ein gültiger AC-Sweep erforderlich.");
  }
  const normalized = normalizeMeasurementSetup(setup, circuitDocument);
  if (!normalized.ok) return deepFreeze({ ok: false, errors: normalized.errors });
  const points = new Map(normalized.setup.points.map((point) => [point.id, point]));
  const excitationAmplitudeV = acResponse.result.excitation.amplitudeV;
  const excitationPhaseDeg = acResponse.result.excitation.phaseDeg;
  const traces = normalized.setup.voltageProbes.map((probe) => {
    const positiveNodeId = points.get(probe.positivePointId).nodeId;
    const referenceNodeId = points.get(probe.referencePointId).nodeId;
    const samples = acResponse.result.samples.map((sample) => {
      const values = new Map(sample.nodeVoltages.map((node) => [node.nodeId, node]));
      const positive = values.get(positiveNodeId);
      const reference = values.get(referenceNodeId);
      if (!positive || !reference) return null;
      const realV = positive.real - reference.real;
      const imaginaryV = positive.imaginary - reference.imaginary;
      const magnitudeV = Math.hypot(realV, imaginaryV);
      const absolutePhaseDeg = magnitudeV === 0 ? 0 : Math.atan2(imaginaryV, realV) * 180 / Math.PI;
      return {
        frequencyHz: sample.frequencyHz,
        realV,
        imaginaryV,
        magnitudeV,
        gainDb: magnitudeV === 0 ? null : 20 * Math.log10(magnitudeV / excitationAmplitudeV),
        phaseDeg: magnitudeV === 0 ? 0 : normalizePhase(absolutePhaseDeg - excitationPhaseDeg),
      };
    });
    if (samples.some((sample) => sample === null)) return null;
    return {
      probeId: probe.id,
      label: probe.label,
      positivePointId: probe.positivePointId,
      referencePointId: probe.referencePointId,
      samples,
    };
  });
  if (traces.some((trace) => trace === null)) return failure("ELAB_AC_PROBE_NODE_MISSING", "Ein AC-Tastkopf verweist auf einen fehlenden Ergebnisknoten.");
  return deepFreeze({ ok: true, traces });
}
