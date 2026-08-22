"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { configureDirectEnvironment, createBuildPackageFiles, loadBuildManifest, normalizeUploadPort, resolveBuildCacheRoot, resolvePlatformioCoreDir, selectTargets, validatePackage } = require("./build-forgejo-project");

test("accepts one worker-style PlatformIO build package", () => {
  assert.doesNotThrow(() => validatePackage({ id: "camera_sender" }, {
    "platformio.ini": "[env:camera]\nplatform = espressif32\n",
    "src/main.cpp": "void app_main() {}\n",
  }));
});

test("allows a short external cache root for Windows toolchain path limits", () => {
  const repositoryRoot = path.resolve("deep", "forgejo", "checkout", "nexi");
  const configured = path.resolve(".runtime", "nexi-build");
  assert.equal(resolveBuildCacheRoot(repositoryRoot, { cliValue: configured }), configured);
  assert.equal(resolveBuildCacheRoot(repositoryRoot, { envValue: configured }), configured);
  if (process.platform === "win32") {
    const repositoryName = path.basename(repositoryRoot).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 16) || "nexi";
    const driveRoot = path.parse(repositoryRoot).root;
    assert.equal(resolveBuildCacheRoot(repositoryRoot), path.join(driveRoot, "g", "gernetix-build", repositoryName));
  } else {
    assert.equal(resolveBuildCacheRoot(repositoryRoot), path.join(repositoryRoot, ".gernetix-build"));
  }
});

test("reuses the existing PlatformIO tool cache independently from the short build cache", () => {
  const buildCache = path.resolve("short", "build-cache");
  const configuredCore = path.resolve("shared", "platformio-core");
  assert.equal(resolvePlatformioCoreDir(buildCache, { envValue: configuredCore }), configuredCore);
});

test("rejects historical source paths outside the materialized worker package", () => {
  assert.throws(() => validatePackage({ id: "oled" }, {
    "platformio.ini": "[platformio]\nsrc_dir = ../../../../../basissoftware/esp8266/src\n",
    "lib/game.cpp": "// game\n",
  }), /alten externen Quellpfad/);
});

test("requires an explicit safe upload port and one target for multi-device flashing", () => {
  assert.equal(normalizeUploadPort("com5", "win32"), "COM5");
  assert.throws(() => normalizeUploadPort("COM5 & erase", "win32"), /gueltiger COM-Port/);
  assert.equal(normalizeUploadPort("/dev/cu.usbmodem1101", "darwin"), "/dev/cu.usbmodem1101");
  assert.throws(() => normalizeUploadPort("/dev/../disk0", "darwin"), /gueltiger serieller Device-Pfad/);
  const targets = [{ id: "camera_sender" }, { id: "display_receiver" }];
  assert.throws(() => selectTargets(targets, "", true), /mehrere Flashziele/);
  assert.deepEqual(selectTargets(targets, "display_receiver", true), [{ id: "display_receiver" }]);
});

test("selects one declared PlatformIO environment for a direct worker target", () => {
  const files = {
    "platformio.ini": Buffer.from([
      "[platformio]",
      "default_envs = esp32dev",
      "",
      "[env:esp32dev]",
      "platform = espressif32",
      "",
      "[env:nanoatmega328]",
      "platform = atmelavr",
      "",
    ].join("\n")),
  };
  configureDirectEnvironment(files, { id: "nano_old", environment: "nanoatmega328" });
  assert.match(String(files["platformio.ini"]), /default_envs = nanoatmega328/);
  assert.throws(
    () => configureDirectEnvironment(files, { id: "missing", environment: "nanoatmega328new" }),
    /fehlende PlatformIO-Umgebung/,
  );
});

test("isolates a direct Arduino target below its component source root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-direct-target-"));
  await fs.mkdir(path.join(root, "Komponenten", "Arduino", "src"), { recursive: true });
  await fs.mkdir(path.join(root, "Komponenten", "ESP32", "src"), { recursive: true });
  await fs.writeFile(path.join(root, "Komponenten", "Arduino", "platformio.ini"), "[env:nanoatmega328]\nplatform = atmelavr\n");
  await fs.writeFile(path.join(root, "Komponenten", "Arduino", "src", "main.cpp"), "void setup() {}\nvoid loop() {}\n");
  await fs.writeFile(path.join(root, "Komponenten", "Arduino", "src", "prompt.pcm8"), Buffer.from([0, 127, 255]));
  await fs.writeFile(path.join(root, "Komponenten", "ESP32", "platformio.ini"), "[env:esp32dev]\nplatform = espressif32\n");
  await fs.writeFile(path.join(root, "Komponenten", "ESP32", "src", "main.cpp"), "#error wrong target\n");

  const files = await createBuildPackageFiles(root, {}, {
    id: "arduino_nano",
    type: "direct",
    source_root: "Komponenten/Arduino",
    environment: "nanoatmega328",
  });

  assert.deepEqual(Object.keys(files).sort(), ["platformio.ini", "src/main.cpp", "src/prompt.pcm8"]);
  assert.equal(typeof files["src/main.cpp"], "string");
  assert.deepEqual(files["src/prompt.pcm8"], { base64: Buffer.from([0, 127, 255]).toString("base64") });
  assert.match(String(files["platformio.ini"]), /default_envs = nanoatmega328/);
  await fs.rm(root, { recursive: true, force: true });
});

test("derives local build targets from a Forgejo project manifest", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-project-manifest-"));
  const unitsRoot = path.join(root, "gernetix", "software-units");
  await fs.mkdir(unitsRoot, { recursive: true });
  await fs.writeFile(path.join(root, "gernetix", "project.json"), JSON.stringify({ project_id: "project-pir", title: "PIR" }));
  await fs.writeFile(path.join(unitsRoot, "esp32.json"), JSON.stringify({
    software_unit_id: "esp32_firmware",
    title: "ESP32",
    build_system: "platformio",
    source_root: "Komponenten/ESP32",
    build: { environment: "esp32dev", firmware_basis_id: "gernetix-runtime-basissoftware" },
  }));
  await fs.writeFile(path.join(unitsRoot, "nano.json"), JSON.stringify({
    software_unit_id: "arduino_nano_firmware",
    title: "Arduino Nano",
    build_system: "platformio",
    source_root: "Komponenten/Arduino",
    build: { environment: "nanoatmega328", firmware_basis_id: "" },
  }));

  const manifest = await loadBuildManifest(root);
  assert.equal(manifest.source_id, "project-pir");
  assert.deepEqual(manifest.local_build.targets.map((target) => [target.id, target.type, target.source_root]), [
    ["esp32_firmware", "esp32-product", "Komponenten/ESP32"],
    ["arduino_nano_firmware", "direct", "Komponenten/Arduino"],
  ]);
  await fs.rm(root, { recursive: true, force: true });
});
