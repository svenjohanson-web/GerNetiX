const assert = require("node:assert/strict");
const test = require("node:test");
const { buildArchitectureDiagram, createDevelopmentAssistant } = require("../src/dev/development-assistant");

const ARCHITECTURE_PROMPT = [
  "AI Context Architektur-Prompt.",
  "Antworte knapp und direkt.",
  "Liefere nur das, was der Nutzer angefragt hat.",
  "Liste nicht auf, was nicht benoetigt wird.",
].join("\n");

async function promptFoundationJson() {
  return {
    items: [{
      route_task: "architecture_discovery",
      content_kind: "system_prompt",
      content: ARCHITECTURE_PROMPT,
    }],
  };
}

test("builds a PlantUML architecture sketch from the AI architecture result", () => {
  const diagram = buildArchitectureDiagram([
    {
      role: "user",
      content: "Ich moechte ein ESP32 Projekt mit Messwerten, Handy App und weltweitem Zugriff bauen.",
    },
    {
      role: "assistant",
      content: [
        "Zielarchitektur: ESP32 Device misst Sensordaten und sendet sie an ein Backend.",
        "Eine Mobile App nutzt eine API. Messwerte werden in SQLite oder einer Datenbank gespeichert.",
        "Offene Frage: Soll der Betrieb ueber Cloud oder HomeServer laufen?",
      ].join("\n"),
    },
  ], {
    contextSources: [{ source_type: "hardware_catalog" }],
    provider: "api",
    model: "gpt-4.1-mini",
  });

  assert.equal(diagram.type, "plantuml");
  assert.match(diagram.source, /^@startuml/);
  assert.match(diagram.source, /node "IoT Device \/ ESP32" as device/);
  assert.match(diagram.source, /rectangle "Backend \/ API" as backend/);
  assert.match(diagram.source, /rectangle "Mobile App" as mobile/);
  assert.match(diagram.source, /database "Persistenz" as database/);
  assert.match(diagram.source, /cloud "Cloud \/ Internet" as cloud/);
  assert.match(diagram.source, /mobile --> backend : API/);
  assert.doesNotMatch(diagram.source, /actor "Nutzer"|Projektidee \/ Anforderungen|requirements|note right/);
  assert.equal(diagram.derived_from, "architecture_discovery_ai_response");
  assert.ok(diagram.detected_blocks.includes("device"));
  assert.ok(diagram.detected_blocks.includes("backend"));
});

test("adds an actor only when an explicit interface is part of the structure", () => {
  const diagram = buildArchitectureDiagram([
    { role: "user", content: "ESP32 stellt einen Webserver bereit. Kunde greift ueber den Webserver auf den ESP32 zu." },
    { role: "assistant", content: "Struktur: ESP32 mit Webserver-Interface fuer Kundenzugriff." },
  ]);

  assert.match(diagram.source, /node "IoT Device \/ ESP32" as device/);
  assert.match(diagram.source, /rectangle "Webserver" as webserver/);
  assert.match(diagram.source, /rectangle "Browser" as browser/);
  assert.match(diagram.source, /actor "Kunde" as actor/);
  assert.match(diagram.source, /actor --> browser : nutzt/);
  assert.match(diagram.source, /browser --> webserver : HTTP/);
  assert.match(diagram.source, /webserver --> device : lokales Interface/);
  assert.doesNotMatch(diagram.source, /Projektidee \/ Anforderungen|requirements|note right/);
});

test("extends an ESP32 structure with user browser access when a webserver provides measurements", () => {
  const diagram = buildArchitectureDiagram([
    { role: "user", content: "ich moechte ein projekt ausschliesslich mit ESP32" },
    { role: "assistant", content: "ESP32." },
    { role: "user", content: "dieser webserver soll ueber einen webserver einem Nutzer Messdaten bereit stellen" },
    { role: "assistant", content: "Der ESP32 stellt Messdaten ueber einen Webserver bereit." },
  ]);

  assert.match(diagram.source, /node "IoT Device \/ ESP32" as device/);
  assert.match(diagram.source, /rectangle "Webserver" as webserver/);
  assert.match(diagram.source, /rectangle "Browser" as browser/);
  assert.match(diagram.source, /actor "Nutzer" as actor/);
  assert.match(diagram.source, /actor --> browser : nutzt/);
  assert.match(diagram.source, /browser --> webserver : HTTP/);
  assert.match(diagram.source, /webserver --> device : lokales Interface/);
  assert.doesNotMatch(diagram.source, /Projektidee \/ Anforderungen|requirements|note right/);
});

test("sanitizes PlantUML control tokens from AI text", () => {
  const diagram = buildArchitectureDiagram([
    { role: "user", content: "Projekt @startuml mit Backend und \"Zitat\"" },
    { role: "assistant", content: "Backend nutzen. @enduml \"Zitat\"" },
  ]);

  assert.match(diagram.source, /^@startuml/);
  assert.match(diagram.source, /'Zitat'/);
  assert.equal((diagram.source.match(/@startuml/g) || []).length, 1);
  assert.equal((diagram.source.match(/@enduml/g) || []).length, 1);
});

test("keeps minimal ESP32 structure requests free of extra clarification questions", async () => {
  const previousFetch = global.fetch;
  let fetchUrl = "";
  let requestBody = null;
  let payload = null;
  global.fetch = async (url, options = {}) => {
    fetchUrl = String(url);
    requestBody = JSON.parse(options.body || "{}");
    return {
      ok: true,
      json: async () => ({
        message: { content: "ESP32." },
        prompt_eval_count: 12,
        eval_count: 3,
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "ollama", ollamaModel: "local" }),
      getConfig: () => ({ provider: "ollama", ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "local" }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_minimal",
      messages: [{ role: "user", content: "Ich moechte nur eine Struktur mit nur einem ESP32-Port." }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal(payload.status, 200);
  assert.match(fetchUrl, /127\.0\.0\.1:11434\/api\/chat/);
  assert.equal(payload.body.usedFallback, false);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.equal(payload.body.routing.local, true);
  assert.equal(payload.body.routing.label, "Lokal / Ollama");
  assert.equal(payload.body.routing.model, "local");
  assert.equal(payload.body.usage.totalTokens, 15);
  assert.equal(payload.body.message.content, "ESP32.");
  assert.doesNotMatch(payload.body.message.content, /Bitte beantworte als Naechstes/);
  assert.doesNotMatch(payload.body.message.content, /Soll das System/);
});

test("does not add backend clarification note for explicit minimal ESP32 diagrams", () => {
  const diagram = buildArchitectureDiagram([
    { role: "user", content: "Ich moechte nur eine Struktur mit nur einem ESP32-Port." },
    { role: "assistant", content: "Minimale Struktur: Nutzer -> ESP32-Port." },
  ]);

  assert.match(diagram.source, /node "ESP32" as esp32/);
  assert.doesNotMatch(diagram.source, /IoT Device \/ ESP32/);
  assert.doesNotMatch(diagram.source, /Nutzer|Projektidee \/ Anforderungen|requirements|-->|note right/);
  assert.doesNotMatch(diagram.source, /Noch klaeren: nur lokales Device oder Backend\/Persistenz/);
});

test("uses configured route for ESP32-only architecture requests", async () => {
  const previousFetch = global.fetch;
  let fetchUrl = "";
  let requestBody = null;
  let payload = null;
  global.fetch = async (url, options = {}) => {
    fetchUrl = String(url);
    requestBody = JSON.parse(options.body || "{}");
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ESP32." } }],
        usage: { prompt_tokens: 8, completion_tokens: 3 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiModel: "gpt-expensive" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-expensive",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_esp32_only",
      messages: [{ role: "user", content: "erstelle architektur mit esp32 only" }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.match(fetchUrl, /api\.openai\.example\/v1\/chat\/completions/);
  assert.match(requestBody.messages[0].content, /Liste nicht auf/);
  assert.match(requestBody.messages[0].content, /nur das, was der Nutzer angefragt hat/);
  assert.doesNotMatch(requestBody.messages[0].content, /Architektur-Arbeitsweise:/);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.equal(payload.body.config.requestProfile.architectureMode, undefined);
  assert.equal(payload.body.routing.local, false);
  assert.equal(payload.body.routing.provider, "openai-compatible");
  assert.equal(payload.body.routing.costPolicy, "external_costs");
  assert.equal(payload.body.routing.requestComplexity, "configured_route");
  assert.equal(payload.body.usage.totalTokens, 11);
  assert.match(payload.body.architectureDiagram.source, /node "ESP32" as esp32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /IoT Device \/ ESP32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Nutzer|Projektidee \/ Anforderungen|requirements|-->|note right/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Mobile App/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Backend \/ API/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Cloud \/ Internet/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /HomeServer/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Persistenz/);
});

test("uses configured route for plain bitte ESP32 only requests", async () => {
  const previousFetch = global.fetch;
  let fetchUrl = "";
  let payload = null;
  global.fetch = async (url) => {
    fetchUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ESP32." } }],
        usage: { prompt_tokens: 8, completion_tokens: 3 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiModel: "gpt-expensive" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-expensive",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_esp32_only",
      messages: [{ role: "user", content: "bitte esp32 only" }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.match(fetchUrl, /api\.openai\.example\/v1\/chat\/completions/);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.equal(payload.body.usage.totalTokens, 11);
  assert.match(payload.body.architectureDiagram.source, /node "ESP32" as esp32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Nutzer|Projektidee \/ Anforderungen|requirements|-->|note right|IoT Device \/ ESP32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Mobile App|Backend \/ API|Cloud \/ Internet|HomeServer|Persistenz/);
});

test("keeps ESP32-only diagrams minimal even when assistant text mentions excluded components", () => {
  const diagram = buildArchitectureDiagram([
    { role: "user", content: "erstelle architektur mit esp32 only" },
    { role: "assistant", content: "Keine Mobile App, kein Backend, keine Cloud, kein HomeServer, keine Datenbank." },
  ]);

  assert.match(diagram.source, /node "ESP32" as esp32/);
  assert.doesNotMatch(diagram.source, /IoT Device \/ ESP32/);
  assert.doesNotMatch(diagram.source, /Nutzer|Projektidee \/ Anforderungen|requirements|-->|note right/);
  assert.doesNotMatch(diagram.source, /Mobile App/);
  assert.doesNotMatch(diagram.source, /Backend \/ API/);
  assert.doesNotMatch(diagram.source, /Cloud \/ Internet/);
  assert.doesNotMatch(diagram.source, /HomeServer/);
  assert.doesNotMatch(diagram.source, /Persistenz/);
});

test("keeps architecture-only-with-ESP32 wording on the configured route path", async () => {
  const previousFetch = global.fetch;
  let fetchUrl = "";
  let payload = null;
  global.fetch = async (url) => {
    fetchUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ESP32." } }],
        usage: { prompt_tokens: 8, completion_tokens: 3 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiModel: "gpt-expensive" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-expensive",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_esp32_only",
      messages: [{ role: "user", content: "ich will architektur only mit ESP32" }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.match(fetchUrl, /api\.openai\.example\/v1\/chat\/completions/);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.equal(payload.body.usage.totalTokens, 11);
  assert.match(payload.body.architectureDiagram.source, /node "ESP32" as esp32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Nutzer|Projektidee \/ Anforderungen|requirements|-->|note right|IoT Device \/ ESP32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Mobile App|Backend \/ API|Cloud \/ Internet|HomeServer|Persistenz/);
});

test("keeps architecture-only-with-ESP32 diagrams minimal", () => {
  const diagram = buildArchitectureDiagram([
    { role: "user", content: "ich habe eine Architektur only mit ESP32 angelegt" },
    { role: "assistant", content: "Keine Mobile App, kein Backend, keine Cloud, kein HomeServer, keine Datenbank." },
  ]);

  assert.match(diagram.source, /node "ESP32" as esp32/);
  assert.doesNotMatch(diagram.source, /Nutzer|Projektidee \/ Anforderungen|requirements|-->|note right|IoT Device \/ ESP32/);
  assert.doesNotMatch(diagram.source, /Mobile App|Backend \/ API|Cloud \/ Internet|HomeServer|Persistenz/);
});

test("uses ai context prompt rules for ausschliesslich ESP32 requests and keeps diagram minimal", async () => {
  const previousFetch = global.fetch;
  let requestBody = null;
  let payload = null;
  global.fetch = async (url, options = {}) => {
    requestBody = JSON.parse(options.body || "{}");
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: [
              "Ich nehme eine lokale Bedienung, Projektidee und Anforderungen an.",
              "Noch klaeren: nur lokales Device oder Backend/Persistenz?",
            ].join("\n"),
          },
        }],
        usage: { prompt_tokens: 18, completion_tokens: 35 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiModel: "gpt-expensive" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-expensive",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_esp32_only",
      messages: [{ role: "user", content: "ich moechte ein projekt ausschliesslich mit ESP32" }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.match(requestBody.messages[0].content, /AI Context Architektur-Prompt/);
  assert.match(payload.body.message.content, /Ich nehme eine lokale Bedienung/);
  assert.equal(requestBody.model, "gpt-expensive");
  assert.match(payload.body.architectureDiagram.source, /node "ESP32" as esp32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Nutzer|Projektidee \/ Anforderungen|requirements|-->|note right|IoT Device \/ ESP32/);
  assert.doesNotMatch(payload.body.architectureDiagram.source, /Mobile App|Backend \/ API|Cloud \/ Internet|HomeServer|Persistenz|Noch klaeren/);
});

test("reports API routing for complex architecture requests", async () => {
  const previousFetch = global.fetch;
  let fetchUrl = "";
  let payload = null;
  global.fetch = async (url) => {
    fetchUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Backend, App und ESP32 Architektur." } }],
        usage: { prompt_tokens: 40, completion_tokens: 9 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiProvider: "openai-compatible", apiModel: "gpt-5.5" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-5.5",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_complex",
      messages: [{
        role: "user",
        content: "Plane bitte eine Architektur mit ESP32, Backend, Mobile App, Browser UI, MQTT, REST API, SQLite Persistenz, Cloud Zugriff und lokaler Bedienung.",
      }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.match(fetchUrl, /api\.openai\.example\/v1\/chat\/completions/);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.equal(payload.body.routing.local, false);
  assert.equal(payload.body.routing.label, "OpenAI / API");
  assert.equal(payload.body.routing.model, "gpt-5.5");
  assert.equal(payload.body.routing.costPolicy, "external_costs");
  assert.equal(payload.body.routing.requestComplexity, "configured_route");
});

test("records successful architecture chat usage through ai usage service", async () => {
  const previousFetch = global.fetch;
  const usageCalls = [];
  let providerCalled = false;
  let payload = null;
  global.fetch = async () => {
    providerCalled = true;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Backend, App und ESP32 Architektur." } }],
        usage: { prompt_tokens: 40, completion_tokens: 9 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    aiUsageJson: async (pathname, options = {}) => {
      usageCalls.push({ pathname, body: options.body });
      if (pathname === "/api/ai-usage/preflight") {
        return { allowed: true, event_id: "usage_1" };
      }
      if (pathname === "/api/ai-usage/events/usage_1/complete") {
        return { event_id: "usage_1", status: "success", input_tokens: options.body.input_tokens, output_tokens: options.body.output_tokens };
      }
      throw new Error(`Unexpected AI usage path ${pathname}`);
    },
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiProvider: "openai-compatible", apiModel: "gpt-5.5" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-5.5",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_usage",
      messages: [{ role: "user", content: "Plane bitte eine Architektur mit ESP32, Backend, Mobile App, Browser UI, MQTT, REST API, SQLite Persistenz, Cloud Zugriff und lokaler Bedienung." }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal(providerCalled, true);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usage.totalTokens, 49);
  assert.equal(payload.body.usageEvent.status, "success");
  assert.equal(usageCalls[0].pathname, "/api/ai-usage/preflight");
  assert.equal(usageCalls[0].body.account_id, "usr_demo");
  assert.equal(usageCalls[0].body.user_id, "usr_demo");
  assert.equal(usageCalls[0].body.project_id, "dev_project_usage");
  assert.equal(usageCalls[0].body.feature, "architecture_discovery");
  assert.equal(usageCalls[0].body.model, "gpt-5.5");
  assert.equal(usageCalls[0].body.source_id, "openai_gpt");
  assert.equal(usageCalls[1].pathname, "/api/ai-usage/events/usage_1/complete");
  assert.equal(usageCalls[1].body.input_tokens, 40);
  assert.equal(usageCalls[1].body.output_tokens, 9);
});

test("does not call provider when ai usage preflight rejects architecture chat", async () => {
  const previousFetch = global.fetch;
  let providerCalled = false;
  let payload = null;
  global.fetch = async () => {
    providerCalled = true;
    return { ok: true, json: async () => ({}) };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    aiUsageJson: async () => ({ allowed: false, event_id: "usage_rejected", rejection_reason: "daily_limit_exceeded" }),
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiProvider: "openai-compatible", apiModel: "gpt-5.5" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-5.5",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_rejected_usage",
      messages: [{ role: "user", content: "Plane bitte ESP32 mit Backend, Mobile App und SQLite." }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal(providerCalled, false);
  assert.equal(payload.status, 402);
  assert.equal(payload.body.error, "ai_usage_rejected");
  assert.equal(payload.body.usagePreflight.rejection_reason, "daily_limit_exceeded");
});

test("routes architecture work mode choices through the configured architecture route", async () => {
  const previousFetch = global.fetch;
  let fetchUrl = "";
  let requestBody = null;
  let payload = null;
  global.fetch = async (url, options = {}) => {
    fetchUrl = String(url);
    requestBody = JSON.parse(options.body || "{}");
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Okay, wir starten mit der maximalen Architektur und reduzieren danach." } }],
        usage: { prompt_tokens: 16, completion_tokens: 9 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiProvider: "openai-compatible", apiModel: "gpt-5.5" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-5.5",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_work_mode",
      messages: [
        {
          role: "user",
          content: "Vorheriger Kontext mit ESP32, Backend, Mobile App, Browser UI, MQTT, REST API, SQLite Persistenz, Cloud Zugriff und lokaler Bedienung.",
        },
        {
          role: "assistant",
          content: "Du hast zunaechst die Wahl, ob du mit einer maximalen Architektur startest und Komponenten entfernst, die du nicht benoetigst, oder mit einer leeren Architektur. Wie moechtest du vorgehen? Antworte einfach mit max oder leer.",
        },
        { role: "user", content: "max" },
      ],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.match(fetchUrl, /api\.openai\.example\/v1\/chat\/completions/);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.equal(payload.body.config.requestProfile.explicitWorkModeChoice, undefined);
  assert.equal(payload.body.config.requestProfile.workModeChoice, "max");
  assert.equal(payload.body.routing.local, false);
  assert.equal(payload.body.routing.provider, "openai-compatible");
  assert.equal(payload.body.routing.costPolicy, "external_costs");
  assert.equal(payload.body.routing.requestComplexity, "dialog_control");
  assert.equal(payload.body.usage.totalTokens, 25);
  assert.equal(requestBody.model, "gpt-5.5");
});

test("routes bare max architecture work mode answer through configured architecture route", async () => {
  const previousFetch = global.fetch;
  let fetchUrl = "";
  let payload = null;
  global.fetch = async (url) => {
    fetchUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Okay, wir starten mit der maximalen Architektur und reduzieren danach." } }],
        usage: { prompt_tokens: 14, completion_tokens: 8 },
      }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: {
      publicConfig: () => ({ provider: "api", apiProvider: "openai-compatible", apiModel: "gpt-5.5" }),
      resolveRoute: () => ({
        provider: "api",
        apiProvider: "openai-compatible",
        apiBaseUrl: "https://api.openai.example/v1",
        apiModel: "gpt-5.5",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_work_mode_bare",
      messages: [{ role: "user", content: "max" }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.match(fetchUrl, /api\.openai\.example\/v1\/chat\/completions/);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedLocalRoute, false);
  assert.equal(payload.body.config.requestProfile.workModeChoice, "max");
  assert.equal(payload.body.routing.local, false);
  assert.equal(payload.body.routing.requestComplexity, "dialog_control");
});

test("architecture chat requires an account-bound development project", async () => {
  let payload = null;
  const assistant = createDevelopmentAssistant({
    aiContextJson: promptFoundationJson,
    llmConfigStore: { publicConfig: () => ({}), getConfig: () => ({ provider: "ollama", ollamaModel: "local" }) },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({ messages: [{ role: "user", content: "Projekt starten" }] }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });

  assert.equal(payload.status, 400);
  assert.equal(payload.body.error, "missing_project");
});

test("does not synthesize architecture prompt rules when ai context prompt is missing", async () => {
  let providerCalled = false;
  let payload = null;
  const previousFetch = global.fetch;
  global.fetch = async () => {
    providerCalled = true;
    return {
      ok: true,
      json: async () => ({ message: { content: "sollte nicht passieren" } }),
    };
  };
  const assistant = createDevelopmentAssistant({
    aiContextJson: async () => ({ items: [] }),
    llmConfigStore: {
      publicConfig: () => ({ provider: "ollama", ollamaModel: "local" }),
      resolveRoute: () => ({
        provider: "ollama",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "local",
      }),
    },
    projectServerUserId: () => "usr_demo",
    readJsonBody: async () => ({
      projectId: "dev_project_missing_prompt",
      messages: [{ role: "user", content: "bitte esp32 only" }],
    }),
    requireProjectAccess: async () => ({ area: "development_project" }),
    sendJson: (res, status, body) => {
      payload = { status, body };
    },
  });

  try {
    await assistant.handleChat({}, {}, { account: { user_id: "usr_demo" } });
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal(providerCalled, false);
  assert.equal(payload.status, 200);
  assert.equal(payload.body.usedFallback, true);
  assert.match(payload.body.error, /AI Context Prompt-Grundlage/);
});
