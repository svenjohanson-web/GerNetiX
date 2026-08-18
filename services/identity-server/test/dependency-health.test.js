"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDependencyHealthChecker } = require("../src/services/dependency-health");

test("dependency health reports reachable and failed Identity adapters", async () => {
  const checker = createDependencyHealthChecker({
    dependencies: [
      { id: "project-server", name: "Project Server", baseUrl: "http://127.0.0.1:4800" },
      { id: "ai-context", name: "AI Context", baseUrl: "http://127.0.0.1:5500/api" },
    ],
    fetchImpl: async (url) => ({ ok: !url.includes("5500"), status: url.includes("5500") ? 503 : 200 }),
  });
  const result = await checker({ force: true });
  assert.equal(result.status, "degraded");
  assert.equal(result.reachable, 1);
  assert.equal(result.unreachable, 1);
  assert.equal(result.items[1].health_url, "http://127.0.0.1:5500/health");
  assert.equal(result.items[1].error_code, "http_503");
});

test("dependency health classifies connection failures without throwing", async () => {
  const error = new Error("fetch failed");
  error.cause = { code: "ECONNREFUSED" };
  const checker = createDependencyHealthChecker({
    dependencies: [{ id: "project-server", name: "Project Server", baseUrl: "http://127.0.0.1:4800" }],
    fetchImpl: async () => { throw error; },
  });
  const result = await checker({ force: true });
  assert.equal(result.items[0].reachable, false);
  assert.equal(result.items[0].error_code, "econnrefused");
});
