const assert = require("node:assert/strict");
const test = require("node:test");
const { OpenAiEmbeddingClient } = require("../src/embeddings/openai-embedding-client");

test("OpenAI embedding client requests the configured reduced dimensions", async () => {
  let request;
  const client = new OpenAiEmbeddingClient({
    baseUrl: "https://api.openai.test/v1",
    model: "text-embedding-3-small",
    dimensions: 3,
    apiKey: "test-key",
    fetch: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }) };
    },
  });

  assert.deepEqual(await client.embed("GerNetiX Hilfe"), [0.1, 0.2, 0.3]);
  assert.equal(request.url, "https://api.openai.test/v1/embeddings");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(request.options.body), { model: "text-embedding-3-small", input: "GerNetiX Hilfe", dimensions: 3, encoding_format: "float" });
});
