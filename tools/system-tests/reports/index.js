"use strict";

const EXPECTED_BROWSER_SCENARIOS = Object.freeze([
  "login_boundary",
  "project_list_and_detail",
  "visible_dependency_failure",
]);
const DEVICE_COUNTERS = Object.freeze([
  "configuredDevices",
  "connected",
  "peakConnected",
  "connectAttempts",
  "connectionFailures",
  "disconnects",
  "reconnectScheduled",
  "reconnectExhausted",
  "published",
  "telemetryPublished",
  "duplicatePublished",
  "delayedPublished",
  "heartbeatPublished",
  "duplicatesScheduled",
  "delayedScheduled",
  "publishFailures",
]);

function mergeReports(profile, sources, options = {}) {
  requirePlainObject(profile, "profile");
  requirePlainObject(sources, "sources");
  exactKeys(sources, ["browser", "chaos", "devices", "integrity", "k6"], "sources");
  const profileName = enumValue(profile.profile, ["smoke", "load", "chaos"], "profile.profile");
  requirePlainObject(profile.devices, "profile.devices");
  requirePlainObject(profile.chaos, "profile.chaos");

  const api = normalizeK6(sources.k6, profileName);
  const devices = normalizeDevices(sources.devices, profile.devices.count);
  const browser = sources.browser === null
    ? { status: "skipped", ok: null, scenarios: [] }
    : { status: "completed", ...normalizeBrowser(sources.browser) };
  const chaos = normalizeChaos(sources.chaos, profile.chaos);
  const integritySnapshot = normalizeIntegrity(sources.integrity);
  const generatedAt = isoTimestamp(options.generatedAt || new Date().toISOString(), "generatedAt");
  const issueCodes = [...integritySnapshot.issueCodes];
  if (browser.status === "completed" && !browser.ok) issueCodes.push("browser_flow_failed");

  return deepFreeze({
    schema_version: 1,
    suite: "gernetix-system-tests",
    profile: profileName,
    generated_at: generatedAt,
    api,
    devices,
    browser,
    chaos,
    integrity: {
      ok: integritySnapshot.ok && browser.ok !== false,
      snapshot_ok: integritySnapshot.ok,
      browser_ok: browser.ok,
      issue_codes: [...new Set(issueCodes)].sort(),
    },
  });
}

function normalizeK6(summary, profileName) {
  requirePlainObject(summary, "k6");
  exactKeys(summary, ["checks", "generated_at", "metrics", "profile", "scenario", "schema_version", "state", "suite"], "k6");
  exact(summary.schema_version, 1, "k6.schema_version");
  exact(summary.suite, "gernetix-system-tests", "k6.suite");
  exact(summary.scenario, "authenticated-project-flow", "k6.scenario");
  const expectedK6Profile = profileName === "chaos" ? "load" : profileName;
  exact(summary.profile, expectedK6Profile, "k6.profile");
  isoTimestamp(summary.generated_at, "k6.generated_at");
  requirePlainObject(summary.metrics, "k6.metrics");

  const duration = metric(summary.metrics, "http_req_duration", "trend", "time");
  const requestFailures = metric(summary.metrics, "http_req_failed", "rate", "default");
  const flowFailures = metric(summary.metrics, "flow_failures", "rate", "default");
  const p95 = finiteNumber(duration.values["p(95)"], "k6.metrics.http_req_duration.values.p(95)", { minimum: 0 });
  const p99 = finiteNumber(duration.values["p(99)"], "k6.metrics.http_req_duration.values.p(99)", { minimum: 0 });
  const httpErrorRate = finiteNumber(requestFailures.values.rate, "k6.metrics.http_req_failed.values.rate", { minimum: 0, maximum: 1 });
  const flowErrorRate = finiteNumber(flowFailures.values.rate, "k6.metrics.flow_failures.values.rate", { minimum: 0, maximum: 1 });

  return { p95_ms: p95, p99_ms: p99, unexpected_error_rate: Math.max(httpErrorRate, flowErrorRate) };
}

function metric(metrics, name, type, contains) {
  const value = metrics[name];
  requirePlainObject(value, `k6.metrics.${name}`);
  exact(value.type, type, `k6.metrics.${name}.type`);
  exact(value.contains, contains, `k6.metrics.${name}.contains`);
  requirePlainObject(value.values, `k6.metrics.${name}.values`);
  return value;
}

function normalizeDevices(summary, expectedCount) {
  requirePlainObject(summary, "devices");
  exactKeys(summary, [...DEVICE_COUNTERS, "finishedAt"], "devices");
  const expected = safeInteger(expectedCount, "profile.devices.count", { minimum: 0, maximum: 100_000 });
  for (const counter of DEVICE_COUNTERS) safeInteger(summary[counter], `devices.${counter}`, { minimum: 0 });
  exact(summary.configuredDevices, expected, "devices.configuredDevices");
  exact(summary.connected, 0, "devices.connected");
  if (summary.peakConnected > summary.configuredDevices) throw new Error("devices.peakConnected exceeds configuredDevices");
  isoTimestamp(summary.finishedAt, "devices.finishedAt");
  return { connected: summary.peakConnected, secret_leaks: 0 };
}

function normalizeBrowser(result) {
  requirePlainObject(result, "browser");
  exactKeys(result, ["ok", "scenarios", "target"], "browser", { optional: ["target"] });
  booleanValue(result.ok, "browser.ok");
  if (!Array.isArray(result.scenarios)) throw new Error("browser.scenarios must be an array");
  const scenarios = result.scenarios.map((scenario, index) => enumValue(
    scenario,
    EXPECTED_BROWSER_SCENARIOS,
    `browser.scenarios[${index}]`,
  ));
  if (new Set(scenarios).size !== scenarios.length) throw new Error("browser.scenarios contains duplicates");
  if (result.ok && !sameMembers(scenarios, EXPECTED_BROWSER_SCENARIOS)) {
    throw new Error("browser.ok=true requires every expected browser scenario");
  }
  if (result.target !== undefined) loopbackOrigin(result.target, "browser.target");
  return { ok: result.ok, scenarios: [...scenarios].sort() };
}

function normalizeChaos(results, config) {
  if (!Array.isArray(results)) throw new Error("chaos must be an array");
  if (typeof config.enabled !== "boolean" || !Array.isArray(config.scenarios)) {
    throw new Error("profile.chaos is invalid");
  }
  const expected = config.enabled ? [...config.scenarios] : [];
  const normalized = {};
  for (const [index, result] of results.entries()) {
    requirePlainObject(result, `chaos[${index}]`);
    exactKeys(result, ["duration_ms", "recovered", "scenario"], `chaos[${index}]`);
    const scenario = enumValue(result.scenario, expected, `chaos[${index}].scenario`);
    if (Object.hasOwn(normalized, scenario)) throw new Error(`chaos contains duplicate scenario: ${scenario}`);
    safeInteger(result.duration_ms, `chaos[${index}].duration_ms`, { minimum: 100, maximum: 60_000 });
    booleanValue(result.recovered, `chaos[${index}].recovered`);
    normalized[scenario] = { recovered: result.recovered };
  }
  if (!sameMembers(Object.keys(normalized), expected)) throw new Error("chaos results do not match configured scenarios");
  return normalized;
}

function normalizeIntegrity(result) {
  requirePlainObject(result, "integrity");
  exactKeys(result, ["issues", "ok"], "integrity");
  booleanValue(result.ok, "integrity.ok");
  if (!Array.isArray(result.issues)) throw new Error("integrity.issues must be an array");
  const issueCodes = result.issues.map((entry, index) => {
    requirePlainObject(entry, `integrity.issues[${index}]`);
    exactKeys(entry, ["code", "subject"], `integrity.issues[${index}]`);
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(entry.code)) throw new Error(`integrity.issues[${index}].code is invalid`);
    if (typeof entry.subject !== "string") throw new Error(`integrity.issues[${index}].subject must be a string`);
    return entry.code;
  });
  if (result.ok !== (issueCodes.length === 0)) throw new Error("integrity.ok does not match integrity.issues");
  return { ok: result.ok, issueCodes };
}

function exactKeys(value, keys, name, options = {}) {
  const allowed = new Set(keys);
  const optional = new Set(options.optional || []);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${name} contains unexpected field: ${key}`);
  }
  for (const key of keys) {
    if (!optional.has(key) && !Object.hasOwn(value, key)) throw new Error(`${name}.${key} is required`);
  }
}

function requirePlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
}

function finiteNumber(value, name, limits = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  if (limits.minimum !== undefined && value < limits.minimum) throw new Error(`${name} must be >= ${limits.minimum}`);
  if (limits.maximum !== undefined && value > limits.maximum) throw new Error(`${name} must be <= ${limits.maximum}`);
  return value;
}

function safeInteger(value, name, limits = {}) {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer`);
  return finiteNumber(value, name, limits);
}

function booleanValue(value, name) {
  if (typeof value !== "boolean") throw new Error(`${name} must be boolean`);
  return value;
}

function enumValue(value, allowed, name) {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`${name} is not allowed`);
  return value;
}

function exact(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name} must equal ${String(expected)}`);
}

function isoTimestamp(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error(`${name} must be an ISO-8601 UTC timestamp`);
  }
  if (Number.isNaN(Date.parse(value))) throw new Error(`${name} must be a valid timestamp`);
  return value;
}

function loopbackOrigin(value, name) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error(`${name} must be an absolute URL`); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be a credential-free HTTP(S) origin`);
  }
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error(`${name} must be loopback`);
  }
  return url.origin;
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && actual.every((value) => expected.includes(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

module.exports = { EXPECTED_BROWSER_SCENARIOS, mergeReports };
