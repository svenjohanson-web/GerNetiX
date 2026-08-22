const assert = require("node:assert/strict");
const test = require("node:test");

const { AiUsageClient, DeviceManagementClient, createConfig } = require("../src");
const { verifyDelegation, verifyInternalToken } = require("../../shared/internal-api-auth");

test("AI Usage calls carry a short service identity and an exact user delegation", () => {
  const secret = "device-voice-test-signing-key";
  const client = new AiUsageClient("http://ai-usage.invalid/api/ai-usage", secret);
  const headers = client.authHeaders({
    account_id: "acct-parent",
    project_ids: ["project-nexi"],
    entitlements: ["ai_assistant"],
  });

  const service = verifyInternalToken(headers.Authorization.replace(/^Bearer /, ""), secret, {
    audience: "ai-usage-server",
    requiredScopes: ["ai.usage.consume"],
  });
  const delegation = verifyDelegation(headers["X-GerNetiX-Delegation"], secret, {
    audience: "ai-usage-server",
    requiredScopes: ["ai.usage.consume"],
  });

  assert.equal(service.sub, "device-voice-orchestrator");
  assert.equal(delegation.context.account_id, "acct-parent");
  assert.deepEqual(delegation.context.project_ids, ["project-nexi"]);
  assert.deepEqual(delegation.context.entitlements, ["ai_assistant"]);
});

test("AI Usage authentication fails closed without a configured signing key", () => {
  const client = new AiUsageClient("http://ai-usage.invalid/api/ai-usage");
  assert.throws(() => client.authHeaders({ account_id: "acct" }), /nicht konfiguriert/);
  assert.equal(createConfig({}).internalApiSigningKey, "");
});

test("Device Management call carries only the voice authorization scope", async () => {
  const secret = "device-voice-test-signing-key";
  const originalFetch = global.fetch;
  let headers;
  global.fetch = async (_url, options) => {
    headers = options.headers;
    return { ok: true, status: 200, async json() { return { authorized: true }; } };
  };
  try {
    const client = new DeviceManagementClient("http://device.invalid/api/device-management", secret);
    await client.authorizeVoiceSession("device-1", { account_id: "acct-1" });
    const claims = verifyInternalToken(headers.Authorization.replace(/^Bearer /, ""), secret, {
      audience: "device-management-server", requiredScopes: ["device.voice.authorize"],
    });
    assert.equal(claims.sub, "device-voice-orchestrator");
    assert.deepEqual(claims.scopes, ["device.voice.authorize"]);
  } finally {
    global.fetch = originalFetch;
  }
});
