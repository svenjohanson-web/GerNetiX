const { issueInternalToken } = require("../../shared/internal-api-auth");

function createIdentityPushNotifier({ identityBaseUrl, internalApiSigningKey, fetchImpl = fetch }) {
  return async function notify(event) {
    if (!internalApiSigningKey) return { skipped: "internal_api_signing_key_missing" };
    const token = issueInternalToken({ iss: "telemetry-server", sub: "telemetry-server", aud: "identity-server", scopes: ["identity.push.device"] }, internalApiSigningKey);
    const response = await fetchImpl(`${identityBaseUrl}/api/internal/push/device-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ account_id: event.account_id, project_id: event.project_id, device_id: event.device_id, title: event.title, body: event.body, url: `/app/ide/?project=${encodeURIComponent(event.project_id)}` }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "push_notification_failed");
    return payload;
  };
}

module.exports = { createIdentityPushNotifier };
