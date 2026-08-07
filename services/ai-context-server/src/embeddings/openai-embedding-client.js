class OpenAiEmbeddingClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = options.model || "text-embedding-3-small";
    this.dimensions = Number(options.dimensions || 768);
    this.apiKey = String(options.apiKey || "").trim();
    this.fetch = options.fetch || globalThis.fetch;
  }

  async embed(input) {
    if (!this.apiKey) throw new Error("OpenAI API-Key fuer Embeddings fehlt.");
    const response = await this.fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: String(input || ""), dimensions: this.dimensions, encoding_format: "float" }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Embedding-Provider antwortet mit HTTP ${response.status}.`);
    const vector = payload.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      throw new Error(`Embedding-Dimension ${vector?.length || 0} passt nicht zu ${this.dimensions}.`);
    }
    return vector.map(Number);
  }
}

module.exports = { OpenAiEmbeddingClient };
