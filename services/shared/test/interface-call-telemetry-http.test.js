"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createInterfaceCallTelemetry } = require("../persistence/interface-call-telemetry");
const { verifyInternalToken } = require("../internal-api-auth");

test("forwards interface telemetry to the central Operations endpoint", async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true };
  };
  try {
    createInterfaceCallTelemetry({
      endpoint: "http://admin-tool:4600/api/internal/interface-calls",
      internalApiSigningKey: "secret",
      sourceService: "identity-server",
    }).record({
      targetService: "project-server",
      method: "GET",
      route: "/api/projects?account=private",
      statusCode: 200,
      durationMs: 12,
      succeeded: true,
      actionId: "11111111-1111-4111-8111-111111111111",
      actionType: "project.settings.save",
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(request.url, "http://admin-tool:4600/api/internal/interface-calls");
    verifyInternalToken(request.options.headers.Authorization.replace(/^Bearer\s+/, ""), "secret", { audience: "admin-tool", requiredScopes: ["operations.interface_calls.write"] });
    const body = JSON.parse(request.options.body);
    assert.equal(body.source_service, "identity-server");
    assert.equal(body.route, "/api/projects");
    assert.equal(body.action_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(body.action_type, "project.settings.save");
  } finally {
    global.fetch = originalFetch;
  }
});
