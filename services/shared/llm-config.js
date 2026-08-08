const fs = require("node:fs");
const path = require("node:path");

function createLlmConfigStore({ configPath, stateStore, defaultOllamaBaseUrl, defaultOllamaModel }) {
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
      costPolicy: route.costPolicy || (provider === "api" ? "external_costs_with_preflight" : "local_no_provider_costs"),
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

  async function updateConfig(input = {}) {
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
    if (stateStore) {
      await stateStore.save({ config: current });
    } else {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    }
    loadedMtimeMs = readConfigMtimeMs();
    return publicConfig();
  }

  function enabled() {
    if (current.provider === "api") return Boolean(current.apiBaseUrl && current.apiModel);
    return Boolean(current.ollamaBaseUrl && current.ollamaModel);
  }

  function loadConfig() {
    if (stateStore) return normalizeConfig(stateStore.load().config || {});
    try {
      return normalizeConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
    } catch {
      return normalizeConfig({});
    }
  }

  function reloadIfChanged() {
    if (stateStore) {
      current = loadConfig();
      return;
    }
    const mtimeMs = readConfigMtimeMs();
    if (mtimeMs === loadedMtimeMs) return;
    current = loadConfig();
    loadedMtimeMs = mtimeMs;
  }

  function readConfigMtimeMs() {
    if (stateStore) return 0;
    try {
      return fs.statSync(configPath).mtimeMs;
    } catch {
      return 0;
    }
  }

  function normalizeConfig(input = {}) {
    const routingVersion = Number(input.routingVersion || 0);
    const migrateLegacyLocalDefaults = routingVersion < 2;
    const provider = !migrateLegacyLocalDefaults && input.provider === "ollama" ? "ollama" : "api";
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
      apiModel: clean(input.apiModel) || (apiProvider === "openai-responses" ? "gpt-5-nano" : "gpt-4.1-mini"),
      apiKey: clean(input.apiKey),
      routes: normalizeRoutes(input.routes, { migrateLegacyLocalDefaults }),
      routingVersion: 2,
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

  function normalizeRoutes(input = {}, options = {}) {
    const defaults = {
      default: { provider: "default", reason: "Globale Standardroute fuer nicht spezialisierte KI-Aufgaben." },
      general_chat: { provider: "default", reason: "Interaktiver Chat darf die aktive Standardroute nutzen." },
      architecture_discovery: { provider: "default", reason: "Architektur-Discovery darf die aktive Standardroute nutzen." },
      hardware_lab_analysis: { provider: "api", reason: "Das Hardware-Labor analysiert externe Herstellerquellen ueber die OpenAI Responses API.", costPolicy: "external_costs_with_preflight" },
      artifact_generation: { provider: "api", reason: "Artefakte werden ueber das kostenoptimierte OpenAI-Standardmodell erzeugt.", costPolicy: "external_costs_with_preflight" },
      code_generation: { provider: "api", reason: "Codegenerierung verwendet OpenAI Responses mit dem kostenoptimierten Standardmodell.", costPolicy: "external_costs_with_preflight" },
      help_chat: { provider: "api", reason: "Help-Chat verwendet OpenAI Responses nur mit kuratierten Hilfeartikeln.", costPolicy: "external_costs_with_preflight" },
      requirements_workshop: { provider: "api", reason: "Der Lernworkshop spiegelt Anforderungen strukturiert ueber OpenAI Responses.", costPolicy: "external_costs_with_preflight" },
    };
    return Object.fromEntries(Object.entries(defaults).map(([task, fallback]) => {
      const route = input && typeof input === "object" ? input[task] || {} : {};
      return [task, {
        provider: task === "hardware_lab_analysis" || options.migrateLegacyLocalDefaults ? "api" : ["default", "ollama", "api"].includes(route.provider) ? route.provider : fallback.provider,
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
