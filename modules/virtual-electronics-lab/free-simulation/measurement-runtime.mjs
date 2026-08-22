import {
  MEASUREMENT_SETUP_CONTRACT,
  MEASUREMENT_SETUP_SCHEMA_VERSION,
  normalizeMeasurementSetup,
} from "./measurement-point-contract.mjs";

export const MEASUREMENT_COMMAND_TYPES = Object.freeze({
  AddMeasurementPoint: "AddMeasurementPoint",
  MoveMeasurementPoint: "MoveMeasurementPoint",
  RemoveMeasurementPoint: "RemoveMeasurementPoint",
  AddVoltageProbe: "AddVoltageProbe",
  RemoveVoltageProbe: "RemoveVoltageProbe",
  ResetMeasurementSetup: "ResetMeasurementSetup",
});

export const EMPTY_MEASUREMENT_SETUP = Object.freeze({
  schemaVersion: MEASUREMENT_SETUP_SCHEMA_VERSION,
  id: "free-measurement-setup",
  points: Object.freeze([]),
  voltageProbes: Object.freeze([]),
  modelLimits: MEASUREMENT_SETUP_CONTRACT.modelLimits,
});

const COMMAND_KEYS = Object.freeze({
  AddMeasurementPoint: ["type", "pointId", "label", "nodeId"],
  MoveMeasurementPoint: ["type", "pointId", "nodeId"],
  RemoveMeasurementPoint: ["type", "pointId"],
  AddVoltageProbe: ["type", "probeId", "label", "positivePointId", "referencePointId"],
  RemoveVoltageProbe: ["type", "probeId"],
  ResetMeasurementSetup: ["type"],
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const failure = (code, message) => Object.freeze({ ok: false, errors: Object.freeze([Object.freeze({ code, message })]) });

function normalized(draft, circuitDocument) {
  const result = normalizeMeasurementSetup(draft, circuitDocument);
  if (!result.ok) return failure(result.errors[0].code, result.errors[0].message);
  return { ok: true, setup: result.setup };
}

function applyCommand(current, command, initial, circuitDocument) {
  if (!command || typeof command !== "object" || Array.isArray(command)) return failure("ELAB_MEASUREMENT_COMMAND_INVALID", "Messbefehl muss ein Objekt sein.");
  const allowed = COMMAND_KEYS[command.type];
  if (!allowed) return failure("ELAB_MEASUREMENT_COMMAND_UNKNOWN", "Messbefehl ist nicht verfügbar.");
  if (Object.keys(command).some((key) => !allowed.includes(key))) return failure("ELAB_MEASUREMENT_COMMAND_UNKNOWN_FIELDS", "Messbefehl enthält unbekannte Felder.");
  if (command.type === MEASUREMENT_COMMAND_TYPES.ResetMeasurementSetup) return normalized(clone(initial), circuitDocument);

  const draft = clone(current);
  if (command.type === MEASUREMENT_COMMAND_TYPES.AddMeasurementPoint) {
    draft.points.push({ id: command.pointId, label: command.label, nodeId: command.nodeId });
  } else if (command.type === MEASUREMENT_COMMAND_TYPES.MoveMeasurementPoint) {
    const point = draft.points.find((entry) => entry.id === command.pointId);
    if (!point) return failure("ELAB_MEASUREMENT_POINT_NOT_FOUND", "Messpunkt wurde nicht gefunden.");
    point.nodeId = command.nodeId;
  } else if (command.type === MEASUREMENT_COMMAND_TYPES.RemoveMeasurementPoint) {
    if (!draft.points.some((entry) => entry.id === command.pointId)) return failure("ELAB_MEASUREMENT_POINT_NOT_FOUND", "Messpunkt wurde nicht gefunden.");
    draft.points = draft.points.filter((entry) => entry.id !== command.pointId);
    draft.voltageProbes = draft.voltageProbes.filter((probe) => probe.positivePointId !== command.pointId && probe.referencePointId !== command.pointId);
  } else if (command.type === MEASUREMENT_COMMAND_TYPES.AddVoltageProbe) {
    draft.voltageProbes.push({
      id: command.probeId,
      label: command.label,
      positivePointId: command.positivePointId,
      referencePointId: command.referencePointId,
    });
  } else if (command.type === MEASUREMENT_COMMAND_TYPES.RemoveVoltageProbe) {
    if (!draft.voltageProbes.some((entry) => entry.id === command.probeId)) return failure("ELAB_VOLTAGE_PROBE_NOT_FOUND", "Tastkopf wurde nicht gefunden.");
    draft.voltageProbes = draft.voltageProbes.filter((entry) => entry.id !== command.probeId);
  }
  return normalized(draft, circuitDocument);
}

export function createMeasurementRuntime({ setup = EMPTY_MEASUREMENT_SETUP, document } = {}) {
  const initialResult = normalizeMeasurementSetup(setup, document);
  if (!initialResult.ok) throw new TypeError(initialResult.errors[0].code);
  const initial = initialResult.setup;
  let current = initial;
  return Object.freeze({
    dispatch(command, circuitDocument = document) {
      const result = applyCommand(current, command, initial, circuitDocument);
      if (!result.ok) return result;
      current = result.setup;
      return { ok: true, setup: current };
    },
    reconcile(circuitDocument) {
      const nodeIds = new Set(circuitDocument.nodes.map((node) => node.id));
      const removedPointIds = current.points.filter((point) => !nodeIds.has(point.nodeId)).map((point) => point.id);
      const keptPoints = current.points.filter((point) => nodeIds.has(point.nodeId));
      const keptIds = new Set(keptPoints.map((point) => point.id));
      const removedProbeIds = current.voltageProbes
        .filter((probe) => !keptIds.has(probe.positivePointId) || !keptIds.has(probe.referencePointId))
        .map((probe) => probe.id);
      const result = normalized({ ...clone(current), points: keptPoints, voltageProbes: current.voltageProbes.filter((probe) => !removedProbeIds.includes(probe.id)) }, circuitDocument);
      current = result.setup;
      return Object.freeze({ ok: true, setup: current, removedPointIds: Object.freeze(removedPointIds), removedProbeIds: Object.freeze(removedProbeIds) });
    },
    getSnapshot() {
      return current;
    },
  });
}

