"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ArtifactStore } = require("../src/modules/artifact-store");

test("persists build artifacts as SQL BLOBs independently from build files", async () => {
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
    });
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
