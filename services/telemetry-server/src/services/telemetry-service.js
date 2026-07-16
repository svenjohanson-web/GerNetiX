const crypto = require("node:crypto");
const { TelemetryError } = require("../errors");

class TelemetryService {
  constructor({ repository, ownershipResolver, pushNotifier = null, defaultMeasurementRetentionDays = 90, defaultEventRetentionDays = 365 }) {
    this.repository = repository;
    this.ownershipResolver = ownershipResolver;
    this.pushNotifier = pushNotifier;
    this.defaultMeasurementRetentionDays = defaultMeasurementRetentionDays;
    this.defaultEventRetentionDays = defaultEventRetentionDays;
  }

  async ingest(input = {}) {
    const deviceId = requiredId(input.device_id, "device_id");
    const projectId = requiredId(input.project_id, "project_id");
    const ownership = await this.ownershipResolver({ device_id: deviceId, project_id: projectId });
    const accountId = requiredId(ownership?.account_id, "resolved_account_id");
    const receivedAt = new Date().toISOString();
    const context = { account_id: accountId, project_id: projectId, device_id: deviceId, received_at: receivedAt };
    const measurements = normalizeMeasurements(input.measurements, context);
    const events = normalizeEvents(input.events, context);
    if (!measurements.length && !events.length) throw new TelemetryError("telemetry_empty", "Mindestens ein Messwert oder Ereignis wird benötigt.");
    this.repository.saveBatch({ measurements, events });
    const push = [];
    for (const event of events.filter((item) => item.notify_push)) {
      try { push.push({ event_id: event.event_id, delivered: await this.pushNotifier?.(event) || null }); }
      catch (error) { push.push({ event_id: event.event_id, error: error.message || "push_failed" }); }
    }
    return { accepted: true, account_id: accountId, project_id: projectId, device_id: deviceId, measurements: measurements.length, events: events.length, push };
  }

  listMeasurements(accountId, projectId, query) { return this.repository.listMeasurements(requiredId(accountId, "account_id"), requiredId(projectId, "project_id"), query); }
  listEvents(accountId, projectId, query) { return this.repository.listEvents(requiredId(accountId, "account_id"), requiredId(projectId, "project_id"), query); }
  deleteProjectData(accountId, projectId) { return this.repository.deleteProjectData(requiredId(accountId, "account_id"), requiredId(projectId, "project_id")); }

  setRetentionPolicy(accountId, projectId, input = {}) {
    const policy = { measurement_retention_days: days(input.measurement_retention_days, this.defaultMeasurementRetentionDays), event_retention_days: days(input.event_retention_days, this.defaultEventRetentionDays) };
    return this.repository.setRetentionPolicy(requiredId(accountId, "account_id"), requiredId(projectId, "project_id"), policy);
  }
  getRetentionPolicy(accountId, projectId) { return this.repository.getRetentionPolicy(accountId, projectId) || { measurement_retention_days: this.defaultMeasurementRetentionDays, event_retention_days: this.defaultEventRetentionDays, source: "default" }; }
  prune(now) { return this.repository.prune(this.defaultMeasurementRetentionDays, this.defaultEventRetentionDays, now); }
}

function normalizeMeasurements(value, context) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new TelemetryError("invalid_measurements", "Messwerte müssen als Liste mit höchstens 100 Einträgen vorliegen.");
  return value.map((item) => ({
    measurement_id: id(item.measurement_id, "measurement"), ...context,
    metric: text(item.metric, "metric", 80), value: finite(item.value, "value"), unit: optionalText(item.unit, 24), aggregation: optionalText(item.aggregation, 32) || "sample",
    measured_at: timestamp(item.measured_at || item.timestamp, "measured_at"), metadata: metadata(item.metadata),
  }));
}

function normalizeEvents(value, context) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new TelemetryError("invalid_events", "Ereignisse müssen als Liste mit höchstens 50 Einträgen vorliegen.");
  return value.map((item) => ({
    event_id: id(item.event_id, "event"), ...context,
    event_type: text(item.event_type, "event_type", 80), severity: ["info", "warning", "critical"].includes(item.severity) ? item.severity : "warning",
    title: text(item.title || item.event_type, "title", 120), body: optionalText(item.body, 500), notify_push: item.notify_push === true,
    occurred_at: timestamp(item.occurred_at || item.timestamp, "occurred_at"), metadata: metadata(item.metadata),
  }));
}
function id(value, prefix) { return String(value || `${prefix}_${crypto.randomUUID()}`).trim().slice(0, 128); }
function requiredId(value, field) { const normalized = String(value || "").trim().slice(0, 128); if (!normalized) throw new TelemetryError("missing_field", `${field} wird benötigt.`, 400, { field }); return normalized; }
function text(value, field, max) { const normalized = optionalText(value, max); if (!normalized) throw new TelemetryError("missing_field", `${field} wird benötigt.`, 400, { field }); return normalized; }
function optionalText(value, max) { return String(value || "").trim().slice(0, max); }
function finite(value, field) { const numeric = Number(value); if (!Number.isFinite(numeric)) throw new TelemetryError("invalid_field", `${field} muss eine endliche Zahl sein.`, 400, { field }); return numeric; }
function timestamp(value, field) { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new TelemetryError("invalid_field", `${field} muss ein gültiger Zeitpunkt sein.`, 400, { field }); return date.toISOString(); }
function metadata(value) { return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, entry]) => [String(key).slice(0, 80), String(entry).slice(0, 300)])) : {}; }
function days(value, fallback) { const result = Number(value ?? fallback); if (!Number.isInteger(result) || result < 1 || result > 3650) throw new TelemetryError("invalid_retention", "Die Aufbewahrungsdauer muss zwischen 1 und 3650 Tagen liegen."); return result; }

module.exports = { TelemetryService };
