function createIdentityRuntimeNotifier({ identityBaseUrl, identityAdminToken, fetchImpl = fetch }) {
  return async function notify(runtime) {
    if (!identityAdminToken) return { skipped: "identity_admin_token_missing" };
    const response = await fetchImpl(`${identityBaseUrl}/api/internal/runtime/device-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GerNetiX-Admin-Token": identityAdminToken },
      body: JSON.stringify(runtime),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "runtime_event_delivery_failed");
    return payload;
  };
}

module.exports = { createIdentityRuntimeNotifier };
