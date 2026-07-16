function createIdentityPushNotifier({ identityBaseUrl, identityAdminToken, fetchImpl = fetch }) {
  return async function notify(event) {
    if (!identityAdminToken) return { skipped: "identity_admin_token_missing" };
    const response = await fetchImpl(`${identityBaseUrl}/api/internal/push/device-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GerNetiX-Admin-Token": identityAdminToken },
      body: JSON.stringify({ device_id: event.device_id, title: event.title, body: event.body, url: "/app/dashboard/" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "push_notification_failed");
    return payload;
  };
}

module.exports = { createIdentityPushNotifier };
