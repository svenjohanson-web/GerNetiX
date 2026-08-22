export const MEASUREMENT_SETUP_SCHEMA_VERSION = "1.0.0";

export const MEASUREMENT_SETUP_CONTRACT = Object.freeze({
  schemaVersion: MEASUREMENT_SETUP_SCHEMA_VERSION,
  maxPoints: 16,
  maxVoltageProbes: 8,
  modelLimits: Object.freeze({
    probeLoading: "ideal-infinite-input-impedance",
    supportedMeasurements: Object.freeze(["dc-voltage"]),
  }),
});

const ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function error(code, message, path) {
  return Object.freeze({ code, message, path });
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validLabel(value) {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 48;
}

export function normalizeMeasurementSetup(input, circuitDocument) {
  const errors = [];
  const nodeIds = new Set(circuitDocument?.nodes?.map((node) => node.id) || []);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({ ok: false, errors: Object.freeze([error("ELAB_MEASUREMENT_SETUP_INVALID", "Messaufbau muss ein Objekt sein.", "setup")]) });
  }
  if (!hasOnlyKeys(input, ["schemaVersion", "id", "points", "voltageProbes", "modelLimits"])) {
    errors.push(error("ELAB_MEASUREMENT_SETUP_UNKNOWN_FIELDS", "Messaufbau enthält unbekannte Felder.", "setup"));
  }
  if (input.schemaVersion !== MEASUREMENT_SETUP_SCHEMA_VERSION) {
    errors.push(error("ELAB_MEASUREMENT_SETUP_SCHEMA_UNSUPPORTED", "Version des Messaufbaus wird nicht unterstützt.", "schemaVersion"));
  }
  if (!ID_PATTERN.test(input.id || "")) errors.push(error("ELAB_MEASUREMENT_SETUP_ID_INVALID", "ID des Messaufbaus ist ungültig.", "id"));
  if (!Array.isArray(input.points)) errors.push(error("ELAB_MEASUREMENT_POINTS_INVALID", "Messpunkte müssen eine Liste sein.", "points"));
  if (!Array.isArray(input.voltageProbes)) errors.push(error("ELAB_VOLTAGE_PROBES_INVALID", "Tastköpfe müssen eine Liste sein.", "voltageProbes"));
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  if (input.points.length > MEASUREMENT_SETUP_CONTRACT.maxPoints) errors.push(error("ELAB_MEASUREMENT_POINT_LIMIT", "Maximale Anzahl Messpunkte überschritten.", "points"));
  if (input.voltageProbes.length > MEASUREMENT_SETUP_CONTRACT.maxVoltageProbes) errors.push(error("ELAB_VOLTAGE_PROBE_LIMIT", "Maximale Anzahl Tastköpfe überschritten.", "voltageProbes"));

  const pointIds = new Set();
  for (const [index, point] of input.points.entries()) {
    const path = `points[${index}]`;
    if (!point || typeof point !== "object" || Array.isArray(point) || !hasOnlyKeys(point, ["id", "label", "nodeId"])) {
      errors.push(error("ELAB_MEASUREMENT_POINT_INVALID", "Messpunkt ist ungültig.", path));
      continue;
    }
    if (!ID_PATTERN.test(point.id || "") || pointIds.has(point.id)) errors.push(error("ELAB_MEASUREMENT_POINT_ID_INVALID", "Messpunkt-ID fehlt, ist ungültig oder doppelt.", `${path}.id`));
    pointIds.add(point.id);
    if (!validLabel(point.label)) errors.push(error("ELAB_MEASUREMENT_POINT_LABEL_INVALID", "Messpunktbezeichnung ist ungültig.", `${path}.label`));
    if (typeof point.nodeId !== "string" || !nodeIds.has(point.nodeId)) errors.push(error("ELAB_MEASUREMENT_POINT_NODE_INVALID", "Messpunkt verweist auf keinen vorhandenen Knoten.", `${path}.nodeId`));
  }

  const probeIds = new Set();
  for (const [index, probe] of input.voltageProbes.entries()) {
    const path = `voltageProbes[${index}]`;
    if (!probe || typeof probe !== "object" || Array.isArray(probe) || !hasOnlyKeys(probe, ["id", "label", "positivePointId", "referencePointId"])) {
      errors.push(error("ELAB_VOLTAGE_PROBE_INVALID", "Tastkopf ist ungültig.", path));
      continue;
    }
    if (!ID_PATTERN.test(probe.id || "") || probeIds.has(probe.id)) errors.push(error("ELAB_VOLTAGE_PROBE_ID_INVALID", "Tastkopf-ID fehlt, ist ungültig oder doppelt.", `${path}.id`));
    probeIds.add(probe.id);
    if (!validLabel(probe.label)) errors.push(error("ELAB_VOLTAGE_PROBE_LABEL_INVALID", "Tastkopfbezeichnung ist ungültig.", `${path}.label`));
    if (!pointIds.has(probe.positivePointId)) errors.push(error("ELAB_VOLTAGE_PROBE_POINT_INVALID", "Plusspitze verweist auf keinen Messpunkt.", `${path}.positivePointId`));
    if (!pointIds.has(probe.referencePointId)) errors.push(error("ELAB_VOLTAGE_PROBE_REFERENCE_INVALID", "Referenzspitze verweist auf keinen Messpunkt.", `${path}.referencePointId`));
  }
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze(errors) });

  const setup = {
    schemaVersion: MEASUREMENT_SETUP_SCHEMA_VERSION,
    id: input.id,
    points: input.points.map((point) => ({ id: point.id, label: point.label.trim(), nodeId: point.nodeId })).sort((a, b) => a.id.localeCompare(b.id)),
    voltageProbes: input.voltageProbes.map((probe) => ({
      id: probe.id,
      label: probe.label.trim(),
      positivePointId: probe.positivePointId,
      referencePointId: probe.referencePointId,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    modelLimits: MEASUREMENT_SETUP_CONTRACT.modelLimits,
  };
  return Object.freeze({ ok: true, setup: deepFreeze(setup) });
}

