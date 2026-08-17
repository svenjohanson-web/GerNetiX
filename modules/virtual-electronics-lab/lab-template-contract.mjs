const TEMPLATE_AREAS = Object.freeze([
  "measurement",
  "basic-circuit",
  "troubleshooting",
  "free-simulation",
]);

const ACCESS_VISIBILITY = Object.freeze(["public", "signed-in", "private"]);

const MODEL_LIMIT_KEYS = Object.freeze([
  "minVoltageV",
  "maxVoltageV",
  "minCurrentA",
  "maxCurrentA",
  "minTemperatureC",
  "maxTemperatureC",
  "maxRuntimeMs",
]);

const FORBIDDEN_ACCESS_KEYS = Object.freeze([
  "tariff",
  "tariffName",
  "tariffCode",
  "plan",
  "planName",
  "creditPack",
  "providerId",
  "provider",
  "providerName",
]);

const TOP_LEVEL_TEMPLATE_KEYS = Object.freeze([
  "schemaVersion",
  "id",
  "version",
  "title",
  "shortDescription",
  "area",
  "entry",
  "recommendedInstruments",
  "recommendedMeasurementPoints",
  "startCode",
  "modelLimits",
  "access",
]);

const TEMPLATE_ENTRY_KEYS = Object.freeze(["labId", "runtimeEntrypoint", "presetId"]);
const MEASUREMENT_POINT_KEYS = Object.freeze(["id", "label"]);
const ACCESS_KEYS = Object.freeze([
  "visibility",
  "requiresAuthentication",
  "capabilities",
]);

const REFERENCE_ID_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i;
const RUNTIME_ENTRY_PATTERN = /^[a-z][a-z0-9_./-]{0,119}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

export const LAB_TEMPLATE_CONTRACT = Object.freeze({
  schemaVersion: "1.0.0",
  supportedAreas: TEMPLATE_AREAS,
  supportedAccessModes: ACCESS_VISIBILITY,
  supportedModelLimits: MODEL_LIMIT_KEYS,
});

const ERRORS = Object.freeze({
  TEMPLATE_REQUIRED: Object.freeze({
    code: "ELAB_TPL_TEMPLATE_REQUIRED",
    message: "Ein LabTemplate-Objekt ist erforderlich.",
  }),
  INVALID_ID: Object.freeze({
    code: "ELAB_TPL_ID_INVALID",
    message: "Die Template-ID ist ungültig.",
  }),
  INVALID_VERSION: Object.freeze({
    code: "ELAB_TPL_VERSION_INVALID",
    message: "Die Version muss als SemVer-String wie 1.2.3 vorliegen.",
  }),
  INVALID_TITLE: Object.freeze({
    code: "ELAB_TPL_TITLE_INVALID",
    message: "Der Titel ist ungültig oder zu lang.",
  }),
  INVALID_SHORT_DESCRIPTION: Object.freeze({
    code: "ELAB_TPL_SHORT_DESCRIPTION_INVALID",
    message: "Die Kurzbeschreibung ist ungültig oder zu lang.",
  }),
  INVALID_AREA: Object.freeze({
    code: "ELAB_TPL_AREA_INVALID",
    message: "Der Bereich ist nicht unterstützt.",
  }),
  INVALID_ENTRY: Object.freeze({
    code: "ELAB_TPL_ENTRY_INVALID",
    message: "Der Labor-/Runtime-Einstieg ist ungültig.",
  }),
  INVALID_INSTRUMENTS: Object.freeze({
    code: "ELAB_TPL_INSTRUMENTS_INVALID",
    message: "Die empfohlenen Messinstrumente sind ungültig.",
  }),
  INVALID_MEASUREMENT_POINTS: Object.freeze({
    code: "ELAB_TPL_MEASUREMENT_POINTS_INVALID",
    message: "Die empfohlenen Messpunkte sind ungültig.",
  }),
  INVALID_START_CODE: Object.freeze({
    code: "ELAB_TPL_START_CODE_INVALID",
    message: "Der Startcode ist ungültig oder zu lang.",
  }),
  INVALID_MODEL_LIMITS: Object.freeze({
    code: "ELAB_TPL_MODEL_LIMITS_INVALID",
    message: "Die Modellgrenzen sind ungültig.",
  }),
  INVALID_ACCESS: Object.freeze({
    code: "ELAB_TPL_ACCESS_INVALID",
    message: "Die Zugangsmetadaten sind ungültig.",
  }),
  UNKNOWN_TOP_LEVEL_KEYS: Object.freeze({
    code: "ELAB_TPL_UNKNOWN_TOP_LEVEL_KEYS",
    message: "Template enthält unbekannte Top-Level-Felder.",
  }),
  UNKNOWN_ENTRY_KEYS: Object.freeze({
    code: "ELAB_TPL_UNKNOWN_ENTRY_KEYS",
    message: "Der Labor-/Runtime-Einstieg enthält unbekannte Felder.",
  }),
  UNKNOWN_MEASUREMENT_POINT_KEYS: Object.freeze({
    code: "ELAB_TPL_UNKNOWN_MEASUREMENT_POINT_KEYS",
    message: "Ein Messpunkt enthält unbekannte Felder.",
  }),
  UNKNOWN_MODEL_LIMIT_KEYS: Object.freeze({
    code: "ELAB_TPL_UNKNOWN_MODEL_LIMIT_KEYS",
    message: "Die Modellgrenzen enthalten unbekannte Felder.",
  }),
  UNKNOWN_ACCESS_KEYS: Object.freeze({
    code: "ELAB_TPL_UNKNOWN_ACCESS_KEYS",
    message: "Die Zugangsmetadaten enthalten unbekannte Felder.",
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const entry of Object.values(value)) {
    deepFreeze(entry);
  }
  return value;
}

function fail(error) {
  return deepFreeze({ ok: false, errors: [error] });
}

function trimText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function isSemver(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasAllowedKeys(value, keys) {
  if (!isObject(value)) return false;
  return Object.keys(value).every((key) => keys.includes(key));
}

function validateTemplateId(id) {
  const normalized = trimText(id, 64);
  if (!normalized || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(normalized)) {
    return { ok: false };
  }
  return { ok: true, value: normalized };
}

function validateEntry(entry) {
  if (!isObject(entry) || !hasAllowedKeys(entry, TEMPLATE_ENTRY_KEYS)) return { ok: false };
  const labId = trimText(entry.labId, 80);
  const runtimeEntrypoint = trimText(entry.runtimeEntrypoint, 120);
  const presetId = trimText(entry.presetId, 80);
  if (!labId || !runtimeEntrypoint || !presetId || !REFERENCE_ID_PATTERN.test(labId) || !RUNTIME_ENTRY_PATTERN.test(runtimeEntrypoint) || !REFERENCE_ID_PATTERN.test(presetId)) {
    return { ok: false };
  }

  return {
    ok: true,
    value: deepFreeze({
      labId,
      runtimeEntrypoint,
      presetId,
    }),
  };
}

function uniqueSortedStrings(values) {
  const output = [];
  const seen = new Set();
  for (const candidate of values) {
    if (typeof candidate !== "string") return null;
    const text = trimText(candidate, 80);
    if (!text || text.length > 80) return null;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output.sort(compareText);
}

function validateInstruments(instruments) {
  if (!Array.isArray(instruments) || instruments.length === 0) return { ok: false };
  const normalized = uniqueSortedStrings(instruments);
  if (!normalized || normalized.length > 12) return { ok: false };
  return { ok: true, value: Object.freeze(normalized) };
}

function validateMeasurementPoints(points, { allowEmpty = false } = {}) {
  if (!Array.isArray(points) || (!allowEmpty && points.length === 0) || points.length > 24) return { ok: false };
  const normalized = [];
  const labelsById = new Map();

  for (const point of points) {
    if (!isObject(point) || !hasAllowedKeys(point, MEASUREMENT_POINT_KEYS)) return { ok: false };
    const id = trimText(point.id, 64);
    const label = trimText(point.label, 80);
    if (
      !id
      || !label
      || !REFERENCE_ID_PATTERN.test(id)
      || CONTROL_CHARACTER_PATTERN.test(label)
    ) {
      return { ok: false };
    }
    const key = id.toLowerCase();
    const previousLabel = labelsById.get(key);
    if (previousLabel !== undefined && previousLabel !== label) {
      return { ok: false };
    }
    if (previousLabel === undefined) {
      labelsById.set(key, label);
      normalized.push({ id, label });
    }
  }

  if ((!allowEmpty && !normalized.length) || normalized.length > 12) return { ok: false };
  normalized.sort((a, b) => compareText(a.id, b.id));
  return { ok: true, value: Object.freeze(normalized.map((point) => deepFreeze(point))) };
}

function normalizeCode(startCode) {
  const normalized = trimText(startCode, 4096);
  return normalized ? normalized.replace(/\r\n/g, "\n") : null;
}

function validateModelLimits(modelLimits) {
  if (!isObject(modelLimits) || !hasAllowedKeys(modelLimits, MODEL_LIMIT_KEYS)) return { ok: false };
  const entries = [];
  for (const key of MODEL_LIMIT_KEYS) {
    if (!(key in modelLimits)) continue;
    const value = modelLimits[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false };
    entries.push([key, value]);
  }
  if (entries.length === 0) return { ok: false };

  const normalized = {};
  for (const [key, value] of entries) {
    normalized[key] = Number.parseFloat(value.toFixed(6));
  }

  if (
    ("minVoltageV" in normalized && "maxVoltageV" in normalized && normalized.minVoltageV > normalized.maxVoltageV)
    || ("minCurrentA" in normalized && "maxCurrentA" in normalized && normalized.minCurrentA > normalized.maxCurrentA)
    || ("minTemperatureC" in normalized && "maxTemperatureC" in normalized && normalized.minTemperatureC > normalized.maxTemperatureC)
    || ("maxRuntimeMs" in normalized && normalized.maxRuntimeMs <= 0)
  ) {
    return { ok: false };
  }

  return { ok: true, value: deepFreeze(normalized) };
}

function hasForbiddenAccessKey(metadata) {
  for (const key of FORBIDDEN_ACCESS_KEYS) {
    if (Object.hasOwn(metadata, key)) return true;
  }
  return false;
}

function validateAccess(access) {
  if (!isObject(access) || !hasAllowedKeys(access, ACCESS_KEYS)) return { ok: false };
  if (hasForbiddenAccessKey(access)) return { ok: false };

  const visibility = trimText(access.visibility, 32);
  if (!visibility || !ACCESS_VISIBILITY.includes(visibility)) return { ok: false };

  const requiresAuthentication = typeof access.requiresAuthentication === "boolean" ? access.requiresAuthentication : false;
  if (visibility === "public" && requiresAuthentication === true) return { ok: false };
  if ((visibility === "signed-in" || visibility === "private") && requiresAuthentication !== true) return { ok: false };

  const capabilities = access.capabilities === undefined ? [] : uniqueSortedStrings(access.capabilities);
  if (capabilities === null) return { ok: false };

  return {
    ok: true,
    value: deepFreeze({
      visibility,
      requiresAuthentication,
      capabilities: Object.freeze(capabilities),
    }),
  };
}

export function validateLabTemplate(template) {
  if (!isObject(template)) return fail(ERRORS.TEMPLATE_REQUIRED);
  if (!hasAllowedKeys(template, TOP_LEVEL_TEMPLATE_KEYS)) return fail(ERRORS.UNKNOWN_TOP_LEVEL_KEYS);
  if (template.schemaVersion !== undefined && template.schemaVersion !== LAB_TEMPLATE_CONTRACT.schemaVersion) {
    return fail(ERRORS.INVALID_VERSION);
  }

  const id = validateTemplateId(template.id);
  if (!id.ok) return fail(ERRORS.INVALID_ID);

  if (!isSemver(template.version)) return fail(ERRORS.INVALID_VERSION);

  const title = trimText(template.title, 120);
  if (!title) return fail(ERRORS.INVALID_TITLE);

  const shortDescription = trimText(template.shortDescription, 1000);
  if (!shortDescription) return fail(ERRORS.INVALID_SHORT_DESCRIPTION);

  const area = trimText(template.area, 32);
  if (!area || !TEMPLATE_AREAS.includes(area)) return fail(ERRORS.INVALID_AREA);

  const entry = validateEntry(template.entry);
  if (!entry.ok) return fail(ERRORS.INVALID_ENTRY);

  const instruments = validateInstruments(template.recommendedInstruments);
  if (!instruments.ok) return fail(ERRORS.INVALID_INSTRUMENTS);

  const measurementPoints = validateMeasurementPoints(template.recommendedMeasurementPoints, {
    allowEmpty: area === "free-simulation" && entry.value.presetId === "empty",
  });
  if (!measurementPoints.ok) return fail(ERRORS.INVALID_MEASUREMENT_POINTS);

  const startCode = normalizeCode(template.startCode);
  if (!startCode) return fail(ERRORS.INVALID_START_CODE);

  const modelLimits = validateModelLimits(template.modelLimits);
  if (!modelLimits.ok) return fail(ERRORS.INVALID_MODEL_LIMITS);

  const access = validateAccess(template.access);
  if (!access.ok) return fail(ERRORS.INVALID_ACCESS);

  return deepFreeze({
    ok: true,
    template: deepFreeze({
      schemaVersion: LAB_TEMPLATE_CONTRACT.schemaVersion,
      id: id.value,
      version: template.version,
      title,
      shortDescription,
      area,
      entry: entry.value,
      recommendedInstruments: instruments.value,
      recommendedMeasurementPoints: measurementPoints.value,
      startCode,
      modelLimits: modelLimits.value,
      access: access.value,
    }),
  });
}
