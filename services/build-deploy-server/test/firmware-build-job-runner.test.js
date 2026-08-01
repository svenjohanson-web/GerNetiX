"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  createPlatformioEnv,
  readPlatformioFlashManifest,
} = require("../src/modules/firmware-build-job-runner");

test("reads target-specific PlatformIO flash offsets instead of assuming classic ESP32 addresses", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-flash-args-"));
  await fs.writeFile(path.join(root, "flash_args"), [
    "--flash_mode dio",
    "0x0000 bootloader.bin",
    "0x8000 partitions.bin",
    "0xe000 boot_app0.bin",
    "0x10000 firmware.bin",
  ].join("\n"));

  const manifest = await readPlatformioFlashManifest(root, {
    "bootloader.bin": "/build/bootloader.bin",
    "partitions.bin": "/build/partitions.bin",
    "boot_app0.bin": "/build/boot_app0.bin",
    "firmware.bin": "/build/firmware.bin",
  });

  assert.deepEqual(manifest, [
    { name: "bootloader.bin", address: 0x0000 },
    { name: "partitions.bin", address: 0x8000 },
    { name: "boot_app0.bin", address: 0xe000 },
    { name: "firmware.bin", address: 0x10000 },
  ]);
});

test("ignores unknown files from PlatformIO flash arguments", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-flash-args-"));
  await fs.writeFile(path.join(root, "flash_args"), "0x0000 bootloader.bin 0x20000 secrets.bin\n");

  assert.deepEqual(await readPlatformioFlashManifest(root, {
    "bootloader.bin": "/build/bootloader.bin",
  }), [{ name: "bootloader.bin", address: 0x0000 }]);
});

test("ESP-IDF component caches are isolated per software target workspace", () => {
  const cacheRoot = path.join(path.sep, "runtime", "incremental-build-cache");
  const cameraWorkspace = path.join(cacheRoot, "project--camera--default", "workspace");
  const displayWorkspace = path.join(cacheRoot, "project--display--default", "workspace");

  const cameraEnv = createPlatformioEnv("/platformio", cameraWorkspace);
  const displayEnv = createPlatformioEnv("/platformio", displayWorkspace);

  assert.equal(cameraEnv.PLATFORMIO_CORE_DIR, "/platformio");
  assert.equal(
    cameraEnv.IDF_COMPONENT_CACHE_PATH,
    path.join(cacheRoot, "project--camera--default", "idf-component-cache"),
  );
  assert.equal(
    displayEnv.IDF_COMPONENT_CACHE_PATH,
    path.join(cacheRoot, "project--display--default", "idf-component-cache"),
  );
  assert.notEqual(cameraEnv.IDF_COMPONENT_CACHE_PATH, displayEnv.IDF_COMPONENT_CACHE_PATH);
});
