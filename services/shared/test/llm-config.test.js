const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createLlmConfigStore } = require("../llm-config");

test("llm config store reloads external file changes", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    provider: "ollama",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "llama-local",
  }), "utf8");

  const store = createLlmConfigStore({
    configPath,
    defaultOllamaBaseUrl: "http://127.0.0.1:11434",
    defaultOllamaModel: "llama-default",
  });

  assert.equal(store.getConfig().provider, "ollama");

  await waitForDistinctMtime();
  fs.writeFileSync(configPath, JSON.stringify({
    provider: "api",
    apiProvider: "anthropic",
    apiBaseUrl: "https://api.example.test/v1",
    apiModel: "external-model",
    apiKey: "test-key",
  }), "utf8");

  const config = store.getConfig();
  assert.equal(config.provider, "api");
  assert.equal(config.apiProvider, "anthropic");
  assert.equal(config.apiBaseUrl, "https://api.example.test/v1");
  assert.equal(config.apiModel, "external-model");
});

function waitForDistinctMtime() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
