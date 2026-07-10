const assert = require("node:assert/strict");
const test = require("node:test");
const { developmentProjectSources } = require("../src/dev/development-project-structure");

test("creates architecture folders and component interface folders from AI architecture", () => {
  const sources = developmentProjectSources({
    title: "ESP32 MQTT Projekt",
    description: "ESP32 sendet Daten per MQTT an einen Server.",
    diagram: {
      source: [
        "@startuml",
        "node \"IoT Device / ESP32\" as device",
        "rectangle \"Backend / API\" as backend",
        "device --> backend : MQTT",
        "@enduml",
      ].join("\n"),
      detected_blocks: ["device", "backend"],
    },
  });
  const paths = sources.map((source) => source.path);

  assert.ok(paths.includes("docs/architecture.puml"));
  assert.ok(paths.includes("Architektur/statische-architektur/architecture.puml"));
  assert.ok(paths.includes("Architektur/statische-architektur/README.md"));
  assert.ok(paths.includes("Architektur/informationsfluss/README.md"));
  assert.ok(paths.includes("Architektur/systemverhalten/README.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Eigenschaften/README.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Behavior/Modell/README.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Behavior/Code/README.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Behavior/Config/README.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Daten/README.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Beziehungen/README.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Eigenschaften/README.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Behavior/Modell/README.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Behavior/Code/README.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Behavior/Config/README.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Daten/README.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Beziehungen/README.md"));
  assert.ok(paths.includes("Komponenten/Server/Eigenschaften/README.md"));
  assert.ok(paths.includes("Komponenten/Server/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/Server/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/Server/Behavior/Modell/README.md"));
  assert.ok(paths.includes("Komponenten/Server/Behavior/Code/README.md"));
  assert.ok(paths.includes("Komponenten/Server/Behavior/Config/README.md"));
  assert.ok(paths.includes("Komponenten/Server/Daten/README.md"));
  assert.ok(paths.includes("Komponenten/Server/Beziehungen/README.md"));

  const systemBehavior = sources.find((source) => source.path === "Architektur/systemverhalten/README.md");
  assert.match(systemBehavior.content, /komponentenuebergreifende Ablaeufe/);
  assert.match(systemBehavior.content, /dekomponieren/);
});

test("keeps required interfaces visible for minimal ESP32 projects", () => {
  const sources = developmentProjectSources({
    title: "Minimal ESP32",
    diagram: {
      source: [
        "@startuml",
        "node \"IoT Device / ESP32\" as device",
        "@enduml",
      ].join("\n"),
      detected_blocks: ["device"],
    },
  });

  const required = sources.find((source) => source.path === "Komponenten/ESP32/Schnittstellen/required.md");
  const properties = sources.find((source) => source.path === "Komponenten/ESP32/Eigenschaften/README.md");
  const data = sources.find((source) => source.path === "Komponenten/ESP32/Daten/README.md");
  assert.ok(required);
  assert.ok(properties);
  assert.ok(data);
  assert.match(required.content, /Required Interfaces/);
  assert.match(required.content, /Stromversorgung/);
  assert.match(properties.content, /Betriebsort: Device/);
  assert.match(data.content, /Messwerte/);
});
