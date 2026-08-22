"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { AdminService } = require("../src");
const { verifyInternalToken } = require("../../shared/internal-api-auth");

test("issues a scoped internal token only from Admin Tool to Project Server", async () => {
  let request;
  const service = new AdminService({
    repository: { listSystemEvents: async () => [{ event_type: "forgejo.backup.completed", occurred_at: "2026-08-17T10:00:00.000Z" }] }, accessPolicy: {}, llmConfigStore: {},
    serviceClients: { projectServerBaseUrl: "http://project.test", internalApiSigningKey: "test-signing-key", projectAdminReadToken: "read-token" },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ summary: { builds: 4 } }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  const result = await service.sourceRepositories();
  assert.equal(result.summary.builds, 4);
  assert.equal(request.url, "http://project.test/api/internal/repositories/summary");
  // Das signierte Dienst-Token ist die tragende Absicherung; der Project Server
  // laesst die Zusammenfassung ausschliesslich mit project.admin heraus.
  const claims = verifyInternalToken(request.options.headers.Authorization.replace(/^Bearer\s+/, ""), "test-signing-key", {
    audience: "project-server", requiredScopes: ["project.admin"],
  });
  assert.equal(claims.sub, "admin-tool");
  assert.equal(result.recovery.last_backup.event_type, "forgejo.backup.completed");
  assert.equal(result.recovery.last_restore, null);
});
