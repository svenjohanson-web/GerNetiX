"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");
const { HttpArtifactStore } = require("../src/modules/http-artifact-store");

test("compresses symbol artifacts, streams uploads and finalizes the exact set", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-http-artifacts-"));
  const source = path.join(root, "firmware.elf");
  const original = Buffer.from("ELF-symbol-table\n".repeat(20000));
  await fs.writeFile(source, original);
  const calls = [];
  const metrics = [];
  const store = new HttpArtifactStore({
    baseUrl: "https://build.internal",
    token: "a".repeat(32),
    publicBaseUrl: "https://build.example",
    tempDir: root,
    request: async (request) => {
      calls.push({ ...request, payload: request.bodyPath ? await fs.readFile(request.bodyPath) : request.body });
    },
    reportMetrics: (entry) => metrics.push(entry),
  });
  try {
    const result = await store.saveBuildArtifacts("job-1", { artifacts: { "firmware.elf": source } }, {
      sourcePath: "src/main.cpp",
      sourceVersion: "b".repeat(64),
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].headers["Content-Encoding"], "gzip");
    assert.equal(calls[0].headers["X-Artifact-Source-Path"], "src/main.cpp");
    assert.equal(calls[0].headers["X-Artifact-Source-Version"], "b".repeat(64));
    assert.deepEqual(zlib.gunzipSync(calls[0].payload), original);
    assert.ok(calls[0].payload.length < original.length);
    assert.deepEqual(JSON.parse(calls[1].payload), { artifacts: ["firmware.elf"] });
    assert.equal(result["firmware.elf"].size_bytes, original.length);
    assert.equal(metrics[0].backend, "http");
    assert.ok(metrics[0].transferred_bytes < metrics[0].total_bytes);
    assert.equal((await fs.readdir(root)).filter((name) => name.endsWith(".upload")).length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
