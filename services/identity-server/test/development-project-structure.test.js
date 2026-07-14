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
        "node \"IoT-Device 1\" as device",
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
  assert.equal(paths.some((path) => path.includes("/Eigenschaften/")), false);
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Verhalten/Modell/modell.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Verhalten/Code/code.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Konfiguration/Software/software.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Konfiguration/Hardware/Board/board.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Konfiguration/Hardware/Sensoren/in.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Konfiguration/Hardware/Aktoren/out.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Daten/daten.md"));
  assert.ok(paths.includes("Komponenten/IoT-Device 1/Beziehungen/beziehungen.md"));
  assert.equal(paths.some((sourcePath) => sourcePath.startsWith("Komponenten/ESP32/")), false);
  assert.ok(paths.includes("Komponenten/MQTT-Client/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Verhalten/Modell/modell.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Verhalten/Code/code.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Konfiguration/Software/software.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Daten/daten.md"));
  assert.ok(paths.includes("Komponenten/MQTT-Client/Beziehungen/beziehungen.md"));
  assert.ok(paths.includes("Komponenten/Server/Schnittstellen/provided.md"));
  assert.ok(paths.includes("Komponenten/Server/Schnittstellen/required.md"));
  assert.ok(paths.includes("Komponenten/Server/Verhalten/Modell/modell.md"));
  assert.ok(paths.includes("Komponenten/Server/Verhalten/Code/code.md"));
  assert.ok(paths.includes("Komponenten/Server/Konfiguration/Software/software.md"));
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
        "node \"IoT-Device 1\" as device",
        "@enduml",
      ].join("\n"),
      detected_blocks: ["device"],
    },
  });

  const required = sources.find((source) => source.path === "Komponenten/IoT-Device 1/Schnittstellen/required.md");
  const data = sources.find((source) => source.path === "Komponenten/IoT-Device 1/Daten/daten.md");
  const software = sources.find((source) => source.path === "Komponenten/IoT-Device 1/Konfiguration/Software/software.md");
  const board = sources.find((source) => source.path === "Komponenten/IoT-Device 1/Konfiguration/Hardware/Board/board.md");
  const sensorIn = sources.find((source) => source.path === "Komponenten/IoT-Device 1/Konfiguration/Hardware/Sensoren/in.md");
  const actuatorOut = sources.find((source) => source.path === "Komponenten/IoT-Device 1/Konfiguration/Hardware/Aktoren/out.md");
  assert.ok(required);
  assert.ok(data);
  assert.ok(software);
  assert.ok(board);
  assert.ok(sensorIn);
  assert.ok(actuatorOut);
  assert.match(required.content, /Required Interfaces/);
  assert.match(required.content, /Stromversorgung/);
  assert.match(data.content, /Messwerte/);
  assert.match(software.content, /Software-Konfiguration/);
  assert.match(board.content, /Board-Profil/);
  assert.match(sensorIn.content, /I2C/);
  assert.match(sensorIn.content, /ADC/);
  assert.match(actuatorOut.content, /Relais/);
  assert.match(actuatorOut.content, /GPIO/);
});

test("does not invent a SQLite component for storage on an ESP32 without a server", () => {
  const sources = developmentProjectSources({
    title: "ESP32 Device only",
    description: "Messwerte lokal speichern und als Historie anzeigen.",
    diagram: {
      source: '@startuml\nnode "ESP32 Device" as device\ndatabase "Lokaler Messwertspeicher" as storage\n@enduml',
      detected_blocks: ["device", "database"],
    },
  });
  assert.equal(sources.some((source) => source.path.includes("SQLite-Datenbank")), false);
  assert.equal(sources.some((source) => source.path.startsWith("Komponenten/IoT-Device 1/")), true);
});

test("models central SQL storage as a software property of a server", () => {
  const sources = developmentProjectSources({
    title: "Zentrale Messwerte",
    description: "Daten zentral in SQLite speichern und weltweit ueber eine API abrufen.",
  });
  const paths = sources.map((source) => source.path);
  assert.equal(paths.some((path) => path.includes("SQLite-Datenbank")), false);
  assert.ok(paths.includes("Komponenten/Server/Konfiguration/Software/software.md"));
  const software = sources.find((source) => source.path === "Komponenten/Server/Konfiguration/Software/software.md");
  assert.match(software.content, /SQL\/SQLite-Persistenz/);
});
