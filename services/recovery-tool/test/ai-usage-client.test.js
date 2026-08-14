const assert = require("node:assert/strict");
const test = require("node:test");
const { AiUsageClient } = require("../src/services/ai-usage-client");
const { verifyDelegation, verifyInternalToken } = require("../../shared/internal-api-auth");

test("AI Usage client performs preflight and completion bookings", async () => {
  const calls = [];
  const client = new AiUsageClient({
    baseUrl: "https://usage.test/api/ai-usage/",
    signingKey: "recovery-tool-test-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body), headers: options.headers });
      return new Response(JSON.stringify(url.endsWith("/preflight") ? { allowed: true, event_id: "event-1" } : { status: "success" }), { status: 200 });
    },
  });
  const context = { account_id: "acct-1", project_ids: [], entitlements: ["ai_assistant"] };
  assert.equal((await client.preflight({ account_id: "acct-1" }, context)).event_id, "event-1");
  assert.equal((await client.complete("event-1", { input_tokens: 4, output_tokens: 2 }, context)).status, "success");
  assert.equal(calls[0].url, "https://usage.test/api/ai-usage/preflight");
  assert.equal(calls[1].url, "https://usage.test/api/ai-usage/events/event-1/complete");
  assert.equal(verifyInternalToken(calls[0].headers.Authorization.replace(/^Bearer /, ""), "recovery-tool-test-key", {
    audience: "ai-usage-server", requiredScopes: ["ai.usage.consume"],
  }).sub, "recovery-tool");
  assert.equal(verifyDelegation(calls[0].headers["X-GerNetiX-Delegation"], "recovery-tool-test-key", {
    audience: "ai-usage-server", requiredScopes: ["ai.usage.consume"],
  }).context.account_id, "acct-1");
});

test("AI Usage client fails closed without a signing key", () => {
  const client = new AiUsageClient({ baseUrl: "https://usage.test/api/ai-usage" });
  assert.throws(() => client.authHeaders({ account_id: "acct-1" }), /nicht konfiguriert/);
});
