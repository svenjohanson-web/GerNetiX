"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");

test("serves every ESP32 browser flash artifact", async () => {
  const requested = [];
  const app = createHttpApp({
    service: {},
    artifactStore: {
      async getArtifact(jobId, fileName) {
        requested.push([jobId, fileName]);
        return {
          content_type: "application/octet-stream",
          content_blob: Buffer.from(fileName),
          size_bytes: Buffer.byteLength(fileName),
          sha256: "a".repeat(64),
        };
      },
    },
  });

  for (const fileName of ["bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.bin"]) {
    const response = createResponseRecorder();
    await app({
      method: "GET",
      url: `/artifacts/build-1/${fileName}`,
      headers: { host: "127.0.0.1" },
    }, response);
    assert.equal(response.status, 200);
    assert.equal(response.body.toString(), fileName);
  }

  assert.deepEqual(requested, [
    ["build-1", "bootloader.bin"],
    ["build-1", "partitions.bin"],
    ["build-1", "boot_app0.bin"],
    ["build-1", "firmware.bin"],
  ]);
});

test("continues to reject files outside the artifact allowlist", async () => {
  const app = createHttpApp({
    service: {},
    artifactStore: {
      async getArtifact() {
        throw new Error("artifact store must not be queried");
      },
    },
  });
  const response = createResponseRecorder();

  await app({
    method: "GET",
    url: "/artifacts/build-1/secrets.txt",
    headers: { host: "127.0.0.1" },
  }, response);

  assert.equal(response.status, 404);
  assert.deepEqual(JSON.parse(response.body.toString()), { error: "not_found" });
});

function createResponseRecorder() {
  return {
    status: 0,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = Buffer.isBuffer(body) ? body : Buffer.from(body);
    },
  };
}
