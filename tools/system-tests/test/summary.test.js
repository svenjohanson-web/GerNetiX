"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadProfile } = require("../lib/config");
const { evaluateRun } = require("../lib/summary");

test("passes a smoke run within all limits", () => {
  const result = evaluateRun(loadProfile("smoke"), {
    api: { p95_ms: 400, p99_ms: 900, unexpected_error_rate: 0.005 },
    devices: { connected: 4, secret_leaks: 0 },
    integrity: { ok: true },
  });
  assert.equal(result.passed, true);
});

test("fails closed when measurements are missing", () => {
  const result = evaluateRun(loadProfile("smoke"), {});
  assert.equal(result.passed, false);
  assert.equal(result.checks.every((check) => check.passed === false), true);
});

test("requires every configured chaos scenario to recover", () => {
  const profile = loadProfile("chaos");
  const chaos = Object.fromEntries(profile.chaos.scenarios.map((scenario) => [scenario, { recovered: true }]));
  chaos.forgejo_unavailable.recovered = false;
  const result = evaluateRun(profile, {
    api: { p95_ms: 500, p99_ms: 1000, unexpected_error_rate: 0 },
    devices: { connected: 1000, secret_leaks: 0 },
    integrity: { ok: true },
    chaos,
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.name === "chaos.forgejo_unavailable.recovered").passed, false);
});
