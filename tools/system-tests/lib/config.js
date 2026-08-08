"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_PROFILES = new Set(["smoke", "load", "chaos"]);
const ALLOWED_CHAOS_SCENARIOS = new Set([
  "forgejo_latency",
  "forgejo_unavailable",
  "postgres_connection_cut",
  "mqtt_connection_cut",
]);

function loadProfile(profileName, options = {}) {
  if (!ALLOWED_PROFILES.has(profileName)) {
    throw new Error(`Unknown system-test profile: ${profileName}`);
  }
  const configDirectory = options.configDirectory || path.resolve(__dirname, "..", "config");
  const file = path.join(configDirectory, `${profileName}.json`);
  const profile = JSON.parse(fs.readFileSync(file, "utf8"));
  return validateProfile(profile);
}

function validateProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) throw new Error("Profile must be an object");
  if (profile.schema_version !== 1) throw new Error("Unsupported system-test profile schema");
  if (!ALLOWED_PROFILES.has(profile.profile)) throw new Error("Profile name is not allowed");
  if (profile.environment !== "isolated-local") throw new Error("System tests require environment=isolated-local");
  requireInteger(profile.duration_seconds, "duration_seconds", 1, 86_400);

  requireObject(profile.api, "api");
  requireInteger(profile.api.virtual_users, "api.virtual_users", 1, 10_000);
  requireInteger(profile.api.request_timeout_ms, "api.request_timeout_ms", 100, 120_000);
  requireInteger(profile.api.p95_ms, "api.p95_ms", 1, 120_000);
  requireInteger(profile.api.p99_ms, "api.p99_ms", profile.api.p95_ms, 120_000);
  requireRate(profile.api.unexpected_error_rate, "api.unexpected_error_rate");

  requireObject(profile.devices, "devices");
  requireInteger(profile.devices.count, "devices.count", 0, 100_000);
  requireInteger(profile.devices.publish_interval_ms, "devices.publish_interval_ms", 100, 3_600_000);
  requireInteger(profile.devices.reconnect_base_ms, "devices.reconnect_base_ms", 10, 300_000);
  requireInteger(profile.devices.reconnect_max_ms, "devices.reconnect_max_ms", profile.devices.reconnect_base_ms, 3_600_000);
  requireRate(profile.devices.duplicate_rate, "devices.duplicate_rate");
  requireRate(profile.devices.late_rate, "devices.late_rate");

  requireObject(profile.chaos, "chaos");
  if (typeof profile.chaos.enabled !== "boolean") throw new Error("chaos.enabled must be boolean");
  if (!Array.isArray(profile.chaos.scenarios)) throw new Error("chaos.scenarios must be an array");
  for (const scenario of profile.chaos.scenarios) {
    if (!ALLOWED_CHAOS_SCENARIOS.has(scenario)) throw new Error(`Unknown chaos scenario: ${scenario}`);
  }
  if (!profile.chaos.enabled && profile.chaos.scenarios.length > 0) {
    throw new Error("Disabled chaos profile cannot declare scenarios");
  }
  return Object.freeze(profile);
}

function assertSafeTarget(target) {
  const url = new URL(target);
  const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error(`Refusing non-loopback system-test target: ${url.hostname}`);
  }
  return url;
}

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
}

function requireInteger(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function requireRate(value, field) {
  if (typeof value !== "number" || value < 0 || value > 1) throw new Error(`${field} must be between 0 and 1`);
}

module.exports = { ALLOWED_CHAOS_SCENARIOS, assertSafeTarget, loadProfile, validateProfile };
