const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { getFirmwareBuildTarget, getFactoryFirmwareRelease } = require("../firmware-build-targets");

const basisRoot = path.resolve(__dirname, "..");
for (const flashSize of [4, 8, 16]) {
  for (const profile of ["full", "medium", "low"]) {
    test(`${profile.toUpperCase()} ${flashSize} MB partition layout is aligned and non-overlapping`, () => {
      const csvPath = path.join(basisRoot, `partitions_${profile}_${flashSize}mb.csv`);
      const partitions = parsePartitions(fs.readFileSync(csvPath, "utf8"));
      const byName = new Map(partitions.map((partition) => [partition.name, partition]));
      const apps = partitions.filter((partition) => partition.type === "app");
      assert.equal(byName.get("nvs").offset, 0x9000);
      apps.forEach((app) => assert.equal(app.offset % 0x10000, 0));
      assert.equal(apps.length, profile === "full" ? 2 : profile === "medium" ? 2 : 1);
      assert.equal(byName.has("ota_1"), profile === "full");
      assert.equal(byName.has("bootstrap"), profile === "medium");
      assert.equal(byName.has("otadata"), profile !== "low");
      const ordered = partitions.slice().sort((left, right) => left.offset - right.offset);
      for (let index = 1; index < ordered.length; index += 1) {
        assert.ok(ordered[index - 1].offset + ordered[index - 1].size <= ordered[index].offset, `${ordered[index - 1].name} ueberlappt ${ordered[index].name}`);
      }
      assert.ok(ordered.at(-1).offset + ordered.at(-1).size <= flashSize * 0x100000);
    });
  }
}

test("PlatformIO and sdkconfig select the 4 MB OTA partition table", () => {
  const platformio = fs.readFileSync(path.join(basisRoot, "platformio.ini"), "utf8");
  const sdkconfig = fs.readFileSync(path.join(basisRoot, "sdkconfig.esp32dev"), "utf8");

  assert.match(platformio, /board_build\.flash_size = 4MB/);
  assert.match(platformio, /board_build\.partitions = partitions_ota_4mb\.csv/);
  assert.match(sdkconfig, /CONFIG_PARTITION_TABLE_CUSTOM=y/);
  assert.match(sdkconfig, /CONFIG_PARTITION_TABLE_FILENAME="partitions_ota_4mb\.csv"/);
  assert.doesNotMatch(sdkconfig, /^CONFIG_PARTITION_TABLE_SINGLE_APP=y$/m);
});

test("PlatformIO provides an ESP32-S3 FULL target with the 16 MB partition table", () => {
  const platformio = fs.readFileSync(path.join(basisRoot, "platformio.ini"), "utf8");
  const sdkconfig = fs.readFileSync(path.join(basisRoot, "sdkconfig.esp32-s3-n16r8"), "utf8");
  assert.match(platformio, /\[env:esp32-s3-16mb-full\]/);
  assert.match(platformio, /board = 4d_systems_esp32s3_gen4_r8n16/);
  assert.match(platformio, /SDKCONFIG_DEFAULTS="sdkconfig\.esp32-s3-n16r8"/);
  assert.match(platformio, /board_build\.flash_size = 16MB/);
  assert.match(platformio, /board_upload\.flash_size = 16MB/);
  assert.match(platformio, /board_build\.partitions = partitions_full_16mb\.csv/);
  assert.match(platformio, /N16R8: 16 MB QIO flash plus 8 MB octal PSRAM/);
  assert.match(sdkconfig, /CONFIG_ESPTOOLPY_FLASHSIZE_16MB=y/);
  assert.match(sdkconfig, /CONFIG_SPIRAM=y/);
  assert.match(sdkconfig, /CONFIG_SPIRAM_MODE_OCT=y/);
  assert.match(sdkconfig, /CONFIG_SPIRAM_SPEED_80M=y/);
  assert.match(sdkconfig, /CONFIG_PARTITION_TABLE_FILENAME="partitions_full_16mb\.csv"/);
});

test("firmware build targets keep architecture, memory layout and releases together", () => {
  const s3 = getFirmwareBuildTarget("firmware_build_target.esp32_s3_opi_n16r8");
  assert.equal(s3.esp_idf_target, "esp32s3");
  assert.equal(s3.flash.size_mb, 16);
  assert.equal(s3.psram.size_mb, 8);
  assert.equal(s3.platformio_environment, "esp32-s3-16mb-full");
  assert.equal(getFactoryFirmwareRelease({ firmwareBuildTargetId: s3.firmware_build_target_id, basissoftwareProfile: "full" }).artifact_id,
    "firmware_artifact.esp32_s3_opi_n16r8.full.factory.latest");
  assert.equal(getFirmwareBuildTarget("firmware_build_target.esp32_c6_qspi_4mb").esp_idf_target, "esp32c6");
});

function parsePartitions(source) {
  return source.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [name, type, subtype, offset, size] = line.split(",").map((value) => value.trim());
      return { name, type, subtype, offset: Number(offset), size: Number(size) };
    });
}
