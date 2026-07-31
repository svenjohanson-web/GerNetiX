const assert = require("node:assert/strict");
const test = require("node:test");
const {
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  developmentProjectTemplatePreviews,
  mergeSelectedGamesHeader,
  templateArchitecturePlantUml,
  templateBuildConfig,
  templateFirmwareSources,
  templateHardwareConfiguration,
  templateHardwareProfileId,
  templateSoftwareUnits,
} = require("../src/dev/development-project-templates");
const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../../project-server/src/modules/esp32-basissoftware-package");

test("separates semantic template models from rendered views", () => {
  const template = developmentProjectTemplate("esp32_datalogger_local_web");
  assert.equal(template.schemaVersion, 1);
  assert.equal(template.nodes, undefined);
  assert.deepEqual(template.architecture.elements.find((element) => element.id === "device"), {
    id: "device",
    label: "IoT-Device Datenlogger",
    kind: "iot_device",
  });
  assert.equal(template.architecture.relations.some((relation) => relation.target === "storage"), false);
  assert.match(templateArchitecturePlantUml(template, template.title), /rectangle "IoT-Device Datenlogger" as device/);
});

test("exposes one UI catalog without architecture or realization internals", () => {
  const catalog = developmentProjectTemplateCatalog();
  assert.equal(catalog.length, 10);
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

test("provides the complete ES3C28P touchscreen example as versioned template sources", () => {
  const template = developmentProjectTemplate("touchscreen_game_collection");
  const source = templateArchitecturePlantUml(template, template.title);
  const files = templateFirmwareSources(template, "Meine Spiele");

  assert.match(source, /actor "Nutzer" as user/);
  assert.match(source, /rectangle "Board mit Touchdisplay" as device/);
  assert.doesNotMatch(source, /Startbildschirm|Spielauswahl|Game Loop|Beispielspiele|Nibbles|-->/);
  assert.equal(templateHardwareProfileId(template), "hardware.processor_board.esp32_s3_es3c28p");
  assert.equal(templateBuildConfig(template).board, "esp32-s3-devkitc-1");
  assert.equal(templateBuildConfig(template).framework, "arduino");
  assert.equal(templateBuildConfig(template).flash_size_mb, 16);
  assert.match(files.find((file) => file.path === "platformio.ini").content, /LovyanGFX/);
  assert.match(files.find((file) => file.path === "src/board_adapter.cpp").content, /Es3c28pDisplay/);
  assert.match(files.find((file) => file.path === "src/main.cpp").content, /void setup\(\)/);
  for (const game of ["nibbles", "frogger", "arkanoid", "space_invaders"]) {
    assert.equal(files.some((file) => file.path === `src/${game}.cpp`), true);
  }
});

test("provides a two-target camera-to-display template with isolated build roots", () => {
  const template = developmentProjectTemplate("esp32_camera_to_touch_display");
  const architecture = templateArchitecturePlantUml(template, template.title);
  const units = templateSoftwareUnits(template);
  const files = templateFirmwareSources(template, template.title);

  assert.match(architecture, /rectangle "Kamera" as camera/);
  assert.match(architecture, /rectangle "IoT-Device 1" as camera_device/);
  assert.match(architecture, /rectangle "IoT-Device 2" as display_device/);
  assert.match(architecture, /rectangle "Display" as display/);
  assert.match(architecture, /camera --> camera_device : liefert Bilddaten/);
  assert.match(architecture, /camera_device --> display_device : uebertraegt Bilddaten/);
  assert.match(architecture, /user --> display : betrachtet Kamerabild/);
  assert.doesNotMatch(architecture, /user --> display_device/);
  assert.doesNotMatch(architecture, /Waveshare|ES3C28P/);
  assert.equal(template.schemaVersion, 5);
  const hardware = templateHardwareConfiguration(template);
  assert.equal(hardware.components.find((component) => component.component_id === "camera_device").board_profile_id, "hardware.processor_board.waveshare_esp32_s3_cam_ov3660");
  assert.equal(hardware.components.find((component) => component.component_id === "display_device").board_profile_id, "hardware.processor_board.esp32_s3_es3c28p");
  assert.equal(hardware.components.find((component) => component.component_id === "camera").target_device_id, "camera_device");
  assert.equal(hardware.components.find((component) => component.component_id === "camera").concrete_type, "ov3660");
  assert.equal(hardware.components.find((component) => component.component_id === "camera").sensor_category, "image");
  assert.equal(hardware.components.find((component) => component.component_id === "display").target_device_id, "display_device");
  assert.equal(templateHardwareProfileId(template), "hardware.processor_board.waveshare_esp32_s3_cam_ov3660");
  assert.equal(units.length, 2);
  assert.equal(units[0].software_unit_id, "camera_sender");
  assert.equal(units[0].title, "Kamera-Host");
  assert.equal(units[0].source_root, "Komponenten/IoT-Device 1");
  assert.equal(units[0].entrypoint, "src/user_main.cpp");
  assert.equal(units[0].hardware_profile_id, "hardware.processor_board.waveshare_esp32_s3_cam_ov3660");
  assert.equal(units[0].build_config.framework, "espidf");
  assert.equal(units[0].build_config.board, "4d_systems_esp32s3_gen4_r8n16");
  assert.equal(units[0].build_config.firmware_basis_id, "gernetix-runtime-basissoftware");
  assert.equal(units[0].build_config.firmware_basis_variant, "full");
  assert.equal(units[1].software_unit_id, "display_receiver");
  assert.equal(units[1].title, "Display-Client");
  assert.equal(units[1].source_root, "Komponenten/IoT-Device 2");
  assert.equal(units[1].entrypoint, "src/user_main.cpp");
  assert.equal(units[1].hardware_profile_id, "hardware.processor_board.esp32_s3_es3c28p");
  assert.equal(units[1].build_config.framework, "espidf");
  assert.equal(units[1].build_config.board, "4d_systems_esp32s3_gen4_r8n16");
  assert.equal(units[1].build_config.firmware_basis_id, "gernetix-runtime-basissoftware");
  assert.match(files.find((file) => file.path === "Komponenten/IoT-Device 1/src/user_main.cpp").content, /camera_driver_pending/);
  assert.match(files.find((file) => file.path === "Komponenten/IoT-Device 1/src/user_main.cpp").content, /GERNETIX_BOARD_FEATURE_CAMERA/);
  assert.match(files.find((file) => file.path === "Komponenten/IoT-Device 2/src/user_main.cpp").content, /display_driver_pending/);
  assert.doesNotMatch(files.find((file) => file.path === "Komponenten/IoT-Device 1/src/user_main.cpp").content, /esp_camera_init|GET \/capture/);
  assert.doesNotMatch(files.find((file) => file.path === "Komponenten/IoT-Device 2/src/user_main.cpp").content, /drawJpg/);
  assert.match(files.find((file) => file.path === "Komponenten/IoT-Device 1/platformio.ini").content, /framework = espidf/);
  assert.match(files.find((file) => file.path === "Komponenten/IoT-Device 1/platformio.ini").content, /partitions_full_16mb\.csv/);
  assert.match(files.find((file) => file.path === "Komponenten/IoT-Device 2/platformio.ini").content, /GERNETIX_BASISSOFTWARE_PROFILE_FULL/);
  assert.equal(files.some((file) => file.path === "Architektur/Kamera-zu-Display.md"), true);
  assert.equal(files.some((file) => file.path.startsWith("Software/")), false);
  assert.equal(files.some((file) => file.path.startsWith("Docs/")), false);

  for (const unit of units) {
    const prefix = `${unit.source_root}/`;
    const projectSources = files.filter((file) => file.path.startsWith(prefix)).map((file) => ({ ...file, path: file.path.slice(prefix.length) }));
    const boardConfiguration = {
      source: "system_catalog",
      name: unit.title,
      base_board_profile_id: unit.hardware_profile_id,
      board_features: unit.software_unit_id === "camera_sender"
        ? { camera: { enabled: true, hardware: "ov3660", driver: "espressif_esp32_camera", connection: "parallel_dvp_sccb", pins: { xclk: 38 } } }
        : { display: { enabled: true, hardware: "tft_lcd", driver: "ili9341", connection: "spi", pins: { mosi: 11 } } },
    };
    const composed = composeEsp32BasissoftwarePackage({
      basisFiles: loadEsp32BasissoftwareFiles(),
      projectSources,
      buildConfig: { ...unit.build_config, board_configuration: boardConfiguration },
    });
    assert.equal(composed.some((file) => file.path === "src/main.cpp"), true);
    assert.equal(composed.some((file) => file.path === "src/user/user_app.cpp"), true);
    assert.equal(composed.some((file) => file.path === "include/gernetix_board_configuration.h"), true);
    assert.equal(composed.some((file) => file.path === "sdkconfig.esp32-s3-n16r8"), true);
    assert.match(composed.find((file) => file.path === "platformio.ini").content, /partitions_full_16mb\.csv/);
    assert.match(composed.find((file) => file.path === "platformio.ini").content, /4d_systems_esp32s3_gen4_r8n16/);
  }
});

test("keeps confirmed custom games when the built-in game form is saved again", () => {
  const existing = `${mergeSelectedGamesHeader(["nibbles"], "")}
#define GNX_GAME_ASTEROIDS_ENABLED 1
#define GNX_GAME_ASTEROIDS_ENABLED 0
#define GNX_GAME_BREAKOUT_ENABLED 1
`;
  const merged = mergeSelectedGamesHeader(["frogger"], existing);

  assert.match(merged, /GNX_GAME_NIBBLES_ENABLED 0/);
  assert.match(merged, /GNX_GAME_FROGGER_ENABLED 1/);
  assert.match(merged, /GNX_GAME_ASTEROIDS_ENABLED 1/);
  assert.equal((merged.match(/GNX_GAME_ASTEROIDS_ENABLED/g) || []).length, 1);
  assert.equal((merged.match(/GNX_GAME_BREAKOUT_ENABLED/g) || []).length, 1);
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
  assert.doesNotMatch(templateArchitecturePlantUml(internetLogger, internetLogger.title), /rectangle "Internet"/);
  assert.doesNotMatch(templateArchitecturePlantUml(internetLogger, internetLogger.title), /database "/);
  assert.doesNotMatch(templateArchitecturePlantUml(localLogger, localLogger.title), /NVS \/ LittleFS/);
  for (const template of [device, localLogger, internetLogger]) {
    const source = templateArchitecturePlantUml(template, template.title);
    assert.doesNotMatch(source, /\bnote\b|end note|KI-abgeleitete|bestaetigte Architekturentscheidung/i);
    assert.doesNotMatch(source, /ESP32/);
    assert.doesNotMatch(source, /^\s*(?:node|component|database|cloud|queue|artifact)\s+"/gmi);
  }
});

test("provides a data logger template with only user-configurable components", () => {
  const template = developmentProjectTemplate("iot_datalogger_web_push_pwa");
  const source = templateArchitecturePlantUml(template, template.title);

  assert.equal(template.schemaVersion, 1);
  assert.match(template.description, /Datenlogger erfasst Messwerte/);
  assert.match(template.description, /optionalen Push in seiner Projekt-PWA/);
  assert.match(template.hint, /Datenlogger und Projekt-PWA/);
  assert.match(source, /IoT-Device Datenlogger/);
  assert.match(source, /Projekt-PWA auf dem iPhone/);
  assert.match(source, /richtet Datenerfassung ein/);
  assert.match(source, /nutzt Messwertverlauf und optionalen Push/);
  assert.doesNotMatch(source, /Telemetrie-API|Projekt-Speicher|Projekt-Push/);
  assert.equal(templateHardwareProfileId(template), "architecture.discovery");
  assert.equal(templateBuildConfig(template), null);
  assert.deepEqual(templateFirmwareSources(template, "Mein Push-Logger"), []);
  assert.deepEqual(template.requiredEntitlements, []);
  assert.deepEqual(template.dataLogger, {
    required: true,
    storageScope: "project_private",
    configurationState: "requires_sensor_configuration",
    userConfiguration: ["Messquelle und Messintervall", "Messwertbezeichnung und Einheit", "Aufbewahrungsdauer", "Ereignisregel; optional Push aktivieren"],
  });
  assert.deepEqual(developmentProjectTemplateCatalog().find((item) => item.id === "iot_datalogger_web_push_pwa").required_entitlements, []);
});

test("provides an event-driven project application with only user-configurable architecture elements", () => {
  const template = developmentProjectTemplate("event_driven_project_application");
  const source = templateArchitecturePlantUml(template, template.title);

  assert.match(template.description, /IoT-Ereignisquelle loest eine projektdefinierte Worker-Regel aus/);
  assert.match(source, /IoT-Device Ereignisquelle/);
  assert.match(source, /Ereignis-Worker/);
  assert.match(source, /Ereignis-Dispatcher/);
  assert.match(source, /IoT-Zielgeraet\(e\)/);
  assert.match(source, /Ereignis ausloesen/);
  assert.match(source, /freigegebenes Folgeereignis/);
  assert.match(source, /Aktion zustellen/);
  assert.doesNotMatch(source, /Telemetrie-API|Projekt-Runtime-Daten|Projekt-Push/);
  assert.equal(templateBuildConfig(template), null);
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
