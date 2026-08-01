const test = require("node:test");
const assert = require("node:assert/strict");
const { completeBrowserFlashDefinitions } = require("../src/dev/browser-flash-manifest");

test("completes a partial ESP32 runner manifest without replacing known target addresses", () => {
  const definitions = completeBrowserFlashDefinitions([
    { name: "bootloader.bin", address: 0x0000 },
    { name: "partitions.bin", address: 0x8000 },
  ], [
    ["bootloader.bin", 0x1000],
    ["partitions.bin", 0x8000],
    ["boot_app0.bin", 0xe000],
    ["firmware.bin", 0x10000],
  ]);

  assert.deepEqual(definitions, [
    ["bootloader.bin", 0x0000],
    ["partitions.bin", 0x8000],
    ["boot_app0.bin", 0xe000],
    ["firmware.bin", 0x10000],
  ]);
});
