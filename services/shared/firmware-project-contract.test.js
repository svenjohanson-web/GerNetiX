"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createFirmwareBuildPackageContract,
  firmwareBuildPackageProblems,
  firmwareSoftwareUnitProblems,
} = require("./firmware-project-contract");

const unit = {
  software_unit_id: "camera",
  software_kind: "embedded_firmware",
  build_system: "platformio",
  source_root: "Komponenten/IoT-Device 1",
  entrypoint: "src/user_main.cpp",
  build_config: { platform: "espressif32", board: "esp32-s3-devkitc-1", environment: "camera", user_source_path: "src/user_main.cpp", user_target_path: "src/user/user_app.cpp", firmware_basis_id: "gernetix-runtime-basissoftware" },
};

test("accepts exactly one canonical component-owned firmware layout", () => {
  assert.deepEqual(firmwareSoftwareUnitProblems(unit, [
    "Komponenten/IoT-Device 1/src/user_main.cpp",
    "Komponenten/IoT-Device 1/include/camera_state.h",
  ], { requireEntrypointSource: true }), []);
});

test("rejects mismatched entrypoints and template headers below src", () => {
  const broken = { ...unit, entrypoint: "src/main.cpp" };
  const problems = firmwareSoftwareUnitProblems(broken, [
    "Komponenten/IoT-Device 1/src/main.cpp",
    "Komponenten/IoT-Device 1/src/camera_state.h",
  ], { requireEntrypointSource: true });
  assert.equal(problems.some((item) => item.includes("user_source_path")), true);
  assert.equal(problems.some((item) => item.includes("Header muss unter include")), true);
});

test("build package contract proves the selected target and every required input", () => {
  const files = { "platformio.ini": "[env:camera]", "build-job.json": "{}", "src/user/user_app.cpp": "void userMain() {}" };
  const contract = createFirmwareBuildPackageContract({ softwareUnit: unit, buildConfig: unit.build_config, packageFiles: Object.keys(files) });
  assert.deepEqual(firmwareBuildPackageProblems(contract, files), []);
  assert.equal(firmwareBuildPackageProblems(contract, { ...files, "src/user/user_app.cpp": undefined, extra: "" }).length > 0, true);
});
