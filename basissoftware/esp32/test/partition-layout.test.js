const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const basisRoot = path.resolve(__dirname, "..");
const csvPath = path.join(basisRoot, "partitions_ota_4mb.csv");

test("4 MB partition layout provides two aligned OTA slots without overlap", () => {
  const partitions = parsePartitions(fs.readFileSync(csvPath, "utf8"));
  const byName = new Map(partitions.map((partition) => [partition.name, partition]));

  assert.equal(byName.get("otadata").size, 0x2000);
  assert.equal(byName.get("nvs").offset, 0x9000);
  assert.equal(byName.get("nvs").size, 0x6000);
  assert.equal(byName.get("otadata").offset, 0xF000);
  assert.equal(byName.get("ota_0").size, 0x170000);
  assert.equal(byName.get("ota_1").size, 0x170000);
  assert.equal(byName.get("ota_0").offset % 0x10000, 0);
  assert.equal(byName.get("ota_1").offset % 0x10000, 0);

  const ordered = partitions.slice().sort((left, right) => left.offset - right.offset);
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(ordered[index - 1].offset + ordered[index - 1].size <= ordered[index].offset, `${ordered[index - 1].name} ueberlappt ${ordered[index].name}`);
  }
  assert.equal(ordered.at(-1).offset + ordered.at(-1).size, 0x400000);
});

test("PlatformIO and sdkconfig select the 4 MB OTA partition table", () => {
  const platformio = fs.readFileSync(path.join(basisRoot, "platformio.ini"), "utf8");
  const sdkconfig = fs.readFileSync(path.join(basisRoot, "sdkconfig.esp32dev"), "utf8");

  assert.match(platformio, /board_build\.flash_size = 4MB/);
  assert.match(platformio, /board_build\.partitions = partitions_ota_4mb\.csv/);
  assert.match(sdkconfig, /CONFIG_PARTITION_TABLE_CUSTOM=y/);
  assert.match(sdkconfig, /CONFIG_PARTITION_TABLE_FILENAME="partitions_ota_4mb\.csv"/);
  assert.doesNotMatch(sdkconfig, /^CONFIG_PARTITION_TABLE_SINGLE_APP=y$/m);
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
