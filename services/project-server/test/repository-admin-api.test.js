"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp, sendJson } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

test("protects the repository administration summary with a dedicated service token", async () => {
  const app = createHttpApp({
    internalAuthSecret: "project-admin-test-token",
    service: { repositoryAdministrationSummary: async () => ({ summary: { project_repositories: 2 } }) },
  });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/internal/repositories/summary`;
  try {
    assert.equal((await fetch(url)).status, 403);
    const token = issueInternalToken({ iss: "admin-tool", sub: "admin-tool", aud: "project-server", scopes: ["project.admin"] }, "project-admin-test-token");
    const allowed = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).summary.project_repositories, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
