const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

class ArtifactStore {
  constructor(options) {
    this.artifactDir = options.artifactDir;
    this.sqlitePath = options.sqlitePath || path.join(this.artifactDir, "gernetix-build-artifacts.sqlite");
    this.publicBaseUrl = options.publicBaseUrl || "";
    if (this.sqlitePath !== ":memory:") fsSync.mkdirSync(path.dirname(this.sqlitePath), { recursive: true });
    this.db = new DatabaseSync(this.sqlitePath);
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS build_artifacts (
        job_id TEXT NOT NULL,
        artifact_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_blob BLOB NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        esp_image_sha256 TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (job_id, artifact_name)
      );
      CREATE INDEX IF NOT EXISTS idx_build_artifacts_job ON build_artifacts(job_id);
    `);
  }

  async saveBuildArtifacts(jobId, buildOutput) {
    const artifacts = {};
    const rows = [];
    for (const artifactName of Object.keys(buildOutput.artifacts).sort()) {
      const sourcePath = buildOutput.artifacts[artifactName];
      if (!sourcePath) continue;
      const content = await fs.readFile(sourcePath);
      const metadata = describeContent(content);
      rows.push({ artifactName, content, metadata });
      artifacts[artifactName] = {
        file_name: artifactName,
        size_bytes: metadata.size_bytes,
        sha256: metadata.sha256,
        ...(artifactName === "firmware.bin" && metadata.esp_image_sha256
          ? { esp_image_sha256: metadata.esp_image_sha256 }
          : {}),
        download_url: this.publicBaseUrl
          ? `${this.publicBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`
          : `/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`,
      };
    }

    const safeJobId = sanitizeName(jobId);
    const insert = this.db.prepare(`
      INSERT INTO build_artifacts (
        job_id, artifact_name, content_type, content_blob, size_bytes, sha256,
        esp_image_sha256, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM build_artifacts WHERE job_id = ?").run(safeJobId);
      const now = new Date().toISOString();
      for (const row of rows) {
        insert.run(
          safeJobId,
          row.artifactName,
          contentType(row.artifactName),
          row.content,
          row.metadata.size_bytes,
          row.metadata.sha256,
          row.metadata.esp_image_sha256,
          now,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return artifacts;
  }

  getArtifact(jobId, artifactName) {
    const row = this.db.prepare(`
      SELECT artifact_name, content_type, content_blob, size_bytes, sha256
      FROM build_artifacts
      WHERE job_id = ? AND artifact_name = ?
    `).get(sanitizeName(jobId), artifactName);
    return row ? { ...row, content_blob: Buffer.from(row.content_blob) } : null;
  }

  close() {
    this.db.close();
  }
}

async function describeFile(filePath) {
  const content = await fs.readFile(filePath);
  return describeContent(content);
}

function describeContent(content) {
  return {
    size_bytes: content.length,
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    esp_image_sha256: content.length > 32 && content[0] === 0xe9
      ? content.subarray(content.length - 32).toString("hex")
      : null,
  };
}

function contentType(artifactName) {
  return artifactName === "build.log" ? "text/plain; charset=utf-8" : "application/octet-stream";
}

function sanitizeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

module.exports = { ArtifactStore, describeFile };
