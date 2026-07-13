const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createLlmConfigStore } = require("../llm-config");

test("normalizes the official OpenAI endpoint to the Responses provider", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    provider: "api",
    apiProvider: "openai-compatible",
    apiBaseUrl: "https://api.openai.com/v1",
    apiModel: "gpt-5.6-terra",
  }));
  const store = createLlmConfigStore({ configPath, defaultOllamaBaseUrl: "http://127.0.0.1:11434", defaultOllamaModel: "llama3.2:3b" });
  assert.equal(store.getConfig().apiProvider, "openai-responses");
});

test("keeps official provider protocols and endpoints inseparable", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  const store = createLlmConfigStore({ configPath, defaultOllamaBaseUrl: "http://127.0.0.1:11434", defaultOllamaModel: "llama3.2:3b" });
  store.updateConfig({ provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://wrong.example/v1", apiModel: "gpt-5.6-terra" });
  assert.equal(store.getConfig().apiBaseUrl, "https://api.openai.com/v1");
  store.updateConfig({ provider: "api", apiProvider: "anthropic", apiBaseUrl: "https://wrong.example/v1", apiModel: "claude" });
  assert.equal(store.getConfig().apiBaseUrl, "https://api.anthropic.com/v1");
});

test("does not silently point custom compatible providers at OpenAI", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  const store = createLlmConfigStore({ configPath, defaultOllamaBaseUrl: "http://127.0.0.1:11434", defaultOllamaModel: "llama3.2:3b" });
  store.updateConfig({ provider: "api", apiProvider: "openai-compatible", apiBaseUrl: "", apiModel: "custom" });
  assert.equal(store.getConfig().apiProvider, "openai-compatible");
  assert.equal(store.getConfig().apiBaseUrl, "");
  assert.equal(store.publicConfig().enabled, false);
});

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
  assert.equal(config.apiBaseUrl, "https://api.anthropic.com/v1");
  assert.equal(config.apiModel, "external-model");
});

test("llm config routes cost-sensitive artifact tasks to local model by default", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    provider: "api",
    apiProvider: "openai-compatible",
    apiBaseUrl: "https://api.example.test/v1",
    apiModel: "gpt-expensive",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "local-code-model",
  }), "utf8");

  const store = createLlmConfigStore({
    configPath,
    defaultOllamaBaseUrl: "http://127.0.0.1:11434",
    defaultOllamaModel: "llama-default",
  });

  assert.equal(store.resolveRoute("general_chat").provider, "api");
  assert.equal(store.resolveRoute("artifact_generation").provider, "ollama");
  assert.equal(store.resolveRoute("artifact_generation").model, "local-code-model");
  assert.equal(store.publicConfig().routes.artifact_generation.provider, "ollama");
});

test("llm config store persists route overrides", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  const store = createLlmConfigStore({
    configPath,
    defaultOllamaBaseUrl: "http://127.0.0.1:11434",
    defaultOllamaModel: "llama-default",
  });

  store.updateConfig({
    provider: "api",
    apiModel: "gpt-chat",
    routes: {
      code_generation: { provider: "api", reason: "Premium-Codegenerierung" },
    },
  });

  assert.equal(store.resolveRoute("code_generation").provider, "api");
  assert.equal(store.publicConfig().routes.code_generation.reason, "Premium-Codegenerierung");
});

test("llm config store accepts openai responses provider mode", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  const store = createLlmConfigStore({
    configPath,
    defaultOllamaBaseUrl: "http://127.0.0.1:11434",
    defaultOllamaModel: "llama-default",
  });

  store.updateConfig({
    provider: "api",
    apiProvider: "openai-responses",
    apiModel: "gpt-5.5",
  });

  assert.equal(store.getConfig().apiProvider, "openai-responses");
  assert.equal(store.publicConfig().apiModel, "gpt-5.5");
});

function waitForDistinctMtime() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
