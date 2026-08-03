"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { BuildPackageStore } = require("../src/modules/build-package-store");

test("incremental cache TTL removes stale targets but preserves recently used targets", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-cache-retention-"));
  const stale = path.join(root, "project-old--default--g0");
  const fresh = path.join(root, "project-new--default--g0");
  await Promise.all([stale, fresh].map((directory) => fs.mkdir(directory, { recursive: true })));
  const staleTime = new Date("2026-01-01T00:00:00.000Z");
  const freshTime = new Date("2026-01-10T00:00:00.000Z");
  await fs.utimes(stale, staleTime, staleTime);
  await fs.utimes(fresh, freshTime, freshTime);
  const store = new BuildPackageStore({
    tempDir: path.join(root, "tmp"),
    incrementalCacheDir: root,
    incrementalCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  });
  try {
    const result = await store.pruneExpiredIncrementalCaches({ now: freshTime.getTime() });
    assert.deepEqual(result, { deleted_count: 1 });
    assert.equal(await fs.access(stale).then(() => true).catch(() => false), false);
    assert.equal(await fs.access(fresh).then(() => true).catch(() => false), true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
