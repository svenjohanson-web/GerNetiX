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
  assert.equal(files.some((file) => file.path === "partitions_ota_4mb.csv"), true);
  assert.equal(files.some((file) => file.path === "dependencies.lock"), true);
  assert.equal(files.some((file) => file.path === "src/idf_component.yml"), true);
  assert.equal(files.some((file) => file.path === "managed_components/espressif__mqtt/mqtt_client.c"), true);
  assert.equal(files.some((file) => file.path === "managed_components/espressif__mqtt/include/mqtt_client.h"), true);
  assert.equal(files.some((file) => file.path.startsWith("managed_components/espressif__mqtt/examples/")), false);
  assert.equal(files.some((file) => file.path.startsWith("managed_components/espressif__mqtt/docs/")), false);
  assert.ok(Buffer.byteLength(JSON.stringify(files)) < 10 * 1024 * 1024, "ESP32 build package must stay below the Build Server request limit");
  assert.match(files.find((file) => file.path === "src/user/user_app.cpp").content, /void userMain/);
  assert.equal(files.some((file) => file.path === "Komponenten/IoT-Device 1/src/user_main.cpp"), false);
  assert.equal(files.some((file) => file.path.startsWith(".vscode/")), false);
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
