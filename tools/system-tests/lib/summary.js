"use strict";

function evaluateRun(profile, results = {}) {
  const checks = [];
  const api = results.api || {};
  checks.push(limit("api.p95_ms", api.p95_ms, profile.api.p95_ms));
  checks.push(limit("api.p99_ms", api.p99_ms, profile.api.p99_ms));
  checks.push(limit("api.unexpected_error_rate", api.unexpected_error_rate, profile.api.unexpected_error_rate));
  checks.push(exact("integrity.ok", results.integrity?.ok, true));

  if (profile.devices.count > 0) {
    checks.push(minimum("devices.connected", results.devices?.connected, profile.devices.count));
    checks.push(exact("devices.secret_leaks", results.devices?.secret_leaks, 0));
  }
  if (profile.chaos.enabled) {
    for (const scenario of profile.chaos.scenarios) {
      checks.push(exact(`chaos.${scenario}.recovered`, results.chaos?.[scenario]?.recovered, true));
    }
  }

  return Object.freeze({
    schema_version: 1,
    profile: profile.profile,
    passed: checks.every((check) => check.passed),
    checks,
  });
}

function limit(name, actual, expectedMaximum) {
  return result(name, actual, `<= ${expectedMaximum}`, Number.isFinite(actual) && actual <= expectedMaximum);
}

function minimum(name, actual, expectedMinimum) {
  return result(name, actual, `>= ${expectedMinimum}`, Number.isFinite(actual) && actual >= expectedMinimum);
}

function exact(name, actual, expected) {
  return result(name, actual, `= ${String(expected)}`, actual === expected);
}

function result(name, actual, expected, passed) {
  return Object.freeze({ name, actual: actual ?? null, expected, passed });
}

module.exports = { evaluateRun };
