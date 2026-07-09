const fs = require("node:fs");
const path = require("node:path");

function createLlmConfigStore({ configPath, defaultOllamaBaseUrl, defaultOllamaModel }) {
  let current = loadConfig();

  function getConfig() {
    return { ...current, apiKey: current.apiKey || "" };
  }

  function publicConfig(extra = {}) {
    return {
      provider: current.provider,
      enabled: enabled(),
      baseUrl: current.provider === "api" ? current.apiBaseUrl : current.ollamaBaseUrl,
      model: current.provider === "api" ? current.apiModel : current.ollamaModel,
      ollamaBaseUrl: current.ollamaBaseUrl,
      ollamaModel: current.ollamaModel,
      apiBaseUrl: current.apiBaseUrl,
      apiModel: current.apiModel,
      hasApiKey: Boolean(current.apiKey),
      ...extra,
    };
  }

  function updateConfig(input = {}) {
    current = normalizeConfig({
      ...current,
      provider: input.provider,
      ollamaBaseUrl: input.ollamaBaseUrl,
      ollamaModel: input.ollamaModel,
      apiBaseUrl: input.apiBaseUrl,
      apiModel: input.apiModel,
      apiKey: Object.hasOwn(input, "apiKey") ? input.apiKey : current.apiKey,
    });
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    return publicConfig();
  }

  function enabled() {
    if (current.provider === "api") return Boolean(current.apiBaseUrl && current.apiModel);
    return Boolean(current.ollamaBaseUrl && current.ollamaModel);
  }

  function loadConfig() {
    try {
      return normalizeConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
    } catch {
      return normalizeConfig({});
    }
  }

  function normalizeConfig(input = {}) {
    const provider = input.provider === "api" ? "api" : "ollama";
    return {
      provider,
      ollamaBaseUrl: clean(input.ollamaBaseUrl) || defaultOllamaBaseUrl,
      ollamaModel: clean(input.ollamaModel) || defaultOllamaModel,
      apiBaseUrl: clean(input.apiBaseUrl) || "https://api.openai.com/v1",
      apiModel: clean(input.apiModel) || "gpt-4.1-mini",
      apiKey: clean(input.apiKey),
    };
  }

  function clean(value) {
    return String(value || "").trim();
  }

  return {
    getConfig,
    publicConfig,
    updateConfig,
  };
}

module.exports = { createLlmConfigStore };
