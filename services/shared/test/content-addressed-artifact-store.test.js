"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ContentAddressedArtifactStore } = require("../persistence/content-addressed-artifact-store");

test("stores payloads by content hash and requires source path plus immutable version", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-object-store-"));
  const store = new ContentAddressedArtifactStore(root);
  try {
    await assert.rejects(store.put(Buffer.from("firmware"), {}), /Quellpfad/);
    const reference = await store.put(Buffer.from("firmware"), {
      source_path: "basissoftware/esp32/src/main.cpp",
      source_version: "f".repeat(40),
    });
    assert.match(reference.object_key, /^objects\/[a-f0-9]{2}\/[a-f0-9]{64}$/);
    assert.equal(reference.source_path, "basissoftware/esp32/src/main.cpp");
    assert.deepEqual(await store.get({ object_key: reference.object_key, object_sha256: reference.sha256 }), Buffer.from("firmware"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
