"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertSafeBaseUrl, loadConfig } = require("../src/config");

const credentials = {
  GERNETIX_BROWSER_SESSION_COOKIE_NAME: "gernetix_test_session",
  GERNETIX_BROWSER_SESSION_COOKIE_VALUE: "test-secret-from-env",
};

test("accepts loopback targets and conservative single-worker defaults", () => {
  const config = loadConfig({ ...credentials, GERNETIX_BROWSER_BASE_URL: "http://127.0.0.1:4300" });
  assert.equal(config.baseUrl.origin, "http://127.0.0.1:4300");
  assert.equal(config.workers, 1);
  assert.equal(config.timeoutMs, 30_000);
});

test("rejects remote targets and credentials embedded in target URLs", () => {
  assert.throws(() => assertSafeBaseUrl("https://staging.gernetix.example"), /non-loopback/);
  assert.throws(() => assertSafeBaseUrl("http://user:secret@127.0.0.1:4300"), /must not contain credentials/);
});

test("requires prepared-session credentials from the environment", () => {
  assert.throws(() => loadConfig({ GERNETIX_BROWSER_SESSION_COOKIE_NAME: "session" }), /SESSION_COOKIE_VALUE_required/);
  assert.throws(() => loadConfig({ GERNETIX_BROWSER_SESSION_COOKIE_VALUE: "secret" }), /SESSION_COOKIE_NAME_required/);
});

test("limits the browser worker count", () => {
  assert.equal(loadConfig({ ...credentials, GERNETIX_BROWSER_WORKERS: "4" }).workers, 4);
  assert.throws(() => loadConfig({ ...credentials, GERNETIX_BROWSER_WORKERS: "5" }), /between 1 and 4/);
});
