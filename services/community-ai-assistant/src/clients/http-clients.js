class CommunityPlatformClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async search(query) {
    const response = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
    return readResponse(response);
  }

  async knowledgeDocuments() {
    const response = await fetch(`${this.baseUrl}/knowledge-documents?verification_state=verified`);
    return readResponse(response);
  }
}

class AiUsageClient {
  constructor(baseUrl, signingKey = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.signingKey = signingKey;
  }

  async preflight(payload, delegationContext) {
    const response = await fetch(`${this.baseUrl}/preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders(delegationContext) },
      body: JSON.stringify(payload),
    });
    return readResponse(response);
  }

  async complete(eventId, payload, delegationContext) {
    const response = await fetch(`${this.baseUrl}/events/${encodeURIComponent(eventId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders(delegationContext) },
      body: JSON.stringify(payload),
    });
    return readResponse(response);
  }

  authHeaders(context = {}) {
    const scopes = ["ai.usage.consume"];
    const serviceToken = issueInternalToken({ iss: "community-ai-assistant", sub: "community-ai-assistant", aud: "ai-usage-server", scopes }, this.signingKey);
    const delegation = issueInternalToken({ iss: "community-ai-assistant", sub: "community-ai-assistant", aud: "ai-usage-server", kind: "delegated_user_action", scopes, context }, this.signingKey);
    return { Authorization: `Bearer ${serviceToken}`, "X-GerNetiX-Delegation": delegation };
  }
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "Upstream request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

module.exports = { CommunityPlatformClient, AiUsageClient };
const { issueInternalToken } = require("../../../shared/internal-api-auth");
