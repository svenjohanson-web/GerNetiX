"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const zlib = require("node:zlib");
const { artifactPolicy, contentType, sanitizeJobId } = require("./artifact-contract");

class HttpArtifactStore {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
    this.token = options.token || "";
    this.publicBaseUrl = options.publicBaseUrl || "";
    this.tempDir = options.tempDir;
    this.timeoutMs = options.timeoutMs || 120000;
    this.request = options.request || request;
    this.reportMetrics = options.reportMetrics || (() => {});
    if (!this.baseUrl || !this.token || !this.tempDir) {
      throw new Error("HTTP-ArtifactStore braucht Base-URL, Token und Temp-Verzeichnis.");
    }
    if (this.token.length < 32) throw new Error("Artifact-Upload-Token muss mindestens 32 Zeichen lang sein.");
  }

  async saveBuildArtifacts(jobId, buildOutput) {
    const startedAt = Date.now();
    const safeJobId = sanitizeJobId(jobId);
    const prepared = [];
    await fsp.mkdir(this.tempDir, { recursive: true });
    try {
      for (const artifactName of Object.keys(buildOutput.artifacts).sort()) {
        const sourcePath = buildOutput.artifacts[artifactName];
        const policy = artifactPolicy(artifactName);
        if (!sourcePath || !policy) continue;
        prepared.push(await this.prepareArtifact(safeJobId, artifactName, sourcePath, policy));
      }
      await Promise.all(prepared.map((artifact) => this.uploadArtifact(safeJobId, artifact)));
      await this.callJson("POST", `/api/internal/build-artifacts/${encodeURIComponent(safeJobId)}/finalize`, {
        artifacts: prepared.map((artifact) => artifact.name),
      });
      const result = Object.fromEntries(prepared.map((artifact) => [artifact.name, artifact.publicMetadata]));
      this.emitMetrics(safeJobId, prepared, startedAt, true);
      return result;
    } catch (error) {
      this.emitMetrics(safeJobId, prepared, startedAt, false);
      throw error;
    } finally {
      await Promise.all(prepared.map((artifact) => fsp.rm(artifact.tempPath, { force: true }).catch(() => {})));
    }
  }

  async prepareArtifact(jobId, name, sourcePath, policy) {
    const encoding = policy.compress ? "gzip" : "identity";
    const tempPath = path.join(this.tempDir, `${jobId}-${name}-${crypto.randomUUID()}.upload`);
    const hash = crypto.createHash("sha256");
    let sizeBytes = 0;
    let tail = Buffer.alloc(0);
    let firstByte;
    const observer = new Transform({
      transform(chunk, _encoding, callback) {
        sizeBytes += chunk.length;
        if (firstByte === undefined && chunk.length) firstByte = chunk[0];
        hash.update(chunk);
        tail = Buffer.concat([tail, chunk]).subarray(-32);
        callback(null, chunk);
      },
    });
    const streams = [fs.createReadStream(sourcePath), observer];
    if (encoding === "gzip") streams.push(zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED }));
    streams.push(fs.createWriteStream(tempPath, { flags: "wx", mode: 0o600 }));
    try {
      await pipeline(...streams);
    } catch (error) {
      await fsp.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
    const stat = await fsp.stat(tempPath);
    const sha256 = hash.digest("hex");
    const espImageSha256 = name === "firmware.bin" && sizeBytes > 32 && firstByte === 0xe9 ? tail.toString("hex") : "";
    return {
      name,
      tempPath,
      encoding,
      storedSizeBytes: stat.size,
      sizeBytes,
      sha256,
      espImageSha256,
      artifactClass: policy.artifactClass,
      retentionDays: policy.retentionDays,
      publicMetadata: {
        file_name: name,
        size_bytes: sizeBytes,
        sha256,
        ...(espImageSha256 ? { esp_image_sha256: espImageSha256 } : {}),
        download_url: this.publicBaseUrl
          ? `${this.publicBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(name)}`
          : `/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(name)}`,
      },
    };
  }

  async uploadArtifact(jobId, artifact) {
    const headers = {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": contentType(artifact.name),
      "Content-Encoding": artifact.encoding,
      "Content-Length": String(artifact.storedSizeBytes),
      "X-Artifact-Size": String(artifact.sizeBytes),
      "X-Artifact-SHA256": artifact.sha256,
      "X-Artifact-Class": artifact.artifactClass,
      "X-Artifact-Retention-Days": String(artifact.retentionDays),
    };
    if (artifact.espImageSha256) headers["X-Artifact-ESP-Image-SHA256"] = artifact.espImageSha256;
    await this.request({
      method: "PUT",
      url: `${this.baseUrl}/api/internal/build-artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifact.name)}`,
      headers,
      bodyPath: artifact.tempPath,
      timeoutMs: this.timeoutMs,
    });
  }

  async callJson(method, pathname, body) {
    const payload = Buffer.from(JSON.stringify(body));
    await this.request({
      method,
      url: `${this.baseUrl}${pathname}`,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Content-Length": String(payload.length),
      },
      body: payload,
      timeoutMs: this.timeoutMs,
    });
  }

  emitMetrics(jobId, artifacts, startedAt, succeeded) {
    try {
      this.reportMetrics({
        event: "build_artifact_persistence",
        backend: "http",
        job_id: jobId,
        succeeded,
        artifact_count: artifacts.length,
        total_bytes: artifacts.reduce((sum, item) => sum + item.sizeBytes, 0),
        transferred_bytes: artifacts.reduce((sum, item) => sum + item.storedSizeBytes, 0),
        duration_ms: Date.now() - startedAt,
        artifacts: artifacts.map((item) => ({
          artifact_name: item.name,
          artifact_class: item.artifactClass,
          storage_encoding: item.encoding,
          size_bytes: item.sizeBytes,
          stored_size_bytes: item.storedSizeBytes,
        })),
      });
    } catch {}
  }

  async getArtifact() { return null; }
  async close() {}
}

function request(options) {
  return new Promise((resolve, reject) => {
    const target = new URL(options.url);
    if (!["http:", "https:"].includes(target.protocol)) return reject(new Error("Unsupported artifact upload protocol."));
    const transport = target.protocol === "https:" ? https : http;
    const req = transport.request(target, { method: options.method, headers: options.headers }, (res) => {
      let length = 0;
      res.on("data", (chunk) => {
        length += chunk.length;
        if (length > 1024 * 1024) req.destroy(new Error("Artifact upload response is too large."));
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
        reject(new Error(`Artifact upload failed with HTTP ${res.statusCode}.`));
      });
    });
    req.setTimeout(options.timeoutMs, () => req.destroy(new Error("Artifact upload timed out.")));
    req.on("error", reject);
    if (options.bodyPath) fs.createReadStream(options.bodyPath).on("error", reject).pipe(req);
    else req.end(options.body || undefined);
  });
}

module.exports = { HttpArtifactStore, request };
