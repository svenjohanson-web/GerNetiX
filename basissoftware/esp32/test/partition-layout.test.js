const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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

function parsePartitions(source) {
  return source.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [name, type, subtype, offset, size] = line.split(",").map((value) => value.trim());
      return { name, type, subtype, offset: Number(offset), size: Number(size) };
    });
}
