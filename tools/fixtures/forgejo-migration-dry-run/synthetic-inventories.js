"use strict";

const crypto = require("node:crypto");

const FIXTURE_TIMESTAMP = "2026-01-15T10:30:00.000Z";

function project(projectId, overrides = {}) {
  return {
    project_id: projectId,
    user_id: `synthetic-owner-${projectId}`,
    title: `Synthetic ${projectId}`,
    description: "Vollstaendig kuenstlicher Migrationsbestand ohne Personenbezug.",
    learning_project_id: "",
    hardware_profile_id: "board.esp32.synthetic",
    device_id: null,
    build_config: null,
    software_units: [],
    active_software_unit_id: "",
    view_manifest: { schema_version: 1, views: [] },
    status: "active",
    created_at: "2026-01-15T09:00:00.000Z",
    updated_at: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

function source(projectId, sourcePath, content, contentType = "text/plain", overrides = {}) {
  return {
    project_id: projectId,
    path: sourcePath,
    content,
    content_sha256: crypto.createHash("sha256").update(content).digest("hex"),
    content_type: contentType,
    role: "user_code",
    updated_at: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

function version(projectValue, versionId, parentVersionId, createdAt, sources, overrides = {}) {
  return {
    version_id: versionId,
    project_id: projectValue.project_id,
    parent_version_id: parentVersionId,
    created_by_user_id: `synthetic-author-${versionId}`,
    message: `Synthetischer Stand ${versionId}`,
    state: "saved",
    includes_binary: false,
    snapshot_sha256: "",
    project_snapshot: structuredClone(projectValue),
    sources: structuredClone(sources),
    created_at: createdAt,
    ...overrides,
  };
}

function inventory(projectValue, sources = [], versions = []) {
  return {
    source_kind: "synthetic_fixture",
    projects: [projectValue],
    sources,
    versions,
    read_errors: [],
  };
}

function emptyProject() {
  return inventory(project("fixture-empty", {
    title: "Leeres Projekt",
    hardware_profile_id: "",
  }));
}

function normalEsp32Project() {
  const projectId = "fixture-esp32";
  const projectValue = project(projectId, {
    title: "ESP32 Blinklicht",
    active_software_unit_id: "controller",
    software_units: [{
      software_unit_id: "controller",
      title: "ESP32 Controller",
      software_kind: "firmware",
      build_system: "platformio",
      source_root: "firmware/controller",
      entrypoint: "src/main.cpp",
      hardware_profile_id: "board.esp32.synthetic",
      build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
    }],
  });
  return inventory(projectValue, [
    source(projectId, "platformio.ini", "[env:esp32dev]\nplatform = espressif32\nboard = esp32dev\nframework = arduino\n"),
    source(projectId, "firmware/controller/src/main.cpp", "#include <Arduino.h>\nvoid setup() { pinMode(2, OUTPUT); }\nvoid loop() { digitalWrite(2, HIGH); }\n", "text/x-c++src"),
  ]);
}

function multipleSoftwareUnits() {
  const projectId = "fixture-multi-unit";
  const projectValue = project(projectId, {
    title: "Mehrere Softwareeinheiten",
    active_software_unit_id: "edge-node",
    software_units: [{
      software_unit_id: "dashboard",
      title: "Lokales Dashboard",
      software_kind: "web_application",
      build_system: "npm",
      source_root: "apps/dashboard",
      entrypoint: "src/index.js",
      hardware_profile_id: "",
      build_config: { script: "build" },
    }, {
      software_unit_id: "edge-node",
      title: "Edge Node",
      software_kind: "firmware",
      build_system: "platformio",
      source_root: "firmware/edge-node",
      entrypoint: "src/main.cpp",
      hardware_profile_id: "board.esp32.synthetic",
      build_config: { board: "esp32-s3-devkitc-1", framework: "espidf" },
    }, {
      software_unit_id: "simulator",
      title: "Sensor Simulator",
      software_kind: "service",
      build_system: "node",
      source_root: "services/simulator",
      entrypoint: "index.js",
      hardware_profile_id: "",
      build_config: { runtime: "nodejs" },
    }],
  });
  return inventory(projectValue, [
    source(projectId, "apps/dashboard/src/index.js", "export const status = 'synthetic';\n", "application/javascript"),
    source(projectId, "firmware/edge-node/src/main.cpp", "extern \"C\" void app_main() {}\n", "text/x-c++src"),
    source(projectId, "services/simulator/index.js", "process.stdout.write('synthetic simulator\\n');\n", "application/javascript"),
  ]);
}

function unicodeAndEmptyFile() {
  const projectId = "fixture-unicode-empty";
  const projectValue = project(projectId, { title: "Gruesse aus Koeln – 測試" });
  return inventory(projectValue, [
    source(projectId, "docs/Überblick-測試.md", "# Grüße\n\nKöln, Zürich und 東京.\n", "text/markdown"),
    source(projectId, "src/absichtlich-leer.cpp", "", "text/x-c++src"),
  ]);
}

function complexBoardAndPins() {
  const projectId = "fixture-board-pins";
  const boardConfiguration = {
    schema_version: 1,
    source: "synthetic_fixture",
    name: "Synthetic ESP32-S3 Carrier",
    base_board_profile_id: "board.synthetic.esp32-s3",
    account_board_id: "synthetic-board",
    account_board_version: 7,
    board_features: {
      display: { enabled: true, hardware: "ST7789", driver: "esp_lcd", connection: "spi2", pins: { cs: 10, dc: 11, mosi: 12, sclk: 13, rst: 14 } },
      environmental_sensor: { enabled: true, hardware: "BME280", driver: "i2c", connection: "i2c0", pins: { sda: 8, scl: 9 } },
      status_led: { enabled: true, hardware: "WS2812", driver: "rmt", connection: "gpio", pins: { data: 48 }, value: "1 pixel" },
    },
  };
  const projectValue = project(projectId, {
    title: "Komplexe Board- und Pin-Konfiguration",
    hardware_profile_id: "board.synthetic.esp32-s3",
    active_software_unit_id: "firmware-main",
    software_units: [{
      software_unit_id: "firmware-main",
      title: "Firmware Main",
      software_kind: "firmware",
      build_system: "platformio",
      source_root: "firmware/main",
      entrypoint: "src/main.cpp",
      hardware_profile_id: "board.synthetic.esp32-s3",
      build_config: {
        board: "esp32-s3-devkitc-1",
        framework: "espidf",
        board_configuration: boardConfiguration,
        component_hardware_features: {
          "display-panel": { schema_version: 2, rotation: 90, color_order: "rgb" },
          "environment-sensor": { schema_version: 1, interval_ms: 2500, address: "0x76" },
        },
      },
    }],
    view_manifest: {
      schema_version: 1,
      views: [{
        id: "hardware-configuration",
        payload: {
          schema_version: 3,
          bus_policy: { i2c0_hz: 400000, spi2_hz: 40000000 },
          components: [{
            component_id: "main-board",
            label: "Synthetic Main Board",
            abstract_type: "iot_device",
            board_configuration: boardConfiguration,
            inventory_device_id: "must-not-be-projected",
          }, {
            component_id: "display-panel",
            label: "Display",
            abstract_type: "display",
            connected_to: "main-board",
          }],
        },
      }],
    },
  });
  return inventory(projectValue, [
    source(projectId, "firmware/main/src/main.cpp", "#include \"gernetix_board_configuration.h\"\nextern \"C\" void app_main() {}\n", "text/x-c++src"),
  ]);
}

function gitLightHistory() {
  const projectId = "fixture-history";
  const projectValue = project(projectId, { title: "Git-Light Historie" });
  const v1Sources = [source(projectId, "src/main.cpp", "int value() { return 1; }\n", "text/x-c++src")];
  const v2Sources = [source(projectId, "src/main.cpp", "int value() { return 2; }\n", "text/x-c++src")];
  const v3Sources = [
    source(projectId, "README.md", "# Synthetic history\n", "text/markdown"),
    source(projectId, "src/main.cpp", "int value() { return 3; }\n", "text/x-c++src"),
  ];
  const currentSources = [
    source(projectId, "README.md", "# Synthetic history\n\nCurrent state.\n", "text/markdown"),
    source(projectId, "src/main.cpp", "int value() { return 4; }\n", "text/x-c++src"),
  ];
  return inventory(projectValue, currentSources, [
    version(projectValue, "history-v1", null, "2026-01-15T09:10:00.000Z", v1Sources),
    version(projectValue, "history-v2", "history-v1", "2026-01-15T09:20:00.000Z", v2Sources),
    version(projectValue, "history-v3", "history-v2", "2026-01-15T09:30:00.000Z", v3Sources),
  ]);
}

function buildArtifactReference() {
  const projectId = "fixture-artifact";
  const projectValue = project(projectId, { title: "Build-Artefaktreferenz" });
  const sources = [source(projectId, "src/main.cpp", "void synthetic_build() {}\n", "text/x-c++src")];
  return inventory(projectValue, sources, [version(
    projectValue,
    "artifact-v1",
    null,
    "2026-01-15T09:45:00.000Z",
    sources,
    {
      includes_binary: true,
      binary_artifacts: [{
        artifact_id: "artifact-synthetic-001",
        file_name: "synthetic-firmware.bin",
        sha256: "1234567890abcdef".repeat(4),
        size_bytes: 262144,
      }],
    },
  )]);
}

function blockingSources() {
  const projectId = "fixture-blocked-sources";
  const projectValue = project(projectId, { title: "Blockierende Quelldateien" });
  return inventory(projectValue, [
    source(projectId, ".env", "SYNTHETIC_API_TOKEN=not-a-real-token\n"),
    source(projectId, "build/synthetic-firmware.bin", "synthetic\0binary", "application/octet-stream"),
    source(projectId, "large/generated.txt", "x".repeat(1024 * 1024 + 1)),
    source(projectId, "legacy\\windows.cpp", "void legacy() {}\n", "text/x-c++src"),
    source(projectId, "src/hash-mismatch.cpp", "void mismatch() {}\n", "text/x-c++src", { content_sha256: "0".repeat(64) }),
  ]);
}

function blockingHistoryAndArtifact() {
  const projectId = "fixture-blocked-history";
  const projectValue = project(projectId, { title: "Blockierende Historie" });
  const sources = [source(projectId, "src/main.cpp", "void history_blocker() {}\n", "text/x-c++src")];
  return inventory(projectValue, sources, [
    version(projectValue, "broken-v1", "missing-parent", "not-a-timestamp", sources, {
      includes_binary: true,
      binary_artifacts: [],
    }),
    version(projectValue, "broken-v2", null, "2026-01-15T09:50:00.000Z", sources),
  ]);
}

const syntheticCases = Object.freeze([
  { id: "empty-project", inventory: emptyProject() },
  { id: "normal-esp32-project", inventory: normalEsp32Project() },
  { id: "multiple-software-units", inventory: multipleSoftwareUnits() },
  { id: "unicode-and-empty-file", inventory: unicodeAndEmptyFile() },
  { id: "complex-board-and-pins", inventory: complexBoardAndPins() },
  { id: "git-light-history", inventory: gitLightHistory() },
  { id: "build-artifact-reference", inventory: buildArtifactReference() },
  { id: "blocking-sources", inventory: blockingSources() },
  { id: "blocking-history-and-artifact", inventory: blockingHistoryAndArtifact() },
]);

module.exports = { syntheticCases };
