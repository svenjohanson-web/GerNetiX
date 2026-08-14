const { issueInternalToken } = require("../../shared/internal-api-auth");

function createIdentityRuntimeNotifier({ identityBaseUrl, internalApiSigningKey, fetchImpl = fetch }) {
  return async function notify(runtime) {
    if (!internalApiSigningKey) return { skipped: "internal_api_signing_key_missing" };
    const token = issueInternalToken({ iss: "telemetry-server", sub: "telemetry-server", aud: "identity-server", scopes: ["identity.runtime.device"] }, internalApiSigningKey);
    const response = await fetchImpl(`${identityBaseUrl}/api/internal/runtime/device-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(runtime),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "runtime_event_delivery_failed");
    return payload;
  };
}

module.exports = { createIdentityRuntimeNotifier };
