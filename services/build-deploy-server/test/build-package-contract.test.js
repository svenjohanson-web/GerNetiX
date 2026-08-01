"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { BuildPackageStore } = require("../src/modules/build-package-store");

test("build worker rejects a contracted package whose selected entrypoint was not transferred", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-package-contract-"));
  const store = new BuildPackageStore({ tempDir });
  const files = { "platformio.ini": "[env:test]", "build-job.json": "{}", "src/wrong.cpp": "void setup() {}" };
  const contract = {
    kind: "gernetix_firmware_build_package",
    schema_version: 1,
    software_unit_id: "firmware",
    source_root: "Komponenten/IoT-Device 1",
    project_entrypoint: "src/main.cpp",
    package_entrypoint: "src/main.cpp",
    build_system: "platformio",
    platform: "espressif32",
    board: "esp32dev",
    environment: "esp32dev",
    required_files: ["platformio.ini", "build-job.json"],
    package_file_count: Object.keys(files).length,
  };

  await assert.rejects(
    store.materialize({ job_id: "contract-mismatch", software_unit_id: "firmware", build_package: { contract, files } }),
    (error) => error.code === "invalid_firmware_build_package_contract" && /Paket-Einstieg fehlt/.test(error.message),
  );
});
