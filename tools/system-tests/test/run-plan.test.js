"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadProfile } = require("../lib/config");
const { assertSafeMqttTarget, buildRunPlan, secondsToK6Duration } = require("../lib/run-plan");

test("builds one aligned smoke plan without embedding credentials", () => {
  const plan = buildRunPlan(loadProfile("smoke"));
  assert.equal(plan.api.environment.VUS, "3");
  assert.equal(plan.api.environment.REQUEST_TIMEOUT_MS, "5000");
  assert.equal(plan.devices.arguments.includes("4"), true);
  assert.equal(plan.devices.arguments[plan.devices.arguments.indexOf("--device-map") + 1], "tools/system-tests/fixtures/manifest.v1.json");
  assert.equal(plan.api.environment.PASSWORD, undefined);
  assert.deepEqual(plan.api.secret_environment, ["USERNAME", "USERNAME_TEMPLATE", "PASSWORD", "PASSWORD_TEMPLATE"]);
  assert.equal(plan.chaos.automatic_activation, false);
});

test("maps chaos onto the load executor without activating faults", () => {
  const plan = buildRunPlan(loadProfile("chaos"));
  assert.equal(plan.api.environment.PROFILE, "load");
  assert.equal(plan.chaos.enabled, true);
  assert.equal(plan.chaos.scenarios.includes("postgres_connection_cut"), true);
});

test("rejects non-loopback MQTT targets", () => {
  assert.equal(assertSafeMqttTarget("mqtt://127.0.0.1:51883"), "mqtt://127.0.0.1:51883");
  assert.throws(() => assertSafeMqttTarget("mqtt://127.0.0.1:1883"), /dedicated port 51883/);
  assert.throws(() => assertSafeMqttTarget("mqtts://mqtt.example.test:8883"), /must use mqtt/);
  assert.throws(() => buildRunPlan(loadProfile("smoke"), { identityUrl: "https://staging.example.test" }), /Refusing non-loopback/);
  assert.throws(() => buildRunPlan(loadProfile("smoke"), { identityUrl: "http://127.0.0.1:4300" }), /dedicated port 14300/);
});

test("formats bounded durations for k6", () => {
  assert.equal(secondsToK6Duration(120), "2m");
  assert.equal(secondsToK6Duration(125), "125s");
});
