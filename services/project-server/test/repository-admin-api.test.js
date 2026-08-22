"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");
const { InMemoryProjectRepository } = require("../src/repositories/in-memory-project-repository");
const { ProjectService } = require("../src/services/project-service");

test("protects the repository administration summary with a dedicated service token", async () => {
  const app = createHttpApp({
    internalAuthSecret: "project-admin-test-token",
    service: { repositoryAdministrationSummary: async () => ({ summary: { project_repositories: 2 } }) },
  });
  assert.equal((await invoke(app, {})).statusCode, 403);
  // Ein Dienst-Token ohne den Verwaltungs-Scope reicht ausdruecklich nicht.
  const readOnly = issueInternalToken({ iss: "admin-tool", sub: "admin-tool", aud: "project-server", scopes: ["project.read"] }, "project-admin-test-token");
  assert.equal((await invoke(app, { authorization: `Bearer ${readOnly}` })).statusCode, 403);
  const token = issueInternalToken({ iss: "admin-tool", sub: "admin-tool", aud: "project-server", scopes: ["project.admin"] }, "project-admin-test-token");
  const allowed = await invoke(app, { authorization: `Bearer ${token}` });
  assert.equal(allowed.statusCode, 200);
  assert.equal(JSON.parse(allowed.body).summary.project_repositories, 2);
});

test("raises read-only operations alerts for an unavailable binding and an orphan repository", async () => {
  const repository = new InMemoryProjectRepository();
  await repository.saveProject({
    project_id: "project-unavailable", user_id: "account-operations", title: "Unavailable", status: "active",
    repository_binding: { provider: "forgejo", organization: "gernetix-projects", repository_name: "project-unavailable", state: "active", head_sha: "a".repeat(40) },
  });
  const service = new ProjectService({
    repository,
    projectRepositoryStore: {
      inspectProjectRepository: async () => { const error = new Error("down"); error.code = "forgejo_unavailable"; throw error; },
      listOrphanProjectRepositories: async () => [{ organization: "gernetix-projects", repository_name: "project-orphan" }],
    },
  });
  const result = await service.repositoryAdministrationSummary();
  assert.equal(result.summary.project_repositories_unavailable, 1);
  assert.equal(result.summary.orphan_project_repositories, 1);
  assert.ok(result.alerts.some((alert) => alert.code === "project_repository_unavailable"));
  assert.ok(result.alerts.some((alert) => alert.code === "orphan_project_repository"));
});

async function invoke(app, headers) {
  const req = Object.assign(new EventEmitter(), {
    method: "GET",
    url: "/api/internal/repositories/summary",
    headers: { host: "project-server.test", ...headers },
  });
  const chunks = [];
  const res = {
    statusCode: 0,
    headers: {},
    writeHead(statusCode, responseHeaders) { this.statusCode = statusCode; this.headers = { ...this.headers, ...responseHeaders }; },
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk = "") { chunks.push(Buffer.from(String(chunk))); },
  };
  await app(req, res);
  return { statusCode: res.statusCode, body: Buffer.concat(chunks).toString("utf8") };
}
