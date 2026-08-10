"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeUploadPort, selectTargets, validatePackage } = require("./build-forgejo-project");

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
  if (process.platform === "win32") {
    assert.equal(normalizeUploadPort("com5"), "COM5");
    assert.throws(() => normalizeUploadPort("COM5 & erase"), /gueltiger COM-Port/);
  }
  const targets = [{ id: "camera_sender" }, { id: "display_receiver" }];
  assert.throws(() => selectTargets(targets, "", true), /mehrere Flashziele/);
  assert.deepEqual(selectTargets(targets, "display_receiver", true), [{ id: "display_receiver" }]);
});
