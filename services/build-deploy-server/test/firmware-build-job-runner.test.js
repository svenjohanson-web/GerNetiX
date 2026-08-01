"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  FirmwareBuildJobRunner,
  createPlatformioEnv,
  findPlatformioArtifacts,
  readPlatformioFlashManifest,
  spawnAndCapture,
} = require("../src/modules/firmware-build-job-runner");

test("aborting a build terminates the compiler process group", async () => {
  const controller = new AbortController();
  const running = spawnAndCapture(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 25);

  await assert.rejects(running, (error) => error.code === "build_cancelled");
});

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

test("uses the generated ESP32 partition table as the authoritative firmware address", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-partition-address-"));
  const partitionFile = path.join(root, "partitions.bin");
  const partitionTable = Buffer.alloc(32, 0xff);
  partitionTable.writeUInt16LE(0x50aa, 0);
  partitionTable[2] = 0x00;
  partitionTable[3] = 0x10;
  partitionTable.writeUInt32LE(0x20000, 4);
  partitionTable.writeUInt32LE(0x600000, 8);
  await fs.writeFile(partitionFile, partitionTable);
  await fs.writeFile(path.join(root, "flash_args"), [
    "0x0000 bootloader.bin",
    "0x8000 partitions.bin",
    "0x10000 firmware.bin",
  ].join("\n"));

  const manifest = await readPlatformioFlashManifest(root, {
    "bootloader.bin": path.join(root, "bootloader.bin"),
    "partitions.bin": partitionFile,
    "firmware.bin": path.join(root, "firmware.bin"),
  });

  assert.deepEqual(manifest, [
    { name: "bootloader.bin", address: 0x0000 },
    { name: "partitions.bin", address: 0x8000 },
    { name: "firmware.bin", address: 0x20000 },
  ]);
});

test("collects nested ESP-IDF bootloader and partition artifacts as one browser flash package", async () => {
  const buildDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-nested-flash-package-"));
  const root = path.join(buildDir, "esp32s3");
  await fs.mkdir(path.join(root, "bootloader"), { recursive: true });
  await fs.mkdir(path.join(root, "partition_table"), { recursive: true });
  await fs.writeFile(path.join(root, "firmware.elf"), "elf");
  await fs.writeFile(path.join(root, "firmware.bin"), "firmware");
  await fs.writeFile(path.join(root, "bootloader", "bootloader.bin"), "bootloader");
  await fs.writeFile(path.join(root, "partition_table", "partition-table.bin"), "partitions");
  await fs.writeFile(path.join(root, "flash_args"), [
    "0x0000 bootloader/bootloader.bin",
    "0x8000 partition_table/partition-table.bin",
    "0x10000 firmware.bin",
  ].join("\n"));

  const result = await findPlatformioArtifacts(buildDir, { requireBrowserFlashPackage: true });

  assert.equal(result.artifacts["bootloader.bin"], path.join(root, "bootloader", "bootloader.bin"));
  assert.equal(result.artifacts["partitions.bin"], path.join(root, "partition_table", "partition-table.bin"));
  assert.deepEqual(result.flashManifest, [
    { name: "bootloader.bin", address: 0x0000 },
    { name: "partitions.bin", address: 0x8000 },
    { name: "firmware.bin", address: 0x10000 },
  ]);
});

test("rejects a browser USB build before success when its flash package is incomplete", async () => {
  const buildDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-incomplete-flash-package-"));
  const root = path.join(buildDir, "esp32s3");
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "firmware.elf"), "elf");
  await fs.writeFile(path.join(root, "firmware.bin"), "firmware");

  await assert.rejects(
    findPlatformioArtifacts(buildDir, { requireBrowserFlashPackage: true }),
    (error) => error.code === "incomplete_usb_flash_package",
  );
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

  const cameraBuildDir = path.join(cacheRoot, "project--camera--default", "build-jobs", "job-1");
  const displayBuildDir = path.join(cacheRoot, "project--display--default", "build-jobs", "job-2");
  const cameraEnv = createPlatformioEnv("/platformio", cameraWorkspace, cameraBuildDir);
  const displayEnv = createPlatformioEnv("/platformio", displayWorkspace, displayBuildDir);

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
  assert.equal(cameraEnv.PLATFORMIO_BUILD_DIR, cameraBuildDir);
  assert.equal(displayEnv.PLATFORMIO_BUILD_DIR, displayBuildDir);
  assert.notEqual(cameraEnv.PLATFORMIO_BUILD_DIR, displayEnv.PLATFORMIO_BUILD_DIR);
  assert.equal(
    cameraEnv.PLATFORMIO_BUILD_CACHE_DIR,
    path.join(cacheRoot, "project--camera--default", "platformio-object-cache"),
  );
});

test("a corrupted ESP-IDF component cache is repaired and retried exactly once", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-idf-retry-"));
  const packageDir = path.join(root, "workspace");
  const buildDir = path.join(root, "build-jobs", "retry-job");
  await fs.mkdir(path.join(root, "idf-component-cache", "broken"), { recursive: true });
  await fs.mkdir(path.join(packageDir, "managed_components", "broken"), { recursive: true });
  await fs.writeFile(path.join(packageDir, "dependencies.lock"), "broken");
  await fs.writeFile(path.join(packageDir, "run"), `
    const fs = require("node:fs");
    if (!fs.existsSync("retry.marker")) {
      fs.writeFileSync("retry.marker", "first");
      console.error('ERROR: The downloaded component "espressif/mqtt" is corrupted.');
      process.exit(1);
    }
    const path = require("node:path");
    const output = path.join(process.env.PLATFORMIO_BUILD_DIR, "test");
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, "firmware.bin"), "firmware");
    fs.writeFileSync(path.join(output, "firmware.elf"), "elf");
    console.log("retry succeeded");
  `);
  const progress = [];
  const runner = new FirmwareBuildJobRunner({
    runner: "platformio",
    platformioCommand: process.execPath,
  });

  const result = await runner.run({ mode: "build" }, packageDir, {
    buildDir,
    onProgress: (line) => progress.push(line),
  });

  assert.equal(result.status, "succeeded");
  assert.equal(await fs.readFile(path.join(packageDir, "retry.marker"), "utf8"), "first");
  assert.equal(await fs.access(path.join(root, "idf-component-cache")).then(() => true).catch(() => false), false);
  assert.equal(await fs.access(path.join(packageDir, "managed_components")).then(() => true).catch(() => false), false);
  assert.equal(progress.filter((line) => line.includes("versucht den Build einmal erneut")).length, 1);
  assert.match(await fs.readFile(path.join(buildDir, "build.log"), "utf8"), /retry succeeded/);
});
