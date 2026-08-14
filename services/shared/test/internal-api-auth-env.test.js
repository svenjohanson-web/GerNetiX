"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readOptionalInternalApiAuthConfig } = require("../internal-api-auth-env");

test("unconfigured local services remain startable but receive no auth material", () => {
  assert.equal(readOptionalInternalApiAuthConfig({}, "project-server"), "");
  assert.equal(readOptionalInternalApiAuthConfig({ INTERNAL_API_SIGNING_KEY: "legacy-must-not-be-used" }, "project-server"), "");
});

test("partial asymmetric configuration fails closed", () => {
  assert.throws(
    () => readOptionalInternalApiAuthConfig({ INTERNAL_API_SIGNING_KEY_ID: "project-current" }, "project-server"),
    { code: "internal_auth_not_configured", status: 503 },
  );
});
