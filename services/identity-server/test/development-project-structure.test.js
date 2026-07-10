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
  assert.equal(paths.some((path) => path.endsWith("/README.md") || path === "README.md"), false);
  assert.ok(paths.includes("Architektur/informationsfluss/informationsfluss.md"));
  assert.ok(paths.includes("Architektur/systemverhalten/systemverhalten.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Eigenschaften/eigenschaften.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Verhalten/Modell/modell.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Verhalten/Code/code.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Verhalten/Config/config.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Konfiguration/Board/board.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Konfiguration/Sensoren/in.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Konfiguration/Aktoren/out.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Daten/daten.md"));
  assert.ok(paths.includes("Komponenten/ESP32/Beziehungen/beziehungen.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Eigenschaften/eigenschaften.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Verhalten/Modell/modell.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Verhalten/Code/code.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Verhalten/Config/config.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Daten/daten.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Beziehungen/beziehungen.md"));
  assert.ok(paths.includes("Komponenten/Server/Eigenschaften/eigenschaften.md"));
  assert.ok(paths.includes("Komponenten/Server/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/Server/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/Server/Verhalten/Modell/modell.md"));
  assert.ok(paths.includes("Komponenten/Server/Verhalten/Code/code.md"));
  assert.ok(paths.includes("Komponenten/Server/Verhalten/Config/config.md"));
  assert.ok(paths.includes("Komponenten/Server/Daten/daten.md"));
  assert.ok(paths.includes("Komponenten/Server/Beziehungen/beziehungen.md"));

  const systemVerhalten = sources.find((source) => source.path === "Architektur/systemverhalten/systemverhalten.md");
  assert.match(systemVerhalten.content, /komponentenuebergreifende Ablaeufe/);
  assert.match(systemVerhalten.content, /dekomponieren/);
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
  const properties = sources.find((source) => source.path === "Komponenten/ESP32/Eigenschaften/eigenschaften.md");
  const data = sources.find((source) => source.path === "Komponenten/ESP32/Daten/daten.md");
  const board = sources.find((source) => source.path === "Komponenten/ESP32/Konfiguration/Board/board.md");
  const sensorIn = sources.find((source) => source.path === "Komponenten/ESP32/Konfiguration/Sensoren/in.md");
  const actuatorOut = sources.find((source) => source.path === "Komponenten/ESP32/Konfiguration/Aktoren/out.md");
  assert.ok(required);
  assert.ok(properties);
  assert.ok(data);
  assert.ok(board);
  assert.ok(sensorIn);
  assert.ok(actuatorOut);
  assert.match(required.content, /Required Interfaces/);
  assert.match(required.content, /Stromversorgung/);
  assert.match(properties.content, /Betriebsort: Device/);
  assert.match(data.content, /Messwerte/);
  assert.match(board.content, /Board-Profil/);
  assert.match(sensorIn.content, /I2C/);
  assert.match(sensorIn.content, /ADC/);
  assert.match(actuatorOut.content, /Relais/);
  assert.match(actuatorOut.content, /GPIO/);
});
