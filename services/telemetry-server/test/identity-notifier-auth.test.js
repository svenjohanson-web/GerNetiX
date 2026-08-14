const assert = require("node:assert/strict");
const test = require("node:test");
const { verifyInternalToken } = require("../../shared/internal-api-auth");
const { createIdentityPushNotifier } = require("../src/push-notifier");
const { createIdentityRuntimeNotifier } = require("../src/runtime-notifier");

test("telemetry identity notifiers use separate scoped service tokens", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ accepted: true }) };
  };
  const config = { identityBaseUrl: "http://identity", internalApiSigningKey: "notifier-signing-key", fetchImpl };
  await createIdentityPushNotifier(config)({ account_id: "acct-1", project_id: "project-1", device_id: "device-1" });
  await createIdentityRuntimeNotifier(config)({ account_id: "acct-1", project_id: "project-1", device_id: "device-1" });
  verifyInternalToken(calls[0].options.headers.Authorization.replace(/^Bearer\s+/, ""), "notifier-signing-key", { audience: "identity-server", requiredScopes: ["identity.push.device"] });
  verifyInternalToken(calls[1].options.headers.Authorization.replace(/^Bearer\s+/, ""), "notifier-signing-key", { audience: "identity-server", requiredScopes: ["identity.runtime.device"] });
  assert.equal(calls[0].options.headers["X-GerNetiX-Admin-Token"], undefined);
});
