const assert = require("node:assert/strict");
const test = require("node:test");

const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../src/modules/esp32-basissoftware-package");
const { defaultCatalogSeed } = require("../../hardware-catalog/src/seed");
const { synchronizeBoardFeaturePins } = require("../../hardware-catalog/src/board-configuration");
const { createNexiCourseModel } = require("../../identity-server/src/dev/project-models/nexi-course");

test("loads the protected ESP32 basis and overlays only the project user main", () => {
  const basisFiles = loadEsp32BasissoftwareFiles();
  const files = composeEsp32BasissoftwarePackage({
    basisFiles,
    projectSources: [{
      path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      content: 'extern "C" void userMain() {}\nextern "C" void userTick() {}\n',
      content_type: "text/x-c++src",
    }],
    buildConfig: {
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
    },
  });

  assert.equal(files.some((file) => file.path === "src/main.cpp"), true);
  assert.equal(files.some((file) => file.path === "include/user/user_app.h"), true);
  assert.match(files.find((file) => file.path === "src/hooks/onProjectInit.cpp").content, /userMain\(\)/);
  assert.match(files.find((file) => file.path === "src/hooks/onProjectTick.cpp").content, /userTick\(\)/);
  assert.equal(files.some((file) => file.path === "include/gernetix_basissoftware_configuration.h"), true);
  assert.match(files.find((file) => file.path === "include/gernetix_basissoftware_configuration.h").content, /GERNETIX_MQTT_ENABLED 0/);
  assert.equal(files.some((file) => file.path === "src/functions/initWifi.cpp"), true);
  const wifiRuntime = files.find((file) => file.path === "src/functions/initWifi.cpp").content;
  assert.match(wifiRuntime, /configureAccessPointIpv4/);
  assert.match(wifiRuntime, /esp_netif_set_ip_info/);
  assert.match(wifiRuntime, /ESP_NETIF_REQUESTED_IP_ADDRESS/);
  assert.match(wifiRuntime, /GERNETIX_COMMUNICATION_DEVICE_ACCESS_POINT/);
  assert.equal(files.some((file) => file.path === "partitions_full_4mb.csv"), true);
  assert.equal(files.some((file) => file.path === "sdkconfig.esp32-s3-n16r8"), true);
  assert.equal(files.some((file) => file.path === "partitions_medium_8mb.csv"), true);
  assert.equal(files.some((file) => file.path === "dependencies.lock"), true);
  assert.equal(files.some((file) => file.path === "src/idf_component.yml"), true);
  assert.equal(files.some((file) => file.path === "lib/gernetix-runtime-core/src/runtime_core.cpp"), true);
  assert.equal(files.some((file) => file.path === "lib/gernetix-runtime-core/include/gernetix/runtime_core.h"), true);
  assert.equal(files.some((file) => file.path === "include/user_project/.gernetix-keep"), true);
  assert.match(files.find((file) => file.path === "src/CMakeLists.txt").content, /\.\.\/lib\/gernetix-runtime-core\/src\/runtime_core\.cpp/);
  assert.doesNotMatch(files.find((file) => file.path === "src/CMakeLists.txt").content, /\.\.\/\.\.\/\.\.\/firmware\/shared/);
  assert.equal(files.some((file) => file.path === "managed_components/espressif__mqtt/mqtt_client.c"), true);
  assert.equal(files.some((file) => file.path === "managed_components/espressif__mqtt/include/mqtt_client.h"), true);
  assert.equal(files.some((file) => file.path.startsWith("managed_components/espressif__mqtt/examples/")), false);
  assert.equal(files.some((file) => file.path.startsWith("managed_components/espressif__mqtt/docs/")), false);
  assert.ok(Buffer.byteLength(JSON.stringify(files)) < 10 * 1024 * 1024, "ESP32 build package must stay below the Build Server request limit");
  assert.match(files.find((file) => file.path === "src/user/user_app.cpp").content, /void userMain/);
  assert.equal(files.some((file) => file.path === "Komponenten/IoT-Device 1/src/user_main.cpp"), false);
  assert.equal(files.some((file) => file.path.startsWith(".vscode/")), false);
});

test("packages additional project C++ implementations behind the protected basis entrypoint", () => {
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [
      { path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: 'extern "C" void userMain() {}\nextern "C" void userTick() {}\n' },
      { path: "Komponenten/IoT-Device 1/src/game.cpp", content: "int gameScore() { return 7; }\n" },
      { path: "Komponenten/IoT-Device 1/include/game.h", content: "#pragma once\nint gameScore();\n" },
    ],
    buildConfig: { user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp" },
  });

  assert.equal(files.find((file) => file.path === "src/user_project/game.cpp").content, "int gameScore() { return 7; }\n");
  assert.equal(files.find((file) => file.path === "include/user_project/game.h").content, "#pragma once\nint gameScore();\n");
  assert.equal(files.some((file) => file.path === "include/user_project/.gernetix-keep"), false);
  assert.match(files.find((file) => file.path === "src/CMakeLists.txt").content, /GLOB_RECURSE GERNETIX_PACKAGED_PROJECT_SOURCES/);
  assert.match(files.find((file) => file.path === "src/CMakeLists.txt").content, /\.\.\/include\/user_project/);
});

test("packages the complete modular Nexi customer firmware behind the protected basis", () => {
  const model = createNexiCourseModel();
  const definition = model.createProject(
    (slug, title, area, summary, steps, options) => ({ slug, title, area, summary, steps, ...options }),
    (title, text, insight) => ({ title, text, insight }),
  );
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: model.createSources(),
    buildConfig: definition.build_config,
  });

  const paths = new Set(files.map((file) => file.path));
  assert.equal(paths.has("src/user/user_app.cpp"), true);
  assert.equal(paths.has("src/user_project/application_manager.cpp"), true);
  assert.equal(paths.has("src/user_project/audio_engine.cpp"), true);
  assert.equal(paths.has("src/user_project/voice_studio_application.cpp"), true);
  assert.equal(paths.has("include/user_project/nexi/application.h"), true);
  assert.equal(paths.has("include/user_project/nexi/privacy_gate.h"), true);
  assert.equal(paths.has("include/user_project/nexi/service_button_input.h"), true);
  assert.match(files.find((file) => file.path === "src/user/user_app.cpp").content, /nexi::ApplicationManager/);
  assert.match(files.find((file) => file.path === "src/CMakeLists.txt").content, /GERNETIX_PACKAGED_PROJECT_SOURCES/);
  assert.equal(files.some((file) => file.path.startsWith("Komponenten/")), false);
});

test("projects WLAN, MQTT topics and power states into the protected compiler header", () => {
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "void userMain() {}" }],
    buildConfig: {
      firmware_basis_id: "gernetix-runtime-basissoftware",
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      basissoftware_configuration: {
        wifi: { enabled: false, mode: "access_point" },
        mqtt: { enabled: true, broker_url: "mqtts://broker.example", publish_topics: ["devices/{device}/status"], subscriptions: ["devices/{device}/commands/#"], qos: 2 },
        power_manager: { enabled: true, default_state: "light_sleep", states: { light_sleep: { enabled: true, enter_after_seconds: 60, wake_sources: ["timer", "touch"] }, deep_sleep: { enabled: true, enter_after_seconds: 900, wake_sources: ["timer"] } } },
        communication: { managed_by_project: true, topology: "device_access_point", role: "host", transport: "http_stream", peer_software_unit_ids: ["display_receiver"], ota_available: false, observer_access: true, endpoint_port: 8080, endpoint_path: "/camera/stream", access_point_ipv4_address: "10.42.7.1", access_point_subnet_mask: "255.255.255.0", access_point_dhcp_start: "10.42.7.40", access_point_dhcp_end: "10.42.7.90" },
      },
    },
  });
  const header = files.find((file) => file.path === "include/gernetix_basissoftware_configuration.h").content;
  const platformio = files.find((file) => file.path === "platformio.ini").content;
  assert.match(header, /GERNETIX_WIFI_ENABLED 0/);
  assert.match(header, /GERNETIX_WIFI_MODE "access_point"/);
  assert.match(header, /GERNETIX_COMMUNICATION_TOPOLOGY "device_access_point"/);
  assert.match(header, /GERNETIX_COMMUNICATION_PEER_0 "display_receiver"/);
  assert.match(header, /GERNETIX_COMMUNICATION_OTA_AVAILABLE 0/);
  assert.match(header, /GERNETIX_ACCESS_POINT_IPV4_ADDRESS "10\.42\.7\.1"/);
  assert.match(header, /GERNETIX_ACCESS_POINT_DHCP_START "10\.42\.7\.40"/);
  assert.match(header, /GERNETIX_MQTT_PUBLISH_TOPIC_0 "devices\/\{device\}\/status"/);
  assert.match(header, /GERNETIX_MQTT_ENABLED 1/);
  assert.match(header, /GERNETIX_MQTT_SUBSCRIPTION_0 "devices\/\{device\}\/commands\/#"/);
  assert.match(header, /GERNETIX_POWER_STATE_LIGHT_SLEEP_ENTER_AFTER_SECONDS 60/);
  assert.match(header, /GERNETIX_POWER_STATE_LIGHT_SLEEP_WAKE_SOURCES "timer,touch"/);
  assert.match(platformio, /-include include\/gernetix_basissoftware_configuration\.h/);
});

test("selects profile and flash-specific build configuration", () => {
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "void userMain() {}" }],
    buildConfig: {
      firmware_basis_variant: "medium",
      flash_size_mb: 8,
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
    },
  });
  const platformio = files.find((file) => file.path === "platformio.ini").content;
  const sdkconfig = files.find((file) => file.path === "sdkconfig.esp32dev").content;
  assert.match(platformio, /board_build\.flash_size = 8MB/);
  assert.match(platformio, /board_build\.partitions = partitions_medium_8mb\.csv/);
  assert.match(platformio, /GERNETIX_BASISSOFTWARE_PROFILE_MEDIUM=1/);
  assert.match(sdkconfig, /CONFIG_ESPTOOLPY_FLASHSIZE_8MB=y/);
  assert.match(sdkconfig, /CONFIG_PARTITION_TABLE_FILENAME="partitions_medium_8mb\.csv"/);
});

test("forces the immutable project board snapshot into every compiler unit", () => {
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "void userMain() {}" }],
    buildConfig: {
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      board_configuration: {
        source: "account",
        name: "Mein Touchboard",
        base_board_profile_id: "hardware.processor_board.generic_esp32_s3_touch_display",
        account_board_id: "account_board-1",
        account_board_version: 3,
        board_features: {
          display: { enabled: true, driver: "st7789", connection: "spi", pins: { cs: 12, dc: 11 } },
        },
      },
    },
  });
  const header = files.find((file) => file.path === "include/gernetix_board_configuration.h").content;
  const platformio = files.find((file) => file.path === "platformio.ini").content;

  assert.match(platformio, /-include include\/gernetix_board_configuration\.h/);
  assert.match(header, /GERNETIX_ACCOUNT_BOARD_VERSION 3/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_DRIVER "st7789"/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS 12/);
});

test("rejects a user source that references a missing board snapshot before compilation", () => {
  assert.throws(() => composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [{
      path: "Komponenten/IoT-Device 2/src/user_main.cpp",
      content: '#include "gernetix_board_configuration.h"\nvoid userMain() {}',
    }],
    buildConfig: {
      user_source_path: "Komponenten/IoT-Device 2/src/user_main.cpp",
    },
  }), /Boardkonfiguration .* fehlt im Build-Snapshot/);
});

test("carries the Hardware Catalog display bus pins unchanged into the compiler header", () => {
  const catalogBoard = synchronizeBoardFeaturePins(defaultCatalogSeed().hardwareItems
    .find((item) => item.hardware_item_id === "hardware.processor_board.esp32_s3_es3c28p"));
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "void userMain() {}" }],
    buildConfig: {
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      board_configuration: {
        source: "catalog",
        base_board_profile_id: catalogBoard.hardware_item_id,
        board_features: catalogBoard.default_instance_configuration.board_features,
      },
    },
  });
  const header = files.find((file) => file.path === "include/gernetix_board_configuration.h").content;
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_CONNECTION "spi"/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_PIN_SCLK 12/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MOSI 11/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS 10/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_PIN_DC 46/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_PIN_BACKLIGHT 45/);
});

test("carries every Waveshare OV3660 signal from the catalog snapshot into the compiler header", () => {
  const catalogBoard = synchronizeBoardFeaturePins(defaultCatalogSeed().hardwareItems
    .find((item) => item.hardware_item_id === "hardware.processor_board.waveshare_esp32_s3_cam_ov3660"));
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "void userMain() {}" }],
    buildConfig: {
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      board_configuration: {
        source: "catalog",
        base_board_profile_id: catalogBoard.hardware_item_id,
        board_features: catalogBoard.default_instance_configuration.board_features,
      },
    },
  });
  const header = files.find((file) => file.path === "include/gernetix_board_configuration.h").content;
  for (const [signal, pin] of Object.entries(catalogBoard.default_instance_configuration.board_features.camera.pins)) {
    assert.match(header, new RegExp(`GERNETIX_BOARD_FEATURE_CAMERA_PIN_${signal.toUpperCase()} ${pin}`));
  }
  assert.match(header, /GERNETIX_BOARD_FEATURE_CAMERA_POWER_HARDWARE "CH32V003F4U6"/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_ADDRESS 36/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_OUTPUT 6/);
});

test("projects the Waveshare audio board buses without treating optional display and camera as installed", () => {
  const catalogBoard = synchronizeBoardFeaturePins(defaultCatalogSeed().hardwareItems
    .find((item) => item.hardware_item_id === "hardware.processor_board.waveshare_esp32_s3_audio_board"));
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: loadEsp32BasissoftwareFiles(),
    projectSources: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "void userMain() {}" }],
    buildConfig: {
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      board_configuration: {
        source: "catalog",
        base_board_profile_id: catalogBoard.hardware_item_id,
        board_features: catalogBoard.default_instance_configuration.board_features,
      },
    },
  });
  const header = files.find((file) => file.path === "include/gernetix_board_configuration.h").content;
  assert.match(header, /GERNETIX_BOARD_FEATURE_MICROPHONE_DRIVER "es7210"/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_MICROPHONE_PIN_DATA_IN 15/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_SPEAKER_DRIVER "es8311"/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_SPEAKER_PIN_DATA_OUT 16/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_RGB_LED_PIN_DATA 38/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_STORAGE_PIN_SCLK 40/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_DISPLAY_ENABLED 0/);
  assert.match(header, /GERNETIX_BOARD_FEATURE_CAMERA_ENABLED 0/);
});

test("copies separated project user headers into the protected build package", () => {
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: [],
    projectSources: [
      { path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: '#include "user_project/view/start_screen.h"', content_type: "text/x-c++src" },
      { path: "Komponenten/IoT-Device 1/include/view/start_screen.h", content: "class StartScreen {};", content_type: "text/x-c++hdr" },
      { path: "Komponenten/IoT-Device 1/src/games/snake.h", content: "namespace snake {}", content_type: "text/x-c++hdr" },
    ],
    buildConfig: { user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: "src/user/user_app.cpp" },
  });

  assert.equal(files.find((file) => file.path === "include/user_project/view/start_screen.h").source_project_path, "Komponenten/IoT-Device 1/include/view/start_screen.h");
  assert.equal(files.some((file) => file.path === "include/user_project/games/snake.h"), true);
});

test("copies a project-specific ESP-IDF dependency manifest only into that build package", () => {
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: [],
    projectSources: [
      { path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "void userMain() {}", content_type: "text/x-c++src" },
      { path: "Komponenten/IoT-Device 1/src/idf_component.yml", content: "dependencies:\n  espressif/esp32-camera: \"2.1.7\"\n", content_type: "text/plain" },
    ],
    buildConfig: { user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: "src/user/user_app.cpp" },
  });

  assert.equal(files.find((file) => file.path === "src/idf_component.yml").source_project_path, "Komponenten/IoT-Device 1/src/idf_component.yml");
  assert.match(files.find((file) => file.path === "src/idf_component.yml").content, /esp32-camera/);
});

test("camera-display build slice links the ESP-IDF I2C and SPI drivers", () => {
  const cmake = loadEsp32BasissoftwareFiles()
    .find((file) => file.path === "src/CMakeLists.txt").content;
  assert.match(cmake, /GERNETIX_CAMERA_DISPLAY_SLICE[\s\S]*esp_driver_i2c[\s\S]*esp_driver_spi/);
});
