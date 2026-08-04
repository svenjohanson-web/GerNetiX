"use strict";

const { ProjectServerError } = require("../errors");

const PROJECT_APP_MANIFEST_PATH = "project-app/manifest.json";
const PROJECT_APP_SCHEMA = "gernetix.project-app/v1";
const IDENTIFIER = /^[a-z][a-z0-9_.-]{0,63}$/;
const WIDGET_TYPES = new Set(["text", "status", "metric", "chart", "toggle", "select", "schedule", "button"]);
const SETTING_TYPES = new Set(["boolean", "string", "number", "integer", "select", "schedule"]);
const BINDING_TYPES = new Set(["setting", "telemetry", "device_status", "ai_usage", "project"]);
const DEVICE_STATUS_FIELDS = new Set(["connection_state", "last_seen_at", "firmware_version", "battery_percent"]);
const AI_USAGE_FIELDS = new Set(["daily_requests", "monthly_requests", "daily_cost", "monthly_cost", "remaining_budget"]);
const PROJECT_FIELDS = new Set(["title", "status", "updated_at"]);
const TOP_LEVEL_KEYS = new Set(["schema", "manifest_version", "app_id", "title", "description", "settings", "bindings", "actions", "pages"]);

function validateProjectAppManifest(input) {
  const manifest = object(input, "manifest");
  exactKeys(manifest, TOP_LEVEL_KEYS, "manifest");
  if (manifest.schema !== PROJECT_APP_SCHEMA) invalid("manifest.schema", `muss ${PROJECT_APP_SCHEMA} sein`);
  const manifestVersion = positiveInteger(manifest.manifest_version, "manifest.manifest_version");
  const appId = identifier(manifest.app_id, "manifest.app_id");
  const title = plainText(manifest.title, "manifest.title", 120);
  const description = optionalPlainText(manifest.description, "manifest.description", 1000);

  const settings = array(manifest.settings, "manifest.settings", 100).map(validateSetting);
  unique(settings, "key", "manifest.settings");
  const settingsByKey = new Map(settings.map((item) => [item.key, item]));

  const bindings = array(manifest.bindings, "manifest.bindings", 200).map((item, index) => validateBinding(item, index, settingsByKey));
  unique(bindings, "id", "manifest.bindings");
  const bindingsById = new Map(bindings.map((item) => [item.id, item]));

  const actions = array(manifest.actions, "manifest.actions", 100).map((item, index) => validateAction(item, index, settingsByKey));
  unique(actions, "id", "manifest.actions");
  const actionsById = new Map(actions.map((item) => [item.id, item]));

  const pages = array(manifest.pages, "manifest.pages", 30, 1).map((page, index) => validatePage(page, index, bindingsById, actionsById));
  unique(pages, "id", "manifest.pages");
  return compact({ schema: PROJECT_APP_SCHEMA, manifest_version: manifestVersion, app_id: appId, title, description, settings, bindings, actions, pages });
}

function validateProjectAppValues(manifest, values, options = {}) {
  const normalizedManifest = validateProjectAppManifest(manifest);
  const input = object(values || {}, "values");
  const definitions = new Map(normalizedManifest.settings.map((item) => [item.key, item]));
  for (const key of Object.keys(input)) if (!definitions.has(key)) invalid(`values.${key}`, "ist im Manifest nicht definiert");
  const result = options.applyDefaults === false ? {} : Object.fromEntries(normalizedManifest.settings
    .filter((item) => Object.hasOwn(item, "default"))
    .map((item) => [item.key, structuredClone(item.default)]));
  for (const [key, value] of Object.entries(input)) result[key] = validateSettingValue(definitions.get(key), value, `values.${key}`);
  for (const definition of normalizedManifest.settings) {
    if (definition.required && !Object.hasOwn(result, definition.key)) invalid(`values.${definition.key}`, "ist erforderlich");
  }
  return result;
}

function validateSetting(input, index) {
  const path = `manifest.settings[${index}]`;
  const item = object(input, path);
  exactKeys(item, new Set(["key", "type", "label", "description", "required", "default", "min", "max", "options"]), path);
  const type = enumValue(item.type, SETTING_TYPES, `${path}.type`);
  const normalized = compact({
    key: identifier(item.key, `${path}.key`),
    type,
    label: plainText(item.label, `${path}.label`, 120),
    description: optionalPlainText(item.description, `${path}.description`, 500),
    required: item.required === true,
  });
  if (["number", "integer"].includes(type)) {
    if (item.min !== undefined) normalized.min = finiteNumber(item.min, `${path}.min`);
    if (item.max !== undefined) normalized.max = finiteNumber(item.max, `${path}.max`);
    if (normalized.min !== undefined && normalized.max !== undefined && normalized.min > normalized.max) invalid(path, "min darf max nicht uebersteigen");
  } else if (item.min !== undefined || item.max !== undefined) invalid(path, "min/max sind nur fuer Zahlen erlaubt");
  if (type === "select") normalized.options = validateOptions(item.options, `${path}.options`);
  else if (item.options !== undefined) invalid(path, "options sind nur fuer select erlaubt");
  if (Object.hasOwn(item, "default")) normalized.default = validateSettingValue(normalized, item.default, `${path}.default`);
  return normalized;
}

function validateBinding(input, index, settings) {
  const path = `manifest.bindings[${index}]`;
  const item = object(input, path);
  exactKeys(item, new Set(["id", "type", "key", "metric_id", "field", "device_scope"]), path);
  const type = enumValue(item.type, BINDING_TYPES, `${path}.type`);
  const normalized = { id: identifier(item.id, `${path}.id`), type };
  if (type === "setting") {
    normalized.key = identifier(item.key, `${path}.key`);
    if (!settings.has(normalized.key)) invalid(`${path}.key`, "verweist nicht auf ein definiertes Setting");
  } else if (type === "telemetry") {
    normalized.metric_id = identifier(item.metric_id, `${path}.metric_id`);
    normalized.device_scope = item.device_scope === undefined ? "project" : enumValue(item.device_scope, new Set(["project", "assigned_device"]), `${path}.device_scope`);
  } else {
    const fields = type === "device_status" ? DEVICE_STATUS_FIELDS : type === "ai_usage" ? AI_USAGE_FIELDS : PROJECT_FIELDS;
    normalized.field = enumValue(item.field, fields, `${path}.field`);
  }
  return normalized;
}

function validateAction(input, index, settings) {
  const path = `manifest.actions[${index}]`;
  const item = object(input, path);
  exactKeys(item, new Set(["id", "type", "setting_key", "command_id", "confirmation"]), path);
  const type = enumValue(item.type, new Set(["update_setting", "device_command"]), `${path}.type`);
  const normalized = { id: identifier(item.id, `${path}.id`), type };
  if (type === "update_setting") {
    normalized.setting_key = identifier(item.setting_key, `${path}.setting_key`);
    if (!settings.has(normalized.setting_key)) invalid(`${path}.setting_key`, "verweist nicht auf ein definiertes Setting");
  } else {
    normalized.command_id = identifier(item.command_id, `${path}.command_id`);
  }
  if (item.confirmation !== undefined) normalized.confirmation = plainText(item.confirmation, `${path}.confirmation`, 240);
  return normalized;
}

function validatePage(input, index, bindings, actions) {
  const path = `manifest.pages[${index}]`;
  const page = object(input, path);
  exactKeys(page, new Set(["id", "title", "description", "widgets"]), path);
  const widgets = array(page.widgets, `${path}.widgets`, 100, 1).map((widget, widgetIndex) => validateWidget(widget, `${path}.widgets[${widgetIndex}]`, bindings, actions));
  unique(widgets, "id", `${path}.widgets`);
  return compact({ id: identifier(page.id, `${path}.id`), title: plainText(page.title, `${path}.title`, 120), description: optionalPlainText(page.description, `${path}.description`, 500), widgets });
}

function validateWidget(input, path, bindings, actions) {
  const item = object(input, path);
  exactKeys(item, new Set(["id", "type", "title", "text", "binding_id", "action_id", "display"]), path);
  const type = enumValue(item.type, WIDGET_TYPES, `${path}.type`);
  const normalized = compact({ id: identifier(item.id, `${path}.id`), type, title: optionalPlainText(item.title, `${path}.title`, 120) });
  if (type === "text") normalized.text = plainText(item.text, `${path}.text`, 2000);
  else if (item.text !== undefined) invalid(`${path}.text`, "ist nur beim Text-Widget erlaubt");
  if (["status", "metric", "chart", "toggle", "select", "schedule"].includes(type)) {
    normalized.binding_id = identifier(item.binding_id, `${path}.binding_id`);
    if (!bindings.has(normalized.binding_id)) invalid(`${path}.binding_id`, "verweist nicht auf eine definierte Bindung");
  } else if (item.binding_id !== undefined) invalid(`${path}.binding_id`, "ist fuer diesen Widget-Typ nicht erlaubt");
  if (["toggle", "select", "schedule", "button"].includes(type)) {
    normalized.action_id = identifier(item.action_id, `${path}.action_id`);
    if (!actions.has(normalized.action_id)) invalid(`${path}.action_id`, "verweist nicht auf eine definierte Aktion");
  } else if (item.action_id !== undefined) invalid(`${path}.action_id`, "ist fuer diesen Widget-Typ nicht erlaubt");
  if (["toggle", "select", "schedule"].includes(type)) {
    const binding = bindings.get(normalized.binding_id);
    const action = actions.get(normalized.action_id);
    if (binding.type !== "setting") invalid(`${path}.binding_id`, "muss fuer ein Eingabe-Widget auf ein Setting zeigen");
    if (action.type !== "update_setting" || action.setting_key !== binding.key) {
      invalid(`${path}.action_id`, "muss genau das gebundene Setting aktualisieren");
    }
  }
  if (type === "chart" && bindings.get(normalized.binding_id).type !== "telemetry") {
    invalid(`${path}.binding_id`, "muss fuer ein Diagramm auf Telemetrie zeigen");
  }
  if (item.display !== undefined) normalized.display = enumValue(item.display, new Set(["default", "compact", "prominent"]), `${path}.display`);
  return normalized;
}

function validateSettingValue(definition, value, path) {
  if (value === null) {
    if (definition.required) invalid(path, "darf nicht leer sein");
    return null;
  }
  if (definition.type === "boolean") {
    if (typeof value !== "boolean") invalid(path, "muss boolean sein");
  } else if (definition.type === "number" || definition.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (definition.type === "integer" && !Number.isInteger(value))) invalid(path, `muss ${definition.type} sein`);
    if (definition.min !== undefined && value < definition.min) invalid(path, `muss mindestens ${definition.min} sein`);
    if (definition.max !== undefined && value > definition.max) invalid(path, `darf hoechstens ${definition.max} sein`);
  } else if (definition.type === "select") {
    const allowed = new Set((definition.options || []).map((item) => item.value));
    if (typeof value !== "string" || !allowed.has(value)) invalid(path, "ist keine erlaubte Auswahl");
  } else if (definition.type === "schedule") {
    const schedule = object(value, path);
    exactKeys(schedule, new Set(["enabled", "start", "end", "timezone"]), path);
    if (typeof schedule.enabled !== "boolean") invalid(`${path}.enabled`, "muss boolean sein");
    time(schedule.start, `${path}.start`); time(schedule.end, `${path}.end`);
    if (!/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)+$/.test(String(schedule.timezone || ""))) invalid(`${path}.timezone`, "muss eine IANA-Zeitzone sein");
  } else {
    if (typeof value !== "string" || value.length > 500 || /[<>]/.test(value)) invalid(path, "muss sicherer Text mit hoechstens 500 Zeichen sein");
  }
  return structuredClone(value);
}

function validateOptions(input, path) {
  const result = array(input, path, 50, 1).map((entry, index) => {
    const item = object(entry, `${path}[${index}]`);
    exactKeys(item, new Set(["value", "label"]), `${path}[${index}]`);
    return { value: identifier(item.value, `${path}[${index}].value`), label: plainText(item.label, `${path}[${index}].label`, 120) };
  });
  unique(result, "value", path);
  return result;
}

function exactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (/^(?:on|script|url|href|endpoint)/i.test(key) || !allowed.has(key)) invalid(`${path}.${key}`, "ist nicht erlaubt");
  }
}
function object(value, path) { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "muss ein Objekt sein"); return value; }
function array(value, path, max, min = 0) { if (!Array.isArray(value) || value.length < min || value.length > max) invalid(path, `muss ${min} bis ${max} Eintraege enthalten`); return value; }
function identifier(value, path) { const normalized = String(value || ""); if (!IDENTIFIER.test(normalized)) invalid(path, "muss ein sicherer Bezeichner sein"); return normalized; }
function positiveInteger(value, path) { if (!Number.isInteger(value) || value < 1) invalid(path, "muss eine positive Ganzzahl sein"); return value; }
function finiteNumber(value, path) { if (typeof value !== "number" || !Number.isFinite(value)) invalid(path, "muss eine endliche Zahl sein"); return value; }
function enumValue(value, allowed, path) { if (!allowed.has(value)) invalid(path, `muss einer der erlaubten Werte sein: ${[...allowed].join(", ")}`); return value; }
function plainText(value, path, max) { if (typeof value !== "string" || !value.trim() || value.length > max || /[<>]/.test(value)) invalid(path, `muss nicht-leerer Klartext mit hoechstens ${max} Zeichen sein`); return value.trim(); }
function optionalPlainText(value, path, max) { return value === undefined ? undefined : plainText(value, path, max); }
function time(value, path) { if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""))) invalid(path, "muss HH:MM sein"); }
function unique(items, key, path) { const seen = new Set(); for (const item of items) { if (seen.has(item[key])) invalid(path, `${key} muss eindeutig sein`); seen.add(item[key]); } }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)); }
function invalid(path, reason) { throw new ProjectServerError("invalid_project_app_manifest", `${path} ${reason}.`, 400, { path, reason }); }

module.exports = {
  PROJECT_APP_MANIFEST_PATH,
  PROJECT_APP_SCHEMA,
  validateProjectAppManifest,
  validateProjectAppValues,
};
