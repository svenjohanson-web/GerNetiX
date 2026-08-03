"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const test = require("node:test");
const { PostgresArtifactStore } = require("../src/modules/postgres-artifact-store");

test("reads each artifact once, batches PostgreSQL inserts and reports payload-free metrics", async () => {
  const queries = [];
  const reads = [];
  const metrics = [];
  const contents = new Map([
    ["/build/build.log", Buffer.from("build succeeded\n")],
    ["/build/firmware.bin", Buffer.from("firmware")],
  ]);
  const client = {
    async query(sql, values = []) {
      queries.push({ sql: String(sql), values });
      return { rows: [] };
    },
    release() {},
  };
  const store = new PostgresArtifactStore({ connect: async () => client }, {
    readFile: async (filePath) => {
      reads.push(filePath);
      return contents.get(filePath);
    },
    reportMetrics: (entry) => metrics.push(entry),
  });

  const saved = await store.saveBuildArtifacts("job/with spaces", {
    artifacts: {
      "firmware.bin": "/build/firmware.bin",
      "build.log": "/build/build.log",
    },
  });

  assert.deepEqual(reads, ["/build/build.log", "/build/firmware.bin"]);
  assert.equal(saved["firmware.bin"].sha256, crypto.createHash("sha256").update("firmware").digest("hex"));
  const inserts = queries.filter((entry) => /INSERT INTO build_artifacts/.test(entry.sql));
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].values.length, 22);
  assert.equal(inserts[0].values[0], "job_with_spaces");
  assert.equal(inserts[0].values[1], "build.log");
  assert.equal(inserts[0].values[2], "text/plain; charset=utf-8");
  assert.ok(Buffer.isBuffer(inserts[0].values[3]));
  assert.equal(inserts[0].values[11], "job_with_spaces");
  assert.equal(inserts[0].values[12], "firmware.bin");
  assert.equal(inserts[0].values[18], "identity");
  assert.deepEqual(queries.map((entry) => entry.sql.trim().split(/\s+/).slice(0, 2).join(" ")), [
    "BEGIN",
    "DELETE FROM",
    "DELETE FROM",
    "INSERT INTO",
    "COMMIT",
  ]);
  assert.equal(metrics.length, 1);
  assert.deepEqual(metrics[0].artifacts.map((entry) => entry.artifact_name), ["build.log", "firmware.bin"]);
  assert.equal(metrics[0].event, "build_artifact_persistence");
  assert.equal(metrics[0].job_id, "job_with_spaces");
  assert.equal(metrics[0].succeeded, true);
  assert.equal(metrics[0].artifact_count, 2);
  assert.equal(metrics[0].total_bytes, Buffer.byteLength("build succeeded\nfirmware"));
  assert.equal(Object.hasOwn(metrics[0], "content"), false);
  for (const value of Object.values(metrics[0].phases)) assert.ok(value >= 0);
});

test("rolls back a failed batch and reports only its failure phase", async () => {
  const queries = [];
  const metrics = [];
  const client = {
    async query(sql) {
      const statement = String(sql);
      queries.push(statement);
      if (/INSERT INTO build_artifacts/.test(statement)) throw new Error("database unavailable with private detail");
      return { rows: [] };
    },
    release() {},
  };
  const store = new PostgresArtifactStore({ connect: async () => client }, {
    readFile: async () => Buffer.from("firmware"),
    reportMetrics: (entry) => metrics.push(entry),
  });

  await assert.rejects(
    store.saveBuildArtifacts("job-1", { artifacts: { "firmware.bin": "/build/firmware.bin" } }),
    /database unavailable/,
  );

  assert.match(queries.at(-1), /ROLLBACK/);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].succeeded, false);
  assert.equal(metrics[0].failure_phase, "insert");
  assert.equal(JSON.stringify(metrics[0]).includes("private detail"), false);
});

test("does not fail artifact persistence when the metrics reporter fails", async () => {
  const client = {
    async query() { return { rows: [] }; },
    release() {},
  };
  const store = new PostgresArtifactStore({ connect: async () => client }, {
    readFile: async () => Buffer.from("firmware"),
    reportMetrics: () => { throw new Error("metrics unavailable"); },
  });

  const saved = await store.saveBuildArtifacts("job-1", {
    artifacts: { "firmware.bin": "/build/firmware.bin" },
  });

  assert.match(saved["firmware.bin"].sha256, /^[a-f0-9]{64}$/);
});

test("publishes staged encoded artifacts transactionally and decodes them for consumers", async () => {
  const original = Buffer.from("ELF symbols\n".repeat(100));
  const encoded = zlib.gzipSync(original);
  const queries = [];
  const client = {
    async query(sql, values = []) { queries.push({ sql: String(sql), values }); return { rows: [] }; },
    release() {},
  };
  const pool = {
    async connect() { return client; },
    async query() {
      return { rows: [{
        artifact_name: "firmware.elf",
        content_type: "application/octet-stream",
        content_blob: encoded,
        size_bytes: String(original.length),
        sha256: crypto.createHash("sha256").update(original).digest("hex"),
        storage_encoding: "gzip",
      }] };
    },
  };
  const store = new PostgresArtifactStore(pool, { readFile: async () => encoded });
  const metadata = {
    artifactName: "firmware.elf",
    payloadPath: "/staged/firmware.elf",
    encoding: "gzip",
    storedSizeBytes: encoded.length,
    sizeBytes: original.length,
    sha256: crypto.createHash("sha256").update(original).digest("hex"),
    espImageSha256: null,
    artifactClass: "symbols",
    retentionDays: 30,
  };
  const published = await store.saveEncodedArtifacts("job-1", [metadata]);
  assert.equal(published["firmware.elf"].size_bytes, original.length);
  assert.equal(queries.filter((entry) => /INSERT INTO build_artifacts/.test(entry.sql)).length, 1);
  assert.match(queries.at(-1).sql, /COMMIT/);
  const artifact = await store.getArtifact("job-1", "firmware.elf");
  assert.deepEqual(artifact.content_blob, original);
});
