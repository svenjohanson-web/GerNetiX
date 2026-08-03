"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const zlib = require("node:zlib");
const { BuildDeployError } = require("../errors");
const { DEFAULT_ARTIFACT_POLICY_SOURCE, contentType, sanitizeJobId } = require("./artifact-contract");

class ArtifactUploadIngress {
  constructor(options = {}) {
    this.artifactStore = options.artifactStore;
    this.stagingDir = options.stagingDir;
    this.maxStoredBytes = options.maxStoredBytes || 64 * 1024 * 1024;
    this.maxOriginalBytes = options.maxOriginalBytes || 128 * 1024 * 1024;
    this.staleMs = options.staleMs || 60 * 60 * 1000;
    this.now = options.now || (() => Date.now());
    this.artifactPolicySource = options.artifactPolicySource || DEFAULT_ARTIFACT_POLICY_SOURCE;
    if (options.scheduleCleanup !== false) {
      this.cleanupTimer = setInterval(() => this.cleanupExpired().catch(() => {}), this.staleMs);
      this.cleanupTimer.unref?.();
    }
  }

  async stage(jobId, artifactName, req) {
    const safeJobId = requireSafeJobId(jobId);
    if (!this.artifactPolicySource.isAllowed(artifactName)) throw notFound();
    const metadata = parseHeaders(req.headers, artifactName, this.maxStoredBytes, this.maxOriginalBytes, this.artifactPolicySource);
    await this.cleanupExpired();
    const jobDir = path.join(this.stagingDir, safeJobId);
    await fsp.mkdir(jobDir, { recursive: true, mode: 0o700 });
    const suffix = crypto.randomUUID();
    const temporaryPath = path.join(jobDir, `${artifactName}.${suffix}.partial`);
    const payloadPath = path.join(jobDir, `${artifactName}.payload`);
    const manifestPath = path.join(jobDir, `${artifactName}.json`);
    let receivedBytes = 0;
    const limiter = new Transform({
      transform: (chunk, _encoding, callback) => {
        receivedBytes += chunk.length;
        if (receivedBytes > this.maxStoredBytes) {
          callback(new BuildDeployError("artifact_too_large", "Artefakt-Upload ist zu gross.", 413));
        } else callback(null, chunk);
      },
    });
    try {
      await pipeline(req, limiter, fs.createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }));
      if (receivedBytes !== metadata.storedSizeBytes) throw invalid("artifact_stored_size_mismatch");
      await verifyPayload(temporaryPath, metadata, this.maxOriginalBytes);
      await fsp.rename(temporaryPath, payloadPath);
      await fsp.writeFile(manifestPath, JSON.stringify({ ...metadata, stagedAt: new Date(this.now()).toISOString() }), {
        encoding: "utf8",
        mode: 0o600,
      });
      return { status: "staged", artifact_name: artifactName, stored_size_bytes: receivedBytes };
    } catch (error) {
      await fsp.rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  async finalize(jobId, artifactNames) {
    const safeJobId = requireSafeJobId(jobId);
    if (!Array.isArray(artifactNames) || artifactNames.length === 0 || new Set(artifactNames).size !== artifactNames.length) {
      throw invalid("invalid_artifact_set");
    }
    if (artifactNames.some((name) => !this.artifactPolicySource.isAllowed(name))) throw notFound();
    const jobDir = path.join(this.stagingDir, safeJobId);
    const uploads = [];
    for (const name of artifactNames.slice().sort()) {
      const metadata = JSON.parse(await fsp.readFile(path.join(jobDir, `${name}.json`), "utf8").catch(() => {
        throw new BuildDeployError("artifact_upload_incomplete", "Artefakt-Upload ist unvollstaendig.", 409);
      }));
      uploads.push({ ...metadata, artifactName: name, payloadPath: path.join(jobDir, `${name}.payload`) });
    }
    const artifacts = await this.artifactStore.saveEncodedArtifacts(safeJobId, uploads);
    return { status: "published", artifacts };
  }

  async cleanupExpired() {
    await fsp.mkdir(this.stagingDir, { recursive: true, mode: 0o700 });
    const entries = await fsp.readdir(this.stagingDir, { withFileTypes: true });
    await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      const target = path.join(this.stagingDir, entry.name);
      const stat = await fsp.stat(target);
      if (this.now() - stat.mtimeMs > this.staleMs) await fsp.rm(target, { recursive: true, force: true });
    }));
  }

  close() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

function parseHeaders(headers, artifactName, maxStoredBytes, maxOriginalBytes, policySource = DEFAULT_ARTIFACT_POLICY_SOURCE) {
  const policy = policySource.get(artifactName);
  if (!policy) throw notFound();
  const encoding = String(headers["content-encoding"] || "identity").toLowerCase();
  const storedSizeBytes = parseBoundedInteger(headers["content-length"], maxStoredBytes);
  const sizeBytes = parseBoundedInteger(headers["x-artifact-size"], maxOriginalBytes);
  const sha256 = String(headers["x-artifact-sha256"] || "").toLowerCase();
  const espImageSha256 = String(headers["x-artifact-esp-image-sha256"] || "").toLowerCase();
  const artifactClass = String(headers["x-artifact-class"] || "");
  const retentionDays = Number(headers["x-artifact-retention-days"]);
  const suppliedContentType = String(headers["content-type"] || "");
  if (!["identity", "gzip"].includes(encoding) || !/^[a-f0-9]{64}$/.test(sha256)) throw invalid("invalid_artifact_metadata");
  if (espImageSha256 && !/^[a-f0-9]{64}$/.test(espImageSha256)) throw invalid("invalid_artifact_metadata");
  if (artifactClass !== policy.artifactClass || retentionDays !== policy.retentionDays) throw invalid("invalid_artifact_policy");
  if (encoding === "gzip" && !policy.compress) throw invalid("invalid_artifact_encoding");
  if (suppliedContentType !== contentType(artifactName)) throw invalid("invalid_artifact_content_type");
  return {
    contentType: suppliedContentType,
    encoding,
    storedSizeBytes,
    sizeBytes,
    sha256,
    espImageSha256: espImageSha256 || null,
    artifactClass,
    retentionDays,
  };
}

async function verifyPayload(payloadPath, metadata, maxOriginalBytes) {
  const hash = crypto.createHash("sha256");
  let size = 0;
  let tail = Buffer.alloc(0);
  const verifier = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > maxOriginalBytes) return callback(new BuildDeployError("artifact_too_large", "Artefakt ist dekomprimiert zu gross.", 413));
      hash.update(chunk);
      tail = Buffer.concat([tail, chunk]).subarray(-32);
      callback();
    },
  });
  const streams = [fs.createReadStream(payloadPath)];
  if (metadata.encoding === "gzip") streams.push(zlib.createGunzip());
  streams.push(verifier);
  try {
    await pipeline(...streams);
  } catch (error) {
    if (error instanceof BuildDeployError) throw error;
    throw invalid("invalid_artifact_payload");
  }
  if (size !== metadata.sizeBytes || hash.digest("hex") !== metadata.sha256) throw invalid("artifact_integrity_mismatch");
  if (metadata.espImageSha256 && tail.toString("hex") !== metadata.espImageSha256) throw invalid("artifact_integrity_mismatch");
}

function parseBoundedInteger(value, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > maximum) throw invalid("invalid_artifact_size");
  return number;
}
function requireSafeJobId(value) {
  const safe = sanitizeJobId(value);
  if (!safe || safe !== value) throw notFound();
  return safe;
}
function invalid(code) { return new BuildDeployError(code, "Artefakt-Upload ist ungueltig.", 400); }
function notFound() { return new BuildDeployError("not_found", "Nicht gefunden.", 404); }

module.exports = { ArtifactUploadIngress, parseHeaders, verifyPayload };
