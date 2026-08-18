"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { configureEspIdfSdkconfigDefaults, configureExternalProjectSourceTree, materializePackagedEmbeddedAssets, normalizePackagedSourceManifest } = require("../src/modules/esp32-basissoftware-package");

test("uses the versioned 16 MB ESP-IDF defaults for generated S3 build environments", () => {
  const files = new Map([
    ["sdkconfig.esp32dev", {}],
    ["sdkconfig.esp32-s3-n16r8", {}],
  ]);
  const config = { framework: "espidf", flash_size_mb: 16 };

  configureEspIdfSdkconfigDefaults(files, config);

  assert.equal(
    config.platformio_options["board_build.cmake_extra_args"],
    '-DSDKCONFIG_DEFAULTS="sdkconfig.esp32-s3-n16r8"',
  );
});

test("preserves an explicitly selected ESP-IDF defaults file", () => {
  const files = new Map([["sdkconfig.esp32-s3-n16r8", {}]]);
  const config = {
    framework: "espidf",
    flash_size_mb: 16,
    platformio_options: {
      "board_build.cmake_extra_args": '-DSDKCONFIG_DEFAULTS="custom.defaults" -DCUSTOM=ON',
    },
  };

  configureEspIdfSdkconfigDefaults(files, config);

  assert.equal(
    config.platformio_options["board_build.cmake_extra_args"],
    '-DSDKCONFIG_DEFAULTS="custom.defaults" -DCUSTOM=ON',
  );
});

test("configures an external project source tree before CMake evaluates it", () => {
  const files = new Map([["src/CMakeLists.txt", {
    path: "src/CMakeLists.txt",
    content: [
      "set(GERNETIX_PROJECT_INCLUDE_DIRS)",
      "if(DEFINED GERNETIX_PROJECT_SOURCE_DIR)",
      "  list(APPEND GERNETIX_PROJECT_INCLUDE_DIRS ${GERNETIX_PROJECT_SOURCE_DIR}/include)",
      "endif()",
      "idf_component_register(INCLUDE_DIRS ${GERNETIX_PROJECT_INCLUDE_DIRS})",
    ].join("\n"),
  }]]);

  configureExternalProjectSourceTree(files);

  const cmake = files.get("src/CMakeLists.txt").content;
  assert.match(cmake, /set\(GERNETIX_PROJECT_SOURCE_DIR "\$\{CMAKE_CURRENT_LIST_DIR\}\/user_project"\)/);
  assert.ok(
    cmake.indexOf("set(GERNETIX_PROJECT_SOURCE_DIR") < cmake.indexOf("if(DEFINED GERNETIX_PROJECT_SOURCE_DIR)"),
    "the project source directory must exist before include and source discovery",
  );
});

test("keeps embedded project assets relative to the ESP-IDF component", () => {
  const manifest = normalizePackagedSourceManifest([
    "set(GERNETIX_PROJECT_EMBED_FILES",
    '  "${CMAKE_CURRENT_LIST_DIR}/assets/stories/prompt.pcm8"',
    ")",
  ].join("\n"));

  assert.match(manifest, /"user_project\/assets\/stories\/prompt\.pcm8"/);
  assert.doesNotMatch(manifest, /CMAKE_CURRENT_LIST_DIR/);
});

test("materializes embedded binary assets as regular assembly sources", () => {
  const files = new Map([
    ["src/user_project/sources.cmake", {
      path: "src/user_project/sources.cmake",
      content: [
        "set(GERNETIX_PROJECT_SOURCES)",
        "set(GERNETIX_PROJECT_EMBED_FILES",
        '  "user_project/assets/prompt.pcm8"',
        ")",
      ].join("\n"),
    }],
    ["src/user_project/assets/prompt.pcm8", {
      path: "src/user_project/assets/prompt.pcm8",
      content_base64: Buffer.from([0, 127, 255]).toString("base64"),
    }],
  ]);

  assert.equal(materializePackagedEmbeddedAssets(files), 1);
  assert.match(files.get("src/user_project/sources.cmake").content, /generated\/prompt\.pcm8\.S/);
  assert.doesNotMatch(files.get("src/user_project/sources.cmake").content, /EMBED_FILES\s*\n\s*"/);
  const assembly = files.get("src/user_project/generated/prompt.pcm8.S").content;
  assert.match(assembly, /_binary_prompt_pcm8_start/);
  assert.match(assembly, /\.byte 0x00, 0x7f, 0xff/);
});
