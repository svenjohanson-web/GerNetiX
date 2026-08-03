const assert = require("node:assert/strict");
const test = require("node:test");

const { projectConfigurationSources } = require("../src/modules/project-configuration-projection");

test("materializes every development configuration as deterministic visible project files", () => {
  const sources = projectConfigurationSources(representativeProject());
  const byPath = new Map(sources.map((source) => [source.path, source]));

  assert.deepEqual([...byPath.keys()].sort(), [
    "Komponenten/IoT-Device 1/include/gernetix_board_configuration.h",
    "gernetix/architecture/project.puml",
    "gernetix/configuration/architecture-dialog.json",
    "gernetix/configuration/basissoftware/camera.json",
    "gernetix/configuration/board-peripherals/iot_device_1.json",
    "gernetix/configuration/communication.json",
    "gernetix/configuration/events.json",
    "gernetix/configuration/pwa-dashboard.json",
    "gernetix/configuration/software-features/camera.json",
    "gernetix/hardware/allocation.json",
    "gernetix/hardware/boards/iot_device_1.json",
    "gernetix/project.json",
    "gernetix/software-units/camera.json",
  ]);

  const board = JSON.parse(byPath.get("gernetix/hardware/boards/iot_device_1.json").content);
  assert.equal(board.board_features.display.pins.cs, 5);
  assert.equal(byPath.get("gernetix/hardware/allocation.json").content.includes("inventory-device-secret"), false);
  assert.match(byPath.get("Komponenten/IoT-Device 1/include/gernetix_board_configuration.h").content, /GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS 5/);
  assert.match(byPath.get("gernetix/configuration/software-features/camera.json").content, /Messwerte Kamera/);
  assert.equal(byPath.get("gernetix/configuration/communication.json").content.includes("GerNetiX-Start"), false);
  assert.match(byPath.get("gernetix/configuration/communication.json").content, /<runtime-secret>/);
  assert.equal(byPath.get("gernetix/project.json").content.includes("updated_at"), false);
  assert.equal(byPath.get("gernetix/hardware/boards/iot_device_1.json").content.includes("snapshot_at"), false);
});

test("changes meaningful dialog values but ignores volatile timestamps", () => {
  const original = representativeProject();
  const timestampOnly = representativeProject();
  timestampOnly.updated_at = "2099-01-01T00:00:00.000Z";
  timestampOnly.view_manifest.views[1].payload.updated_at = "2099-01-01T00:00:00.000Z";
  timestampOnly.view_manifest.views[1].payload.components[0].board_configuration.snapshot_at = "2099-01-01T00:00:00.000Z";
  assert.deepEqual(projectConfigurationSources(timestampOnly), projectConfigurationSources(original));

  const changed = representativeProject();
  changed.software_units[0].build_config.component_features.webserver.title = "Neue Kameraansicht";
  changed.view_manifest.views[1].payload.components[0].board_configuration.board_features.display.pins.cs = 18;
  changed.software_units[0].build_config.board_configuration.board_features.display.pins.cs = 18;

  const before = new Map(projectConfigurationSources(original).map((source) => [source.path, source.content]));
  const after = new Map(projectConfigurationSources(changed).map((source) => [source.path, source.content]));
  assert.notEqual(after.get("gernetix/configuration/software-features/camera.json"), before.get("gernetix/configuration/software-features/camera.json"));
  assert.notEqual(after.get("gernetix/hardware/boards/iot_device_1.json"), before.get("gernetix/hardware/boards/iot_device_1.json"));
  assert.notEqual(after.get("Komponenten/IoT-Device 1/include/gernetix_board_configuration.h"), before.get("Komponenten/IoT-Device 1/include/gernetix_board_configuration.h"));
});

function representativeProject() {
  const boardConfiguration = {
    schema_version: 1,
    source: "project",
    name: "ESP32 Kamera",
    base_board_profile_id: "board.esp32.camera",
    snapshot_at: "2026-08-03T10:00:00.000Z",
    board_features: {
      display: {
        enabled: true,
        hardware: "ili9341",
        driver: "lovyan_gfx",
        connection: "spi",
        pins: { cs: 5, dc: 2 },
        value: "320x240",
      },
    },
  };
  return {
    project_id: "project-projection",
    title: "Kamera-Projekt",
    description: "Konfiguration muss Dateien erzeugen",
    hardware_profile_id: "board.esp32.camera",
    active_software_unit_id: "camera",
    updated_at: "2026-08-03T11:00:00.000Z",
    software_units: [{
      software_unit_id: "camera",
      title: "Kamera",
      software_kind: "embedded_firmware",
      build_system: "platformio",
      source_root: "Komponenten/IoT-Device 1",
      entrypoint: "src/user_main.cpp",
      hardware_profile_id: "board.esp32.camera",
      build_config: {
        platform: "espressif32",
        board: "esp32dev",
        firmware_basis_id: "gernetix-runtime-basissoftware",
        firmware_basis_variant: "full",
        board_configuration: structuredClone(boardConfiguration),
        basissoftware_configuration: {
          schema_version: 1,
          wifi: { enabled: true, mode: "station", auto_reconnect: true },
          mqtt: { enabled: false },
          power_manager: { enabled: false },
        },
        component_features: {
          enabled: ["wifi", "http", "webserver", "measurement_chart"],
          webserver: { title: "Messwerte Kamera", measurement_chart: true, measurement_label: "Temperatur", measurement_unit: "°C" },
        },
        component_hardware_features: { iot_device_1: { enabled: ["adc", "pwm"] } },
        component_device_allocations: [{ component_path: "Komponenten/IoT-Device 1", device_id: "inventory-device-secret" }],
      },
    }],
    view_manifest: {
      template_ref: { template_id: "camera", model_schema_version: 1 },
      architecture_dialog: { schema_version: 1, goal: "Kamerabild anzeigen" },
      communication_setup: { schema_version: 2, mode: "device_access_point", access_point: { ssid: "GerNetiX-Camera", password: "GerNetiX-Start" } },
      pwa_dashboard: { schema_version: 1, title: "Kamera", visible_cards: ["current_values"] },
      event_configuration: { worker: { schema_version: 1, event_name: "camera_tick", trigger_type: "timer", cycle_minutes: 1 } },
      views: [{
        id: "architecture-diagram",
        payload: { source: "@startuml\ncomponent Kamera\n@enduml", generated_at: "2026-08-03T10:00:00.000Z" },
      }, {
        id: "hardware-configuration",
        payload: {
          schema_version: 6,
          updated_at: "2026-08-03T10:00:00.000Z",
          components: [{
            component_id: "iot_device_1",
            label: "IoT-Device 1",
            abstract_type: "iot_device",
            inventory_device_id: "inventory-device-secret",
            inventory_device_label: "Mein privates Board",
            board_configuration: structuredClone(boardConfiguration),
          }],
        },
      }],
    },
  };
}
