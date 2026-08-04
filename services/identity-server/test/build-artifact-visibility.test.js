"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  customerArtifactList,
  customerBuildProgress,
  isCustomerDownloadableArtifactName,
  redactProtectedSymbolFrames,
} = require("../src/dev/server/build-artifact-visibility");

test("exposes only flashable artifacts to project owners", () => {
  const artifacts = Object.fromEntries([
    "firmware.bin", "bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.hex",
    "firmware.elf", "firmware.map", "build.log",
  ].map((file_name) => [file_name, { file_name, size_bytes: 1, sha256: "a" }]));
  assert.deepEqual(customerArtifactList("job-1", artifacts).map((item) => item.file_name), [
    "firmware.bin", "bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.hex",
  ]);
  assert.equal(isCustomerDownloadableArtifactName("firmware.elf"), false);
  assert.equal(isCustomerDownloadableArtifactName("firmware.map"), false);
  assert.equal(isCustomerDownloadableArtifactName("build.log"), false);
});

test("replaces basissoftware compiler progress with bounded phase messages", () => {
  const progress = [
    { sequence: 1, phase: "compiling", message: "Compiling src/functions/pairing.cpp", at: "t1" },
    { sequence: 2, phase: "compiling", message: "secret_symbol from /internal/path", at: "t2" },
    { sequence: 3, phase: "artifacts", message: "firmware.elf", at: "t3" },
  ];
  assert.deepEqual(customerBuildProgress(progress, true), [
    { sequence: 2, phase: "compiling", message: "Firmware wird kompiliert.", at: "t2" },
    { sequence: 3, phase: "artifacts", message: "Firmware-Artefakte werden gesichert.", at: "t3" },
  ]);
  assert.equal(customerBuildProgress(progress, false), progress);
});

test("keeps project frames and removes basissoftware symbol details", () => {
  const frames = redactProtectedSymbolFrames([
    { address: "0x1", resolved: true, function: "userMain", file: "/tmp/build/src/user/user_app.cpp", line: 7 },
    { address: "0x2", resolved: true, function: "pairingSecret", file: "/tmp/build/src/functions/pairing.cpp", line: 42 },
    { address: "0x3", resolved: false, function: "", file: "", line: 0 },
  ], ["src/user/user_app.cpp"]);
  assert.equal(frames[0].function, "userMain");
  assert.deepEqual(frames[1], {
    address: "0x2", resolved: false, protected: true, function: "", file: "", line: 0,
  });
  assert.equal(frames[2].resolved, false);
  assert.equal(frames[2].protected, undefined);
});
