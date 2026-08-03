"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const zlib = require("node:zlib");
const { ArtifactUploadIngress } = require("../src/modules/artifact-upload-ingress");

test("keeps verified gzip uploads invisible until atomic finalization", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-upload-ingress-"));
  const original = Buffer.from("symbols\n".repeat(1000));
  const encoded = zlib.gzipSync(original);
  const publications = [];
  const ingress = new ArtifactUploadIngress({
    stagingDir: root,
    artifactStore: {
      async saveEncodedArtifacts(jobId, uploads) {
        publications.push({ jobId, uploads });
        return { "firmware.elf": { sha256: uploads[0].sha256 } };
      },
    },
  });
  const req = Readable.from(encoded);
  req.headers = uploadHeaders(encoded, original, "symbols", 30);
  try {
    const staged = await ingress.stage("job-1", "firmware.elf", req);
    assert.equal(staged.status, "staged");
    assert.equal(publications.length, 0);
    const finalized = await ingress.finalize("job-1", ["firmware.elf"]);
    assert.equal(finalized.status, "published");
    assert.equal(publications.length, 1);
    assert.equal(publications[0].uploads[0].encoding, "gzip");
    assert.equal(publications[0].uploads[0].sizeBytes, original.length);
    await ingress.finalize("job-1", ["firmware.elf"]);
    assert.equal(publications.length, 2, "finalize remains idempotently retryable while staging is retained");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("rejects payloads whose decoded hash does not match the signed metadata", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-upload-integrity-"));
  const original = Buffer.from("expected");
  const encoded = zlib.gzipSync(Buffer.from("different"));
  const ingress = new ArtifactUploadIngress({ stagingDir: root, artifactStore: {} });
  const req = Readable.from(encoded);
  req.headers = uploadHeaders(encoded, original, "symbols", 30);
  try {
    await assert.rejects(ingress.stage("job-1", "firmware.elf", req), (error) => error.code === "artifact_integrity_mismatch");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

function uploadHeaders(encoded, original, artifactClass, retentionDays) {
  return {
    "content-encoding": "gzip",
    "content-length": String(encoded.length),
    "content-type": "application/octet-stream",
    "x-artifact-size": String(original.length),
    "x-artifact-sha256": crypto.createHash("sha256").update(original).digest("hex"),
    "x-artifact-class": artifactClass,
    "x-artifact-retention-days": String(retentionDays),
  };
}
