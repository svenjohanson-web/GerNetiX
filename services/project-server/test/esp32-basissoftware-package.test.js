const assert = require("node:assert/strict");
const test = require("node:test");

const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../src/modules/esp32-basissoftware-package");

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
  assert.equal(files.some((file) => file.path === "src/functions/initWifi.cpp"), true);
  assert.equal(files.some((file) => file.path === "partitions_full_4mb.csv"), true);
  assert.equal(files.some((file) => file.path === "partitions_medium_8mb.csv"), true);
  assert.equal(files.some((file) => file.path === "dependencies.lock"), true);
  assert.equal(files.some((file) => file.path === "src/idf_component.yml"), true);
  assert.equal(files.some((file) => file.path === "lib/gernetix-runtime-core/src/runtime_core.cpp"), true);
  assert.equal(files.some((file) => file.path === "lib/gernetix-runtime-core/include/gernetix/runtime_core.h"), true);
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

test("copies separated project user headers into the protected build package", () => {
  const files = composeEsp32BasissoftwarePackage({
    basisFiles: [],
    projectSources: [
      { path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: '#include "user_project/view/start_screen.h"', content_type: "text/x-c++src" },
      { path: "Komponenten/IoT-Device 1/src/view/start_screen.h", content: "class StartScreen {};", content_type: "text/x-c++hdr" },
      { path: "Komponenten/IoT-Device 1/src/games/snake.h", content: "namespace snake {}", content_type: "text/x-c++hdr" },
    ],
    buildConfig: { user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: "src/user/user_app.cpp" },
  });

  assert.equal(files.find((file) => file.path === "include/user_project/view/start_screen.h").source_project_path, "Komponenten/IoT-Device 1/src/view/start_screen.h");
  assert.equal(files.some((file) => file.path === "include/user_project/games/snake.h"), true);
});
