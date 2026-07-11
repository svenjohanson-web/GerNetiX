const TEMPLATES = {
  empty: {
    id: "empty",
    title: "Leeres Projekt",
    description: "Architektur und Anforderungen gemeinsam von Grund auf klaeren.",
  },
  esp32_device_only: {
    id: "esp32_device_only",
    title: "ESP32 Device only",
    description: "Eigenstaendiges ESP32-Device mit lokaler Sensorik oder Aktorik, ohne Webserver und ohne Internet-Abhaengigkeit.",
    hardwareProfileId: "hardware.processor_board.generic_esp_wroom32",
    buildConfig: {
      environment: "esp32dev",
      platform: "espressif32",
      board: "esp32dev",
      framework: "espidf",
      libraries: [],
      firmware_basis_id: "gernetix-runtime-basissoftware",
      firmware_basis_version: "workspace",
      user_source_path: "src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
    },
    nodes: [
      'actor "Nutzer" as user',
      'node "ESP32 Device" as device',
      'component "Sensoren / Aktoren" as io',
      'user --> device : lokale Bedienung',
      'device <--> io : GPIO / I2C / ADC',
    ],
  },
  esp32_datalogger_local_web: {
    id: "esp32_datalogger_local_web",
    title: "Datenlogger mit lokalem Webserver",
    description: "ESP32-Datenlogger mit Sensoren, lokaler Speicherung und einem nur im lokalen Netzwerk erreichbaren Webserver.",
    nodes: [
      'actor "Nutzer im lokalen Netz" as user',
      'node "ESP32 Datenlogger" as device',
      'component "Sensoren" as sensors',
      'database "Lokaler Messwertspeicher" as storage',
      'component "Lokaler Webserver" as web',
      'sensors --> device : Messwerte',
      'device --> storage : Historie',
      'device --> web : Status und Messwerte',
      'user --> web : WLAN / HTTP im LAN',
    ],
  },
  esp32_datalogger_internet_web: {
    id: "esp32_datalogger_internet_web",
    title: "ESP32 Datenlogger mit Internet-Webserver",
    description: "ESP32-Datenlogger uebertraegt Messwerte sicher an einen internet-erreichbaren Server mit Datenbank und Browser-Dashboard.",
    nodes: [
      'actor "Nutzer" as user',
      'node "ESP32 Datenlogger" as device',
      'component "Sensoren" as sensors',
      'cloud "Internet" as internet',
      'component "Webserver / API" as server',
      'database "Messwertdatenbank" as database',
      'component "Browser Dashboard" as browser',
      'sensors --> device : Messwerte',
      'device --> internet : HTTPS / MQTT',
      'internet --> server',
      'server --> database : Messwerte speichern',
      'user --> browser',
      'browser --> server : HTTPS',
    ],
  },
};

function developmentProjectTemplate(templateId) {
  return TEMPLATES[String(templateId || "empty")] || TEMPLATES.empty;
}

function templateArchitecturePlantUml(template, title) {
  if (!template.nodes) return "";
  return [
    "@startuml",
    `title Architektur-Skizze: ${String(title || template.title).replace(/"/g, "'")}`,
    "",
    ...template.nodes,
    "",
    "note bottom",
    "  Startarchitektur aus Projekttemplate; im Discovery-Dialog weiter konkretisieren.",
    "end note",
    "@enduml",
  ].join("\n");
}

function templateFirmwareSources(template, title) {
  if (!template.buildConfig) return [];
  return [{
    path: "src/user_main.cpp",
    role: "user_code",
    content_type: "text/x-c++src",
    content: [
      '#include "user/user_app.h"',
      "",
      'extern "C" void userMain() {',
      `  // Projektstart: ${String(title || template.title).replace(/["\\]/g, "")}`,
      "}",
      "",
      'extern "C" void userTick() {',
      "  // Wiederkehrende Nutzerlogik wird von der Basissoftware aufgerufen.",
      "}",
      "",
    ].join("\n"),
  }];
}

module.exports = { developmentProjectTemplate, templateArchitecturePlantUml, templateFirmwareSources };
