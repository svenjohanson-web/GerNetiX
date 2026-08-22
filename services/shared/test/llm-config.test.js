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
    routingVersion: 2,
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

test("llm config routes cost-sensitive artifact tasks to the configured OpenAI API by default", () => {
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
  assert.equal(store.resolveRoute("artifact_generation").provider, "api");
  assert.equal(store.resolveRoute("artifact_generation").model, "gpt-expensive");
  assert.equal(store.publicConfig().routes.artifact_generation.provider, "api");
});

test("llm config routes GerNetiX Help through the cost-controlled API", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  const store = createLlmConfigStore({ configPath, defaultOllamaBaseUrl: "http://127.0.0.1:11434", defaultOllamaModel: "llama-local" });

  store.updateConfig({ provider: "api", apiModel: "gpt-external", routes: { help_chat: { provider: "api", reason: "Kuratierte Hilfe extern" } } });

  const route = store.resolveRoute("help_chat");
  assert.equal(route.provider, "api");
  assert.equal(route.model, "gpt-external");
  assert.equal(route.costPolicy, "external_costs_with_preflight");
  assert.equal(store.publicConfig().routes.help_chat.provider, "api");
});

test("blank llm config defaults to the cheapest OpenAI model", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const store = createLlmConfigStore({
    configPath: path.join(tmp, "identity-llm-config.json"),
    defaultOllamaBaseUrl: "http://127.0.0.1:11434",
    defaultOllamaModel: "llama-local",
  });

  assert.equal(store.getConfig().provider, "api");
  assert.equal(store.getConfig().apiProvider, "openai-responses");
  assert.equal(store.getConfig().apiModel, "gpt-5-nano");
  assert.equal(store.resolveRoute("code_generation").provider, "api");
  assert.equal(store.resolveRoute("help_chat").provider, "api");
  assert.equal(store.resolveRoute("electronics_lab_troubleshooting").provider, "api");
  assert.equal(store.resolveRoute("electronics_lab_troubleshooting").costPolicy, "external_costs_with_preflight");
});

test("legacy local routing is migrated once to the OpenAI default", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const configPath = path.join(tmp, "identity-llm-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    provider: "ollama",
    ollamaModel: "legacy-local",
    routes: { architecture_discovery: { provider: "ollama" }, code_generation: { provider: "ollama" }, help_chat: { provider: "ollama" } },
  }));
  const store = createLlmConfigStore({ configPath, defaultOllamaBaseUrl: "http://127.0.0.1:11434", defaultOllamaModel: "llama-local" });

  assert.equal(store.getConfig().routingVersion, 2);
  assert.equal(store.getConfig().provider, "api");
  assert.equal(store.resolveRoute("architecture_discovery").provider, "api");
  assert.equal(store.resolveRoute("code_generation").provider, "api");
  assert.equal(store.resolveRoute("help_chat").provider, "api");
});

test("llm config permanently routes hardware lab analysis to external API", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-llm-config-"));
  const store = createLlmConfigStore({
    configPath: path.join(tmp, "identity-llm-config.json"),
    defaultOllamaBaseUrl: "http://127.0.0.1:11434",
    defaultOllamaModel: "llama-local",
  });
  await store.updateConfig({ provider: "ollama", routes: { hardware_lab_analysis: { provider: "ollama" } } });
  assert.equal(store.resolveRoute("hardware_lab_analysis").provider, "api");
  assert.equal(store.publicConfig().routes.hardware_lab_analysis.provider, "api");
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
