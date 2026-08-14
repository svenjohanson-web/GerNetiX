const { DeviceVoiceError } = require("../errors");
const { issueInternalToken } = require("../../../shared/internal-api-auth");

class DeviceManagementClient {
  constructor(baseUrl, signingKey = "") {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.signingKey = signingKey;
  }

  async authorizeVoiceSession(deviceId, payload) {
    return requestJson(`${this.baseUrl}/devices/${encodeURIComponent(deviceId)}/voice-authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${issueInternalToken({ iss: "device-voice-orchestrator", sub: "device-voice-orchestrator", aud: "device-management-server", scopes: ["device.voice.authorize"] }, this.signingKey)}` },
      body: JSON.stringify(payload),
    });
  }
}

class AiUsageClient {
  constructor(baseUrl, signingKey = "") {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.signingKey = signingKey;
  }

  async preflight(payload, delegationContext) {
    return requestJson(`${this.baseUrl}/preflight`, jsonRequest(payload, this.authHeaders(delegationContext)), true);
  }

  async complete(eventId, payload, delegationContext) {
    return requestJson(`${this.baseUrl}/events/${encodeURIComponent(eventId)}/complete`, jsonRequest(payload, this.authHeaders(delegationContext)));
  }

  async fail(eventId, payload, delegationContext) {
    return requestJson(`${this.baseUrl}/events/${encodeURIComponent(eventId)}/fail`, jsonRequest(payload, this.authHeaders(delegationContext)));
  }

  authHeaders(context = {}) {
    const scopes = ["ai.usage.consume"];
    const common = { iss: "device-voice-orchestrator", sub: "device-voice-orchestrator", aud: "ai-usage-server", scopes };
    return {
      Authorization: `Bearer ${issueInternalToken(common, this.signingKey)}`,
      "X-GerNetiX-Delegation": issueInternalToken({ ...common, kind: "delegated_user_action", context }, this.signingKey),
    };
  }
}

function jsonRequest(payload, headers = {}) {
  return { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload) };
}

async function requestJson(url, options, allowPaymentRequired = false) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !(allowPaymentRequired && response.status === 402)) {
    throw new DeviceVoiceError(
      payload.error || "voice_upstream_failed",
      payload.message || "Ein interner GerNetiX-Dienst ist nicht erreichbar.",
      response.status >= 500 ? 503 : response.status,
    );
  }
  return payload;
}

module.exports = { AiUsageClient, DeviceManagementClient };
