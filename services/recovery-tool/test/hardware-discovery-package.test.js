const assert = require("node:assert/strict");
const test = require("node:test");
const { createDiscoveryBuildPackage } = require("../src/services/hardware-discovery-package");

test("discovery package creates passive ESP32 firmware without active pin operations", () => {
  const request = createDiscoveryBuildPackage({
    recovery_session_id: "hardware_lab_1",
    account_id: "acct-1",
    updated_at: "2026-08-04T12:00:00.000Z",
    candidate_profile: { source_evidence: [{ source_url: "https://example.com/board" }] },
    ai_analysis: { profile: {
      board_name: "Example S3", processor_family: "esp32", mcu_variant: "ESP32-S3",
      platformio: { platform: "espressif32", board: "esp32-s3-devkitc-1", environment: "example_s3", build_flags: ["-DBOARD_HAS_PSRAM", "-include unsafe.h"] },
      discovery_expectations: { passive_checks: ["flash", "psram"] },
    } },
  });
  assert.equal(request.mode, "build");
  assert.match(request.build_package.files["platformio.ini"], /board = esp32-s3-devkitc-1/);
  assert.match(request.build_package.files["platformio.ini"], /-DBOARD_HAS_PSRAM/);
  assert.doesNotMatch(request.build_package.files["platformio.ini"], /unsafe/);
  assert.match(request.build_package.files["src/main.cpp"], /active_pin_tests_executed/);
  assert.doesNotMatch(request.build_package.files["src/main.cpp"], /pinMode|digitalWrite|Wire\.begin/);
  assert.equal(request.manifest.active_pin_tests_enabled, false);
});

test("discovery package uses a marked generic compiler target when sources do not name PlatformIO", () => {
  const request = createDiscoveryBuildPackage({
    recovery_session_id: "hardware_lab_2",
    account_id: "acct-1",
    updated_at: "2026-08-04T12:00:00.000Z",
    candidate_profile: { source_evidence: [] },
    ai_analysis: { profile: {
      board_name: "Unknown S3", processor_family: "esp32", mcu_variant: "ESP32-S3", module_name: "ESP32-S3R8",
      platformio: { platform: null, board: null, environment: null, build_flags: [] },
      discovery_expectations: { passive_checks: ["chip"] },
    } },
  });
  assert.match(request.build_package.files["platformio.ini"], /board = esp32-s3-devkitc-1/);
  assert.equal(request.manifest.compiler_profile_source, "generic_chip_family_bootstrap");
});
