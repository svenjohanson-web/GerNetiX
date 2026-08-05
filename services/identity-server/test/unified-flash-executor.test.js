"use strict";

const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const path = require("node:path");
const test = require("node:test");

const executor = require(path.join(__dirname, "../public/app/unified-flash-executor.js"));

test("verifies size, SHA-256 and source reference before returning flash bytes", async () => {
  const data = Uint8Array.from([1, 2, 3, 4]);
  const hash = await executor.sha256(data, webcrypto);
  const lines = [];
  const files = await executor.downloadAndVerify([{
    name: "firmware.bin", url: "/artifact", address: 0x10000,
    sizeBytes: data.length, sha256: hash,
    sourcePath: "projects/demo/src/main.cpp", sourceVersion: "a".repeat(40),
  }], {
    crypto: webcrypto,
    fetch: async () => new Response(data, { status: 200 }),
    write: (_kind, message) => lines.push(message),
  });
  assert.equal(files[0].address, 0x10000);
  assert.deepEqual(files[0].data, data);
  assert.match(lines.at(-1), /Größe und SHA-256 geprüft/);
  assert.match(lines.at(-1), /projects\/demo\/src\/main\.cpp/);
});

test("rejects a binary without an immutable source reference", async () => {
  const data = Uint8Array.from([1]);
  const hash = await executor.sha256(data, webcrypto);
  await assert.rejects(executor.downloadAndVerify([{
    name: "firmware.bin", url: "/artifact", sizeBytes: 1, sha256: hash,
  }], { crypto: webcrypto, fetch: async () => new Response(data) }), /Quellpfad/);
});

test("uses the same verified files for the Serial Helper adapter", async () => {
  const data = Uint8Array.from([9, 8]);
  const hash = await executor.sha256(data, webcrypto);
  let flashed;
  const result = await executor.executeUsb({
    port: { source: "gernetix_serial_service", path: "/dev/test" },
    serialService: {
      async probe() { return { chipName: "ESP32-S3" }; },
      async flash(order) { flashed = order; return { status: "succeeded" }; },
    },
    files: [{ name: "firmware.bin", url: "/artifact", sizeBytes: 2, sha256: hash, sourcePath: "src/main.cpp", sourceVersion: "1.0.0" }],
    fetch: async () => new Response(data), crypto: webcrypto,
    validateChip: (chip) => assert.equal(chip, "ESP32-S3"),
  });
  assert.equal(result.transport, "usb-helper");
  assert.deepEqual(flashed.files[0].data, data);
});
