const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const batch = fs.readFileSync(path.join(root, "build-all-factory-firmware.bat"), "utf8");
const builder = fs.readFileSync(path.join(root, "build-factory-firmware-releases.js"), "utf8");

test("Factory release batch builds every explicit platform target and merges flash files", () => {
  assert.match(batch, /build-factory-firmware-releases\.js/);
  for (const environment of ["esp32dev", "esp32dev-medium", "esp32dev-low", "esp32-s3-16mb-full", "esp32-c6-4mb-full"]) {
    assert.match(builder, new RegExp(`environment: "${environment}"`));
  }
  assert.match(builder, /flasher_args\.json/);
  assert.match(builder, /flashArgs\.flash_files/);
  assert.match(builder, /merge_bin/);
});
