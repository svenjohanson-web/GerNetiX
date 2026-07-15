const assert = require("node:assert/strict");
const test = require("node:test");
const {
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  developmentProjectTemplatePreviews,
  templateArchitecturePlantUml,
  templateBuildConfig,
  templateFirmwareSources,
  templateHardwareProfileId,
} = require("../src/dev/development-project-templates");

test("separates semantic template models from rendered views", () => {
  const template = developmentProjectTemplate("esp32_datalogger_local_web");
  assert.equal(template.schemaVersion, 1);
  assert.equal(template.nodes, undefined);
  assert.deepEqual(template.architecture.elements.find((element) => element.id === "device"), {
    id: "device",
    label: "IoT-Device Datenlogger",
    kind: "iot_device",
  });
  assert.deepEqual(template.architecture.relations.find((relation) => relation.target === "storage"), {
    source: "device",
    target: "storage",
    label: "Historie",
  });
  assert.match(templateArchitecturePlantUml(template, template.title), /rectangle "IoT-Device Datenlogger" as device/);
});

test("exposes one UI catalog without architecture or realization internals", () => {
  const catalog = developmentProjectTemplateCatalog();
  assert.equal(catalog.length, 8);
  assert.equal(catalog.find((template) => template.id === "empty").default_title, "");
  assert.deepEqual(catalog.find((template) => template.id === "sensor_actuator_control"), {
    id: "sensor_actuator_control",
    title: "Sensor-Aktor-Steuerung",
    default_title: "Sensor-Aktor-Steuerung",
    description: "IoT-Device erfasst einen Sensorwert, wertet ihn in einer lokalen Steuerlogik aus und steuert damit einen Aktor.",
    hint: "Sensor, lokale Steuerlogik und Aktor als durchgaengige Wirkungskette.",
    required_entitlements: [],
    model_schema_version: 1,
  });
  assert.equal(catalog.some((template) => "architecture" in template || "realization" in template), false);
});

test("renders initial previews separately and keeps the empty project blank", () => {
  const previews = developmentProjectTemplatePreviews();
  assert.equal(previews.some((preview) => preview.template_id === "empty"), false);
  assert.equal(previews.length, developmentProjectTemplateCatalog().length - 1);
  assert.match(previews.find((preview) => preview.template_id === "sensor_actuator_control").source, /Sensor 1/);
  assert.equal(previews.every((preview) => preview.derived_from === "project_template_preview"), true);
});

test("provides a technology-neutral distributed home automation template", () => {
  const template = developmentProjectTemplate("distributed_home_automation");
  const source = templateArchitecturePlantUml(template, template.title);

  assert.match(source, /IoT-Device 1\\nSensor-Node/);
  assert.match(source, /IoT-Device 2\\nAktor-Node/);
  assert.match(source, /IoT-Device 3\\nBediengeraet/);
  assert.match(source, /rectangle "Zustandskoordination" as coordination/);
  assert.match(source, /Befehle \/ Sollzustand/);
  assert.match(source, /Istzustand/);
  assert.doesNotMatch(source, /Home Assistant|GerNetiX Home Server|Zigbee|MQTT|REST|WLAN/);
  assert.equal(templateHardwareProfileId(template), "architecture.discovery");
});

test("provides a sensor-actuator control template as one logical effect chain", () => {
  const template = developmentProjectTemplate("sensor_actuator_control");
  const source = templateArchitecturePlantUml(template, template.title);

  assert.match(source, /rectangle "Sensor 1" as sensor/);
  assert.match(source, /rectangle "IoT-Device 1" as device/);
  assert.match(source, /rectangle "Aktor 1" as actuator/);
  assert.match(source, /sensor --> device : liefert Messwert/);
  assert.match(source, /device --> actuator : steuert anhand der lokalen Logik/);
  assert.equal(templateHardwareProfileId(template), "architecture.discovery");
  assert.equal(templateBuildConfig(template), null);
});

test("provides a buildable touchscreen game collection with separated user sources", () => {
  const template = developmentProjectTemplate("touchscreen_game_collection");
  const source = templateArchitecturePlantUml(template, template.title);
  const files = templateFirmwareSources(template, "Meine Spiele");

  assert.match(source, /actor "Nutzer" as user/);
  assert.match(source, /rectangle "Board mit Touchdisplay" as device/);
  assert.doesNotMatch(source, /Startbildschirm|Spielauswahl|Game Loop|Beispielspiele|Nibbles|-->/);
  assert.equal(templateHardwareProfileId(template), "hardware.processor_board.generic_esp32_s3_touch_display");
  assert.equal(templateBuildConfig(template).board, "esp32-s3-devkitc-1");
  assert.match(files.find((file) => file.path.endsWith("user_main.cpp")).content, /GameApplication/);
  assert.match(files.find((file) => file.path.endsWith("view\/start_screen.h")).content, /class StartScreen/);
  for (const game of ["nibbles", "snake", "frogger", "tic_tac_toe", "pong", "breakout", "memory"]) {
    assert.equal(files.some((file) => file.path.endsWith(`games/${game}.h`)), true);
  }
  assert.match(files.find((file) => file.path.endsWith("config/selected_games.h")).content, /GNX_GAME_SNAKE_ENABLED 1/);
});

test("provides IoT device project templates with distinct start architectures", () => {
  const device = developmentProjectTemplate("esp32_device_only");
  const localLogger = developmentProjectTemplate("esp32_datalogger_local_web");
  const internetLogger = developmentProjectTemplate("esp32_datalogger_internet_web");

  assert.match(templateArchitecturePlantUml(device, device.title), /IoT-Device 1/);
  assert.match(templateArchitecturePlantUml(device, device.title), /rectangle "Sensoren" as sensors/);
  assert.doesNotMatch(templateArchitecturePlantUml(device, device.title), /Sensoren \/ Aktoren|Aktorik|Aktoren/);
  assert.doesNotMatch(templateArchitecturePlantUml(device, device.title), /Internet|ESP32/);
  assert.doesNotMatch(templateArchitecturePlantUml(device, device.title), /database|SQLite/i);
  assert.match(templateArchitecturePlantUml(localLogger, localLogger.title), /Lokaler Webserver/);
  assert.match(templateArchitecturePlantUml(internetLogger, internetLogger.title), /Webserver \/ API/);
  assert.match(templateArchitecturePlantUml(internetLogger, internetLogger.title), /Webserver \/ API\\nSoftware: SQL-Datenbank/);
  assert.doesNotMatch(templateArchitecturePlantUml(internetLogger, internetLogger.title), /database "/);
  assert.match(templateArchitecturePlantUml(localLogger, localLogger.title), /NVS \/ LittleFS/);
  for (const template of [device, localLogger, internetLogger]) {
    const source = templateArchitecturePlantUml(template, template.title);
    assert.doesNotMatch(source, /\bnote\b|end note|KI-abgeleitete|bestaetigte Architekturentscheidung/i);
    assert.doesNotMatch(source, /ESP32/);
    assert.doesNotMatch(source, /^\s*(?:node|component|database|cloud|queue|artifact)\s+"/gmi);
  }
});

test("provides an account-bound web-push PWA data logger template", () => {
  const template = developmentProjectTemplate("iot_datalogger_web_push_pwa");
  const source = templateArchitecturePlantUml(template, template.title);

  assert.equal(template.schemaVersion, 1);
  assert.match(template.description, /private PWA auf dem iPhone/);
  assert.match(source, /IoT-Device Datenlogger/);
  assert.match(source, /GerNetiX VPS\\nPrivate Push-API/);
  assert.match(source, /Private PWA auf dem iPhone/);
  assert.match(source, /Push-Subscription und Konfiguration/);
  assert.match(source, /Web Push an die private Subscription/);
  assert.equal(templateHardwareProfileId(template), "architecture.discovery");
  assert.equal(templateBuildConfig(template), null);
  assert.deepEqual(templateFirmwareSources(template, "Mein Push-Logger"), []);
  assert.deepEqual(template.requiredEntitlements, ["web_push"]);
  assert.deepEqual(developmentProjectTemplateCatalog().find((item) => item.id === "iot_datalogger_web_push_pwa").required_entitlements, ["web_push"]);
});

test("falls back to the empty project template for unknown ids", () => {
  assert.equal(developmentProjectTemplate("unknown").id, "empty");
});

test("IoT-device-only template remains logical until hardware realization", () => {
  const template = developmentProjectTemplate("esp32_device_only");
  const sources = templateFirmwareSources(template, "Durchstich");

  const buildConfig = templateBuildConfig(template);
  assert.equal(templateHardwareProfileId(template), "architecture.discovery");
  assert.equal(buildConfig, null);
  assert.deepEqual(sources, []);
  assert.deepEqual(templateFirmwareSources(developmentProjectTemplate("empty"), "Leer"), []);
});
