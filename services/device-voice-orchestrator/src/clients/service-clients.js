const { DeviceVoiceError } = require("../errors");

class DeviceManagementClient {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
  }

  async authorizeVoiceSession(deviceId, payload) {
    return requestJson(`${this.baseUrl}/devices/${encodeURIComponent(deviceId)}/voice-authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}

class AiUsageClient {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
  }

  async preflight(payload) {
    return requestJson(`${this.baseUrl}/preflight`, jsonRequest(payload), true);
  }

  async complete(eventId, payload) {
    return requestJson(`${this.baseUrl}/events/${encodeURIComponent(eventId)}/complete`, jsonRequest(payload));
  }

  async fail(eventId, payload) {
    return requestJson(`${this.baseUrl}/events/${encodeURIComponent(eventId)}/fail`, jsonRequest(payload));
  }
}

function jsonRequest(payload) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
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
