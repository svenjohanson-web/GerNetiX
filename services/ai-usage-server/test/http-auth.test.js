const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { createHttpApp } = require("../src/http-app");
const { AiUsageService } = require("../src/services/ai-usage-service");
const { InMemoryAiUsageRepository } = require("../src/repositories/in-memory-ai-usage-repository");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "ai-usage-contract-test-secret";

test("AI Usage rejects missing service credentials and enforces delegated account context", async () => {
  const app = createHttpApp({ service: new AiUsageService({ repository: new InMemoryAiUsageRepository() }), internalApiSigningKey: secret });
  const server = await start(app);
  try {
    const missing = await request(server, "/api/ai-usage/accounts/acct-demo/credits");
    assert.equal(missing.status, 403);
    assert.equal(missing.body.error, "internal_token_invalid");

    const serviceToken = token({ sub: "identity-server", scopes: ["ai.usage.read"] });
    const withoutDelegation = await request(server, "/api/ai-usage/accounts/acct-demo/credits", { authorization: `Bearer ${serviceToken}` });
    assert.equal(withoutDelegation.status, 403);
    assert.equal(withoutDelegation.body.error, "internal_token_invalid");

    const foreignDelegation = delegation({ account_id: "acct-other" }, ["ai.usage.read"]);
    const forbidden = await request(server, "/api/ai-usage/accounts/acct-demo/credits", {
      authorization: `Bearer ${serviceToken}`,
      "x-gernetix-delegation": foreignDelegation,
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error, "delegated_account_access_denied");

    const permitted = await request(server, "/api/ai-usage/accounts/acct-demo/credits", {
      authorization: `Bearer ${serviceToken}`,
      "x-gernetix-delegation": delegation({ account_id: "acct-demo" }, ["ai.usage.read"]),
    });
    assert.equal(permitted.status, 200);
    assert.equal(permitted.body.account_id, "acct-demo");
  } finally { await close(server); }
});

test("AI Usage requires consume scope and matching entitled delegation for preflight", async () => {
  const app = createHttpApp({ service: new AiUsageService({ repository: new InMemoryAiUsageRepository() }), internalApiSigningKey: secret });
  const server = await start(app);
  try {
    const input = { account_id: "acct-demo", user_id: "acct-demo", project_id: "project-1", model: "gpt-5-nano", estimated_input_tokens: 1, estimated_output_tokens: 1 };
    const serviceToken = token({ sub: "identity-server", scopes: ["ai.usage.consume"] });
    const denied = await request(server, "/api/ai-usage/preflight", {
      authorization: `Bearer ${serviceToken}`,
      "x-gernetix-delegation": delegation({ account_id: "acct-demo", project_ids: ["project-1"] }, ["ai.usage.consume"]),
      "content-type": "application/json",
    }, input);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error, "delegated_entitlement_denied");

    const allowed = await request(server, "/api/ai-usage/preflight", {
      authorization: `Bearer ${serviceToken}`,
      "x-gernetix-delegation": delegation({ account_id: "acct-demo", project_ids: ["project-1"], entitlements: ["ai_assistant"] }, ["ai.usage.consume"]),
      "content-type": "application/json",
    }, input);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.allowed, true);
  } finally { await close(server); }
});

function token({ sub, scopes }) { return issueInternalToken({ iss: "identity-server", sub, aud: "ai-usage-server", scopes }, secret); }
function delegation(context, scopes) { return issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "ai-usage-server", kind: "delegated_user_action", scopes, context }, secret); }
function start(app) { return new Promise((resolve) => { const server = http.createServer((req, res) => app(req, res).catch((error) => { res.writeHead(error.status || 500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: error.code || "internal_error" })); })); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
function close(server) { return new Promise((resolve) => server.close(resolve)); }
async function request(server, path, headers = {}, body) { const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; }
