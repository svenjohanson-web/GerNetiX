"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createInterfaceCallTelemetry } = require("../persistence/interface-call-telemetry");

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
      token: "secret",
      sourceService: "identity-server",
    }).record({
      targetService: "project-server",
      method: "GET",
      route: "/api/projects?account=private",
      statusCode: 200,
      durationMs: 12,
      succeeded: true,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(request.url, "http://admin-tool:4600/api/internal/interface-calls");
    assert.equal(request.options.headers["x-gernetix-system-event-token"], "secret");
    const body = JSON.parse(request.options.body);
    assert.equal(body.source_service, "identity-server");
    assert.equal(body.route, "/api/projects");
  } finally {
    global.fetch = originalFetch;
  }
});
