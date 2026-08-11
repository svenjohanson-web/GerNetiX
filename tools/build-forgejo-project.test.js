"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { configureDirectEnvironment, normalizeUploadPort, selectTargets, validatePackage } = require("./build-forgejo-project");

test("accepts one worker-style PlatformIO build package", () => {
  assert.doesNotThrow(() => validatePackage({ id: "camera_sender" }, {
    "platformio.ini": "[env:camera]\nplatform = espressif32\n",
    "src/main.cpp": "void app_main() {}\n",
  }));
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
