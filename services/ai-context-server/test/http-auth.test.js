const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { createHttpApp } = require("../src/http-app");
const { AiContextService } = require("../src/services/ai-context-service");
const { InMemoryAiContextRepository } = require("../src/repositories/in-memory-ai-context-repository");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "ai-context-contract-test-secret";

test("AI Context protects all business routes with a scoped service token", async () => {
  const server = await start(createHttpApp({ service: service(), internalApiSigningKey: secret }));
  try {
    const missing = await request(server, "/api/ai-context/architecture-components");
    assert.equal(missing.status, 403);
    const wrongScope = await request(server, "/api/ai-context/architecture-components", { authorization: `Bearer ${token(["ai.context.admin"])}` });
    assert.equal(wrongScope.status, 403);
    assert.equal(wrongScope.body.error, "internal_token_scope_denied");
    const allowed = await request(server, "/api/ai-context/architecture-components", { authorization: `Bearer ${token(["ai.context.read"])}` });
    assert.equal(allowed.status, 200);
    assert.ok(allowed.body.items.length > 0);
  } finally { await close(server); }
});

test("AI Context preflight binds account, project and entitlement to the delegation", async () => {
  const server = await start(createHttpApp({ service: service(), internalApiSigningKey: secret }));
  try {
    const input = { account_id: "account-1", project_id: "project-1", source_type: "project_files", source_scope: "projects/project-1", purpose: "architecture_assistance", provider: "ollama" };
    const headers = { authorization: `Bearer ${token(["ai.context.use"])}`, "content-type": "application/json" };
    const denied = await request(server, "/api/ai-context/preflight", { ...headers, "x-gernetix-delegation": delegation({ account_id: "account-1", project_ids: ["project-other"], entitlements: ["ai_assistant"] }, ["ai.context.use"]) }, input);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error, "delegated_project_access_denied");
    const allowed = await request(server, "/api/ai-context/preflight", { ...headers, "x-gernetix-delegation": delegation({ account_id: "account-1", project_ids: ["project-1"], entitlements: ["ai_assistant"] }, ["ai.context.use"]) }, input);
    assert.equal(allowed.status, 403); // Authenticated; domain policy still denies without an explicit context grant.
    assert.equal(allowed.body.reason, "missing_valid_grant");
  } finally { await close(server); }
});

function service() { return new AiContextService({ repository: new InMemoryAiContextRepository() }); }
function token(scopes) { return issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "ai-context-server", scopes }, secret); }
function delegation(context, scopes) { return issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "ai-context-server", kind: "delegated_user_action", scopes, context }, secret); }
function start(app) { return new Promise((resolve) => { const server = http.createServer(app); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
function close(server) { return new Promise((resolve) => server.close(resolve)); }
async function request(server, path, headers = {}, body) { const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; }
