"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ArtifactStore } = require("../src/modules/artifact-store");

test("persists build artifacts as content-addressed objects with SQL references", async () => {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-artifact-source-"));
  const sqliteDir = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-artifact-sql-"));
  const firmwarePath = path.join(sourceDir, "firmware.hex");
  const logPath = path.join(sourceDir, "build.log");
  await fs.writeFile(firmwarePath, ":00000001FF\n");
  await fs.writeFile(logPath, "build succeeded\n");

  const store = new ArtifactStore({
    artifactDir: path.join(sqliteDir, "legacy-artifacts"),
    sqlitePath: path.join(sqliteDir, "artifacts.sqlite"),
  });
  try {
    const saved = await store.saveBuildArtifacts("job/with spaces", {
      artifacts: {
        "firmware.hex": firmwarePath,
        "build.log": logPath,
      },
    }, { sourcePath: "src/main.cpp", sourceVersion: "e".repeat(64) });
    await fs.rm(sourceDir, { recursive: true, force: true });

    assert.match(saved["firmware.hex"].sha256, /^[a-f0-9]{64}$/);
    assert.equal(store.getArtifact("job/with spaces", "firmware.hex").content_blob.toString(), ":00000001FF\n");
    assert.equal(store.getArtifact("job/with spaces", "build.log").content_type, "text/plain; charset=utf-8");
    assert.equal(store.getArtifact("other-job", "firmware.hex"), null);
  } finally {
    store.close();
    await fs.rm(sqliteDir, { recursive: true, force: true });
  }
});

test("prunes expired sqlite artifacts independently from new builds", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-artifact-retention-"));
  const source = path.join(root, "firmware.bin");
  await fs.writeFile(source, "firmware");
  let now = new Date("2026-01-01T00:00:00.000Z");
  const store = new ArtifactStore({ artifactDir: root, sqlitePath: ":memory:", now: () => now });
  try {
    await store.saveBuildArtifacts("job-1", { artifacts: { "firmware.bin": source } }, { sourcePath: "src/main.cpp", sourceVersion: "e".repeat(64) });
    assert.ok(store.getArtifact("job-1", "firmware.bin"));
    now = new Date("2027-01-01T00:00:00.000Z");
    assert.equal(store.getArtifact("job-1", "firmware.bin"), null);
    assert.deepEqual(await store.pruneExpired(), { deleted_count: 1 });
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
