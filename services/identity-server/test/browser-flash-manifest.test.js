const test = require("node:test");
const assert = require("node:assert/strict");
const { completeBrowserFlashDefinitions, esp32FirmwareAddress, usesGerNetixOtaAppLayout } = require("../src/dev/browser-flash-manifest");

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

test("uses the first real app partition of the GerNetiX basissoftware as firmware fallback", () => {
  assert.equal(esp32FirmwareAddress({
    firmware_basis_id: "gernetix-runtime-basissoftware",
    firmware_basis_variant: "full",
  }), 0x20000);
  assert.equal(esp32FirmwareAddress({
    firmware_basis_id: "gernetix-runtime-basissoftware",
    firmware_basis_variant: "medium",
  }), 0x20000);
  assert.equal(esp32FirmwareAddress({
    firmware_basis_id: "gernetix-runtime-basissoftware",
    firmware_basis_variant: "low",
  }), 0x10000);
  assert.equal(esp32FirmwareAddress({ framework: "espidf" }), 0x10000);
});

test("overrides a stale runner firmware address for the GerNetiX OTA partition layout", () => {
  const buildConfig = {
    firmware_basis_id: "gernetix-runtime-basissoftware",
    firmware_basis_variant: "full",
  };
  const definitions = completeBrowserFlashDefinitions([
    { name: "bootloader.bin", address: 0x0000 },
    { name: "partitions.bin", address: 0x8000 },
    { name: "firmware.bin", address: 0x10000 },
  ], [
    ["bootloader.bin", 0x0000],
    ["partitions.bin", 0x8000],
    ["firmware.bin", esp32FirmwareAddress(buildConfig)],
  ], {
    authoritativeFallbackNames: usesGerNetixOtaAppLayout(buildConfig) ? ["firmware.bin"] : [],
  });

  assert.deepEqual(definitions, [
    ["bootloader.bin", 0x0000],
    ["partitions.bin", 0x8000],
    ["firmware.bin", 0x20000],
  ]);
});
