const assert = require("node:assert/strict");
const test = require("node:test");
const { buildArchitectureDiagram, createDevelopmentAssistant } = require("../src/dev/development-assistant");

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
  assert.match(diagram.source, /note right of requirements/);
  assert.equal(diagram.derived_from, "architecture_discovery_ai_response");
  assert.ok(diagram.detected_blocks.includes("device"));
  assert.ok(diagram.detected_blocks.includes("backend"));
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

test("architecture chat requires an account-bound development project", async () => {
  let payload = null;
  const assistant = createDevelopmentAssistant({
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
