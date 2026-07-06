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
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async preflight(payload) {
    const response = await fetch(`${this.baseUrl}/preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readResponse(response);
  }

  async complete(eventId, payload) {
    const response = await fetch(`${this.baseUrl}/events/${encodeURIComponent(eventId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readResponse(response);
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
