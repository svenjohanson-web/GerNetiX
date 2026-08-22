const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { AiUsageClient } = require("../src/services/ai-usage-client");
const { readInternalApiAuthConfig, verifyDelegation, verifyInternalToken } = require("../../shared/internal-api-auth");

function ed25519Keyring(serviceId, kid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return readInternalApiAuthConfig({
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({
      [kid]: { issuer: serviceId, publicKeyB64: publicKey.export({ format: "der", type: "spki" }).toString("base64") },
    }),
    INTERNAL_API_SIGNING_KEY_ID: kid,
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  }, { serviceId });
}

test("AI Usage client signs with the active key id instead of a legacy token", async () => {
  const signingKey = ed25519Keyring("recovery-tool", "recovery-tool-test");
  const calls = [];
  const client = new AiUsageClient({
    baseUrl: "https://usage.test/api/ai-usage",
    signingKey,
    fetchImpl: async (url, options) => {
      calls.push({ headers: options.headers });
      return new Response(JSON.stringify({ allowed: true, event_id: "event-1" }), { status: 200 });
    },
  });
  await client.preflight({ account_id: "acct-1" }, { account_id: "acct-1", project_ids: [], entitlements: ["ai_assistant"] });
  const claims = verifyInternalToken(calls[0].headers.Authorization.replace(/^Bearer /, ""), signingKey, {
    audience: "ai-usage-server", requiredScopes: ["ai.usage.consume"],
  });
  assert.equal(claims.kid, "recovery-tool-test");
  assert.equal(claims.alg, "Ed25519");
});

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
