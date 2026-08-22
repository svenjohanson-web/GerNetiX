const assert = require("node:assert/strict");
const test = require("node:test");
const { requireForSandbox } = require("../test-support/platform-app-source");
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
const { developmentFirmwareStarterSources } = require("../src/dev/projects/project-configuration-service");
const developmentComponentMetamodel = requireForSandbox("development-component-metamodel.js");

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
  assert.equal(catalog.length, 12);
  assert.equal(catalog.find((template) => template.id === "empty").default_title, "");
  assert.deepEqual(catalog.find((template) => template.id === "sensor_actuator_control"), {
    id: "sensor_actuator_control",
    title: "Sensor-Aktor-Steuerung",
    default_title: "Sensor-Aktor-Steuerung",
    description: "IoT-Device erfasst einen Sensorwert, wertet ihn in einer lokalen Steuerlogik aus und steuert damit einen Aktor.",
    hint: "Sensor, lokale Steuerlogik und Aktor als durchgaengige Wirkungskette.",
    required_entitlements: [],
    board_selection_required: false,
    model_schema_version: 1,
  });
  assert.equal(catalog.some((template) => "architecture" in template || "realization" in template), false);
});

test("provides a board-selectable AI playground without granting access to the basis software", () => {
  const template = developmentProjectTemplate("ai_board_playground");
  const catalogItem = developmentProjectTemplateCatalog().find((item) => item.id === template.id);
  const source = templateArchitecturePlantUml(template, template.title);
  const files = templateFirmwareSources(template, "Audio-Spielwiese");

  assert.equal(catalogItem.board_selection_required, true);
  assert.equal(templateBuildConfig(template), null);
  assert.equal(templateHardwareProfileId(template), "architecture.discovery");
  assert.match(source, /Ausgewähltes Board/);
  assert.match(source, /experimentiert und erweitert/);
  assert.equal(files.some((file) => file.path === "Komponenten/IoT-Device 1/src/user_main.cpp"), true);
  assert.equal(files.some((file) => /basissoftware/i.test(file.path)), false);
  assert.match(files.find((file) => file.path === "README.md").content, /nach deiner Bestätigung übernehmen/);
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

test("binds the ES3C28P touchscreen template to its versioned Forgejo product source", () => {
  const template = developmentProjectTemplate("touchscreen_game_collection");
  const source = templateArchitecturePlantUml(template, template.title);
  const files = templateFirmwareSources(template, "Meine Spiele");

  assert.match(source, /actor "Nutzer" as user/);
  assert.match(source, /rectangle "Board mit Touchdisplay" as device/);
  assert.doesNotMatch(source, /Startbildschirm|Spielauswahl|Game Loop|Beispielspiele|Nibbles|-->/);
  assert.equal(templateHardwareProfileId(template), "hardware.processor_board.esp32_s3_es3c28p");
  assert.equal(template.schemaVersion, 4);
  assert.equal(template.realization.systemSourceId, "gernetix-product-game-collection-esp32");
  assert.equal(templateBuildConfig(template).board, "4d_systems_esp32s3_gen4_r8n16");
  assert.equal(templateBuildConfig(template).framework, "espidf");
  assert.equal(templateBuildConfig(template).flash_size_mb, 16);
  assert.equal(templateBuildConfig(template).firmware_basis_id, "gernetix-runtime-basissoftware");
  assert.equal(templateBuildConfig(template).firmware_basis_variant, "full");
  assert.equal(templateBuildConfig(template).platformio_options.build_unflags, "-Werror");
  assert.equal(templateBuildConfig(template).basissoftware_configuration.communication.ota_available, true);
  assert.deepEqual(files, []);
});

test("provides a two-target camera-to-display template with isolated build roots", () => {
  const template = developmentProjectTemplate("esp32_camera_to_touch_display");
  const architecture = templateArchitecturePlantUml(template, template.title);
  const units = templateSoftwareUnits(template);
  const files = templateFirmwareSources(template, template.title);

  assert.match(architecture, /rectangle "IoT-Device 1" as camera_device \{[\s\S]*rectangle "ESP32-S3 Prozessor" as camera_processor[\s\S]*rectangle "WLAN-\/WiFi-Schnittstelle" as camera_wifi[\s\S]*rectangle "Kamera" as camera/);
  assert.match(architecture, /rectangle "IoT-Device 2" as display_device \{[\s\S]*rectangle "ESP32-S3 Prozessor" as display_processor[\s\S]*rectangle "WLAN-\/WiFi-Schnittstelle" as display_wifi[\s\S]*rectangle "ILI9341V Display-Controller-IC" as display_controller_ic[\s\S]*rectangle "FT6336G Touch-Controller-IC" as touch_controller_ic[\s\S]*rectangle "ES8311 Audio-Codec-IC" as audio_codec_ic[\s\S]*rectangle "NS8002E Audio-Verstärker-IC" as audio_amplifier_ic[\s\S]*rectangle "Display" as display[\s\S]*rectangle "Touch" as touch[\s\S]*rectangle "Lautsprecher" as speaker/);
  assert.doesNotMatch(architecture, /camera_board|display_board|<<Onboard>>|rectangle "Board"/);
  assert.doesNotMatch(architecture, /camera_app|display_app/);
  assert.match(architecture, /actor "Beobachtete Umgebung" as environment <<physical environment>>/);
  assert.match(architecture, /environment --> camera : liefert Bildinhalt/);
  assert.match(architecture, /rectangle "Mikrofon links" as microphone_left/);
  assert.match(architecture, /rectangle "Mikrofon rechts" as microphone_right/);
  assert.match(architecture, /rectangle "ES7210 Audio-ADC-IC" as microphone_adc_ic/);
  assert.match(architecture, /rectangle "ES8311 Audio-Codec-IC" as camera_audio_codec_ic/);
  assert.match(architecture, /rectangle "NS4150B Audio-Verstärker-IC" as camera_audio_amplifier_ic/);
  assert.match(architecture, /rectangle "Lautsprecher" as camera_speaker/);
  assert.match(architecture, /environment --> microphone_left : erzeugt Schall/);
  assert.match(architecture, /environment --> microphone_right : erzeugt Schall/);
  assert.match(architecture, /microphone_left --> microphone_adc_ic : liefert Audiosignal/);
  assert.match(architecture, /microphone_right --> microphone_adc_ic : liefert Audiosignal/);
  assert.match(architecture, /microphone_adc_ic --> camera_processor : liefert Audiodaten/);
  assert.match(architecture, /camera_processor --> camera_audio_codec_ic : liefert Audiodaten/);
  assert.match(architecture, /camera_audio_codec_ic --> camera_audio_amplifier_ic : liefert Audiosignal/);
  assert.match(architecture, /camera_audio_amplifier_ic --> camera_speaker : treibt Lautsprecher/);
  assert.match(architecture, /camera_speaker --> environment : gibt Ton aus/);
  assert.match(architecture, /camera --> camera_processor : liefert Bilddaten/);
  assert.doesNotMatch(architecture, /camera_processor --> display_processor/);
  assert.match(architecture, /camera_processor --> camera_wifi : uebergibt Bilddaten/);
  assert.match(architecture, /camera_wifi --> display_wifi : uebertraegt Bilddaten per WLAN/);
  assert.match(architecture, /display_wifi --> display_processor : liefert Bilddaten/);
  assert.match(architecture, /user --> touch : bedient Touch/);
  assert.match(architecture, /touch --> touch_controller_ic : liefert Beruehrungssignal/);
  assert.match(architecture, /touch_controller_ic --> display_processor : liefert Touchdaten/);
  assert.match(architecture, /display_processor --> display_controller_ic : steuert Anzeige/);
  assert.match(architecture, /display_controller_ic --> display : treibt Display/);
  assert.match(architecture, /display --> user : zeigt Kamerabild/);
  assert.match(architecture, /display_processor --> audio_codec_ic : liefert Audiodaten/);
  assert.match(architecture, /audio_codec_ic --> audio_amplifier_ic : liefert Audiosignal/);
  assert.match(architecture, /audio_amplifier_ic --> speaker : treibt Lautsprecher/);
  assert.match(architecture, /speaker --> user : gibt Ton aus/);
  assert.doesNotMatch(architecture, /user --> display_device/);
  assert.doesNotMatch(architecture, /Waveshare|ES3C28P/);
  assert.equal(template.schemaVersion, 20);
  const architectureElements = new Map(template.architecture.elements.map((element) => [element.id, element]));
  template.architecture.relations.forEach((relation) => {
    assert.equal(
      developmentComponentMetamodel.validatesRelation(architectureElements.get(relation.source)?.kind, architectureElements.get(relation.target)?.kind),
      true,
      `${relation.source} -> ${relation.target} must be a valid component relation`,
    );
  });
  const restoredTypes = new Map();
  architecture.split(/\r?\n/).forEach((line) => {
    const component = line.match(/^\s*(actor|rectangle)\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
    if (component) restoredTypes.set(component[3], developmentComponentMetamodel.componentTypeForPlantUml(component[2], component[1], component[3]));
  });
  architecture.split(/\r?\n/).forEach((line) => {
    const relation = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[-.]+>\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (!relation || !restoredTypes.has(relation[1]) || !restoredTypes.has(relation[2])) return;
    assert.equal(
      developmentComponentMetamodel.validatesRelation(restoredTypes.get(relation[1]), restoredTypes.get(relation[2])),
      true,
      `${relation[1]} -> ${relation[2]} must remain valid after PlantUML restoration`,
    );
  });
  const hardware = templateHardwareConfiguration(template);
  assert.equal(hardware.components.find((component) => component.component_id === "camera_device").board_profile_id, "hardware.processor_board.waveshare_esp32_s3_cam_ov3660");
  assert.equal(hardware.components.find((component) => component.component_id === "display_device").board_profile_id, "hardware.processor_board.esp32_s3_es3c28p");
  assert.equal(hardware.components.find((component) => component.component_id === "camera").target_device_id, "camera_device");
  assert.equal(hardware.components.find((component) => component.component_id === "camera").concrete_type, "ov3660");
  assert.equal(hardware.components.find((component) => component.component_id === "camera").sensor_category, "image");
  assert.equal(hardware.components.find((component) => component.component_id === "microphone_left").concrete_type, "integrated_microphone");
  assert.equal(hardware.components.find((component) => component.component_id === "microphone_left").target_device_id, "camera_device");
  assert.equal(hardware.components.find((component) => component.component_id === "microphone_right").concrete_type, "integrated_microphone");
  assert.equal(hardware.components.find((component) => component.component_id === "microphone_right").target_device_id, "camera_device");
  assert.equal(hardware.components.find((component) => component.component_id === "camera_speaker").concrete_type, "integrated_speaker");
  assert.equal(hardware.components.find((component) => component.component_id === "camera_speaker").target_device_id, "camera_device");
  assert.equal(hardware.components.find((component) => component.component_id === "display").target_device_id, "display_device");
  assert.equal(hardware.components.find((component) => component.component_id === "touch").concrete_type, "integrated_touchscreen");
  assert.equal(hardware.components.find((component) => component.component_id === "touch").target_device_id, "display_device");
  assert.equal(hardware.components.find((component) => component.component_id === "speaker").concrete_type, "integrated_speaker");
  assert.equal(hardware.components.find((component) => component.component_id === "speaker").target_device_id, "display_device");
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
  assert.equal(template.realization.systemSourceId, "gernetix-product-camera-touch-display");
  assert.deepEqual(files, []);
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

test("specializes the sensor IoT-device template for radar room presence", () => {
  const template = developmentProjectTemplate("iot_device_radar");
  const catalogItem = developmentProjectTemplateCatalog().find((item) => item.id === template.id);
  const source = templateArchitecturePlantUml(template, template.title);
  const units = templateSoftwareUnits(template);

  assert.equal(template.baseTemplateId, "esp32_device_only");
  assert.equal(catalogItem.base_template_id, "esp32_device_only");
  assert.equal(template.realization.systemSourceId, "gernetix-product-radar-room-presence");
  assert.match(source, /HLK-LD2410C Radarsensor/);
  assert.match(source, /liefert Präsenzsignal/);
  assert.deepEqual(units.map((unit) => unit.build_config.environment), ["esp32dev", "nanoatmega328", "nanoatmega328new"]);
  assert.equal(units.every((unit) => unit.source_root === "Komponenten/IoT-Device 1"), true);
  assert.deepEqual(templateFirmwareSources(template, template.title), []);
});

test("materializes a buildable starter source when a logical IoT device receives its board", () => {
  const [source] = developmentFirmwareStarterSources([{
    software_unit_id: "software_device",
    build_system: "platformio",
    source_root: "Komponenten/IoT-Device 1",
    entrypoint: "src/user_main.cpp",
    build_config: { framework: "arduino", firmware_basis_id: "" },
  }], "IoT-Device only");

  assert.equal(source.path, "Komponenten/IoT-Device 1/src/user_main.cpp");
  assert.match(source.content, /#include <Arduino\.h>/);
  assert.match(source.content, /void setup\(\)/);
  assert.match(source.content, /void loop\(\)/);
});
