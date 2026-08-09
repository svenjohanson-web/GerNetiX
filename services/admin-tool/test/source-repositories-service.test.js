"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { AdminService } = require("../src");

test("forwards the repository read token only from Admin Tool to Project Server", async () => {
  let request;
  const service = new AdminService({
    repository: {}, accessPolicy: {}, llmConfigStore: {},
    serviceClients: { projectServerBaseUrl: "http://project.test", projectAdminReadToken: "read-token" },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ summary: { builds: 4 } }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  const result = await service.sourceRepositories();
  assert.equal(result.summary.builds, 4);
  assert.equal(request.url, "http://project.test/api/internal/repositories/summary");
  assert.equal(request.options.headers["X-GerNetiX-Project-Admin-Token"], "read-token");
});
