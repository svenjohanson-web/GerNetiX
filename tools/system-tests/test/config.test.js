"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertSafeTarget, loadProfile, validateProfile } = require("../lib/config");

test("loads every versioned system-test profile", () => {
  for (const name of ["smoke", "load", "chaos"]) {
    assert.equal(loadProfile(name).profile, name);
  }
});

test("rejects remote and staging targets", () => {
  assert.equal(assertSafeTarget("http://127.0.0.1:4300").port, "4300");
  assert.throws(() => assertSafeTarget("https://staging.example.test"), /Refusing non-loopback/);
});

test("rejects unsafe or unbounded profile values", () => {
  const profile = structuredClone(loadProfile("smoke"));
  profile.devices.reconnect_max_ms = 1;
  assert.throws(() => validateProfile(profile), /devices\.reconnect_max_ms/);
});

test("rejects undeclared chaos operations", () => {
  const profile = structuredClone(loadProfile("chaos"));
  profile.chaos.scenarios.push("delete_volumes");
  assert.throws(() => validateProfile(profile), /Unknown chaos scenario/);
});
