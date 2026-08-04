const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { DEFAULT_ARTIFACT_POLICY_SOURCE } = require("./artifact-contract");
const { ContentAddressedArtifactStore, normalizeSourceReference } = require("../../../shared");

class ArtifactStore {
  constructor(options) {
    this.artifactDir = options.artifactDir;
    this.sqlitePath = options.sqlitePath || path.join(this.artifactDir, "gernetix-build-artifacts.sqlite");
    this.publicBaseUrl = options.publicBaseUrl || "";
    this.artifactPolicySource = options.artifactPolicySource || DEFAULT_ARTIFACT_POLICY_SOURCE;
    this.objectStore = options.objectStore || new ContentAddressedArtifactStore(this.artifactDir);
    this.now = options.now || (() => new Date());
    if (this.sqlitePath !== ":memory:") fsSync.mkdirSync(path.dirname(this.sqlitePath), { recursive: true });
    this.db = new DatabaseSync(this.sqlitePath);
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS build_artifacts (
        job_id TEXT NOT NULL,
        artifact_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        object_key TEXT NOT NULL,
        object_sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        esp_image_sha256 TEXT,
        created_at TEXT NOT NULL,
        artifact_class TEXT NOT NULL DEFAULT 'deployable',
        retention_until TEXT,
        source_path TEXT NOT NULL,
        source_version TEXT NOT NULL,
        PRIMARY KEY (job_id, artifact_name)
      );
      CREATE INDEX IF NOT EXISTS idx_build_artifacts_job ON build_artifacts(job_id);
    `);
    ensureColumn(this.db, "artifact_class", "TEXT NOT NULL DEFAULT 'deployable'");
    ensureColumn(this.db, "retention_until", "TEXT");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_build_artifacts_retention ON build_artifacts(retention_until);");
    const applyLegacyRetention = this.db.prepare(`UPDATE build_artifacts
      SET artifact_class = ?, retention_until = datetime(created_at, ?)
      WHERE artifact_name = ? AND retention_until IS NULL`);
    for (const [name, policy] of Object.entries(this.artifactPolicySource.policies)) {
      applyLegacyRetention.run(policy.artifactClass, `+${policy.retentionDays} days`, name);
    }
  }

  async saveBuildArtifacts(jobId, buildOutput, sourceReference) {
    const source = normalizeSourceReference(sourceReference);
    const artifacts = {};
    const rows = [];
    for (const artifactName of Object.keys(buildOutput.artifacts).sort()) {
      const sourcePath = buildOutput.artifacts[artifactName];
      if (!sourcePath) continue;
      const content = await fs.readFile(sourcePath);
      const metadata = describeContent(content);
      const policy = this.artifactPolicySource.get(artifactName);
      if (!policy) throw new Error(`Artefakt ${artifactName} ist serverseitig nicht erlaubt.`);
      const object = await this.objectStore.put(content, source);
      rows.push({ artifactName, metadata, policy, object });
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
        job_id, artifact_name, content_type, object_key, object_sha256, size_bytes, sha256,
        esp_image_sha256, created_at, artifact_class, retention_until, source_path, source_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM build_artifacts WHERE job_id = ?").run(safeJobId);
      const now = this.now();
      const createdAt = now.toISOString();
      for (const row of rows) {
        insert.run(
          safeJobId,
          row.artifactName,
          contentType(row.artifactName),
          row.object.object_key,
          row.object.sha256,
          row.metadata.size_bytes,
          row.metadata.sha256,
          row.metadata.esp_image_sha256,
          createdAt,
          row.policy.artifactClass,
          new Date(now.getTime() + row.policy.retentionDays * 86400000).toISOString(),
          source.sourcePath,
          source.sourceVersion,
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
      SELECT artifact_name, content_type, object_key, object_sha256, size_bytes, sha256
      FROM build_artifacts
      WHERE job_id = ? AND artifact_name = ?
        AND (retention_until IS NULL OR retention_until > ?)
    `).get(sanitizeName(jobId), artifactName, this.now().toISOString());
    if (!row) return null;
    const content = fsSync.readFileSync(this.objectStore.resolve(row.object_key));
    const actual = crypto.createHash("sha256").update(content).digest("hex");
    if (actual !== row.object_sha256 || actual !== row.sha256) throw new Error("Artifact-Store-Integritätsprüfung fehlgeschlagen.");
    return { ...row, content_blob: content };
  }

  async pruneExpired(now = this.now()) {
    const result = this.db.prepare("DELETE FROM build_artifacts WHERE retention_until IS NOT NULL AND retention_until <= ?")
      .run(now.toISOString());
    return { deleted_count: Number(result.changes || 0) };
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

function ensureColumn(db, name, definition) {
  const columns = db.prepare("PRAGMA table_info(build_artifacts)").all();
  if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE build_artifacts ADD COLUMN ${name} ${definition}`);
}

module.exports = { ArtifactStore, describeContent, describeFile };
