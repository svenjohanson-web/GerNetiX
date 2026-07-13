const fs = require("node:fs");
const path = require("node:path");

function createLlmConfigStore({ configPath, defaultOllamaBaseUrl, defaultOllamaModel }) {
  let current = loadConfig();
  let loadedMtimeMs = readConfigMtimeMs();

  function getConfig() {
    reloadIfChanged();
    return { ...current, apiKey: current.apiKey || "" };
  }

  function resolveRoute(task = "general_chat") {
    reloadIfChanged();
    const route = current.routes[task] || current.routes.default || {};
    const provider = route.provider === "api" || route.provider === "ollama" ? route.provider : current.provider;
    return {
      ...current,
      provider,
      model: provider === "api" ? current.apiModel : current.ollamaModel,
      baseUrl: provider === "api" ? current.apiBaseUrl : current.ollamaBaseUrl,
      apiKey: current.apiKey || "",
      routeTask: task,
      routeReason: route.reason || defaultRouteReason(task, provider),
      costPolicy: route.costPolicy || (provider === "api" ? "external_costs" : "local_no_provider_costs"),
    };
  }

  function publicConfig(extra = {}) {
    reloadIfChanged();
    return {
      provider: current.provider,
      apiProvider: current.apiProvider,
      enabled: enabled(),
      baseUrl: current.provider === "api" ? current.apiBaseUrl : current.ollamaBaseUrl,
      model: current.provider === "api" ? current.apiModel : current.ollamaModel,
      ollamaBaseUrl: current.ollamaBaseUrl,
      ollamaModel: current.ollamaModel,
      apiBaseUrl: current.apiBaseUrl,
      apiModel: current.apiModel,
      hasApiKey: Boolean(current.apiKey),
      routes: publicRoutes(current.routes),
      ...extra,
    };
  }

  function updateConfig(input = {}) {
    current = normalizeConfig({
      ...current,
      provider: input.provider,
      apiProvider: input.apiProvider,
      ollamaBaseUrl: input.ollamaBaseUrl,
      ollamaModel: input.ollamaModel,
      apiBaseUrl: input.apiBaseUrl,
      apiModel: input.apiModel,
      apiKey: Object.hasOwn(input, "apiKey") ? input.apiKey : current.apiKey,
      routes: input.routes || current.routes,
    });
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    loadedMtimeMs = readConfigMtimeMs();
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

  function reloadIfChanged() {
    const mtimeMs = readConfigMtimeMs();
    if (mtimeMs === loadedMtimeMs) return;
    current = loadConfig();
    loadedMtimeMs = mtimeMs;
  }

  function readConfigMtimeMs() {
    try {
      return fs.statSync(configPath).mtimeMs;
    } catch {
      return 0;
    }
  }

  function normalizeConfig(input = {}) {
    const provider = input.provider === "api" ? "api" : "ollama";
    const requestedBaseUrl = clean(input.apiBaseUrl);
    const configuredApiProvider = ["openai-responses", "openai-compatible", "anthropic"].includes(input.apiProvider) ? input.apiProvider : "openai-responses";
    const apiProvider = isOfficialOpenAiEndpoint(requestedBaseUrl) ? "openai-responses" : configuredApiProvider;
    const apiBaseUrl = canonicalApiBaseUrl(apiProvider, requestedBaseUrl);
    return {
      provider,
      apiProvider,
      ollamaBaseUrl: clean(input.ollamaBaseUrl) || defaultOllamaBaseUrl,
      ollamaModel: clean(input.ollamaModel) || defaultOllamaModel,
      apiBaseUrl,
      apiModel: clean(input.apiModel) || (apiProvider === "openai-responses" ? "gpt-5.5" : "gpt-4.1-mini"),
      apiKey: clean(input.apiKey),
      routes: normalizeRoutes(input.routes),
    };
  }

  function canonicalApiBaseUrl(apiProvider, requestedBaseUrl) {
    if (apiProvider === "openai-responses") return "https://api.openai.com/v1";
    if (apiProvider === "anthropic") return "https://api.anthropic.com/v1";
    return requestedBaseUrl;
  }

  function isOfficialOpenAiEndpoint(value) {
    try {
      return new URL(value).hostname.toLowerCase() === "api.openai.com";
    } catch {
      return false;
    }
  }

  function normalizeRoutes(input = {}) {
    const defaults = {
      default: { provider: "default", reason: "Globale Standardroute fuer nicht spezialisierte KI-Aufgaben." },
      general_chat: { provider: "default", reason: "Interaktiver Chat darf die aktive Standardroute nutzen." },
      architecture_discovery: { provider: "default", reason: "Architektur-Discovery darf die aktive Standardroute nutzen." },
      artifact_generation: { provider: "ollama", reason: "Artefakte wie PlantUML, Pseudocode und Code werden kostenschonend lokal erzeugt.", costPolicy: "prefer_local" },
      code_generation: { provider: "ollama", reason: "Codegenerierung laeuft standardmaessig lokal, um externe Kosten zu vermeiden.", costPolicy: "prefer_local" },
    };
    return Object.fromEntries(Object.entries(defaults).map(([task, fallback]) => {
      const route = input && typeof input === "object" ? input[task] || {} : {};
      return [task, {
        provider: ["default", "ollama", "api"].includes(route.provider) ? route.provider : fallback.provider,
        reason: clean(route.reason) || fallback.reason,
        costPolicy: clean(route.costPolicy) || fallback.costPolicy || "default",
      }];
    }));
  }

  function publicRoutes(routes) {
    return Object.fromEntries(Object.entries(routes || {}).map(([task, route]) => [task, {
      provider: route.provider,
      reason: route.reason,
      costPolicy: route.costPolicy,
    }]));
  }

  function defaultRouteReason(task, provider) {
    if (provider === "ollama") return `${task} wird lokal ausgefuehrt.`;
    return `${task} wird ueber die externe API ausgefuehrt.`;
  }

  function clean(value) {
    return String(value || "").trim();
  }

  return {
    getConfig,
    publicConfig,
    resolveRoute,
    updateConfig,
  };
}

module.exports = { createLlmConfigStore };
