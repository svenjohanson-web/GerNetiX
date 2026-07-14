class OllamaEmbeddingClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
    this.model = options.model || "embeddinggemma";
    this.dimensions = Number(options.dimensions || 768);
    this.fetch = options.fetch || globalThis.fetch;
  }

  async embed(input) {
    const response = await this.fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model:this.model, input:String(input || "") }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Embedding-Provider antwortet mit HTTP ${response.status}.`);
    const payload = await response.json();
    const vector = payload.embeddings?.[0];
    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      throw new Error(`Embedding-Dimension ${vector?.length || 0} passt nicht zu ${this.dimensions}.`);
    }
    return vector.map(Number);
  }
}

module.exports = { OllamaEmbeddingClient };
