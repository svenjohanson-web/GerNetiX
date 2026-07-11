const assert = require("node:assert/strict");
const test = require("node:test");

const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../src/modules/esp32-basissoftware-package");

test("loads the protected ESP32 basis and overlays only the project user main", () => {
  const basisFiles = loadEsp32BasissoftwareFiles();
  const files = composeEsp32BasissoftwarePackage({
    basisFiles,
    projectSources: [{
      path: "Komponenten/ESP32/src/user_main.cpp",
      content: 'extern "C" void userMain() {}\nextern "C" void userTick() {}\n',
      content_type: "text/x-c++src",
    }],
    buildConfig: {
      user_source_path: "Komponenten/ESP32/src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
    },
  });

  assert.equal(files.some((file) => file.path === "src/main.cpp"), true);
  assert.equal(files.some((file) => file.path === "src/functions/initWifi.cpp"), true);
  assert.equal(files.some((file) => file.path === "partitions_ota_4mb.csv"), true);
  assert.equal(files.some((file) => file.path === "dependencies.lock"), true);
  assert.equal(files.some((file) => file.path === "src/idf_component.yml"), true);
  assert.match(files.find((file) => file.path === "src/user/user_app.cpp").content, /void userMain/);
  assert.equal(files.some((file) => file.path === "Komponenten/ESP32/src/user_main.cpp"), false);
  assert.equal(files.some((file) => file.path.startsWith(".vscode/")), false);
});
