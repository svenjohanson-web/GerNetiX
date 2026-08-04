"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { promisify } = require("node:util");
const zlib = require("node:zlib");
const { describeContent } = require("./artifact-store");
const { DEFAULT_ARTIFACT_POLICY_SOURCE, contentType, sanitizeJobId } = require("./artifact-contract");
const { requireSourceReference } = require("./http-artifact-store");
const gunzip = promisify(zlib.gunzip);

class PostgresArtifactStore {
  static async create(options = {}) {
    const { Pool } = require("pg");
    const store = new PostgresArtifactStore(options.pool || new Pool(options.poolOptions), options);
    if (options.manageSchema !== false) await store.migrate();
    return store;
  }

  constructor(pool, options = {}) {
    this.pool = pool;
    this.publicBaseUrl = options.publicBaseUrl || "";
    this.artifactDir = path.resolve(options.artifactDir || path.join(process.cwd(), ".runtime", "artifacts"));
    this.readFile = options.readFile || fs.readFile;
    this.writeObject = options.writeObject || ((content) => persistObject(this.artifactDir, content));
    this.readObject = options.readObject || ((objectKey) => fs.readFile(resolveObjectPath(this.artifactDir, objectKey)));
    this.clock = options.clock || (() => performance.now());
    this.reportMetrics = options.reportMetrics || (() => {});
    this.artifactPolicySource = options.artifactPolicySource || DEFAULT_ARTIFACT_POLICY_SOURCE;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS build_artifacts (
        job_id TEXT NOT NULL, artifact_name TEXT NOT NULL, content_type TEXT NOT NULL,
        object_key TEXT NOT NULL, object_sha256 TEXT NOT NULL,
        size_bytes BIGINT NOT NULL, sha256 TEXT NOT NULL, esp_image_sha256 TEXT,
        created_at TIMESTAMPTZ NOT NULL, storage_encoding TEXT NOT NULL DEFAULT 'identity',
        stored_size_bytes BIGINT NOT NULL, artifact_class TEXT NOT NULL DEFAULT 'deployable',
        retention_until TIMESTAMPTZ, source_path TEXT NOT NULL, source_version TEXT NOT NULL,
        PRIMARY KEY (job_id,artifact_name)
      );
      CREATE INDEX IF NOT EXISTS idx_build_artifacts_job ON build_artifacts(job_id);
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS object_key TEXT;
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS object_sha256 TEXT;
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS storage_encoding TEXT NOT NULL DEFAULT 'identity';
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS stored_size_bytes BIGINT;
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS artifact_class TEXT NOT NULL DEFAULT 'deployable';
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS source_path TEXT;
      ALTER TABLE build_artifacts ADD COLUMN IF NOT EXISTS source_version TEXT;
      CREATE INDEX IF NOT EXISTS idx_build_artifacts_retention ON build_artifacts(retention_until);
      UPDATE build_artifacts SET stored_size_bytes=size_bytes WHERE stored_size_bytes IS NULL;
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema=current_schema() AND table_name='build_artifacts' AND column_name='content_blob'
        ) THEN
          ALTER TABLE build_artifacts ALTER COLUMN content_blob DROP NOT NULL;
        END IF;
      END $$;
    `);
    for (const [name, policy] of Object.entries(this.artifactPolicySource.policies)) {
      await this.pool.query(`UPDATE build_artifacts
        SET artifact_class=$1, retention_until=created_at + ($2 * INTERVAL '1 day')
        WHERE artifact_name=$3 AND retention_until IS NULL`, [policy.artifactClass, policy.retentionDays, name]);
    }
  }

  async saveBuildArtifacts(jobId, buildOutput, sourceReference) {
    const startedAt = this.clock();
    const safeJobId = sanitizeJobId(jobId);
    const source = requireSourceReference(sourceReference);
    const artifacts = {};
    const rows = [];
    const itemMetrics = [];
    const phases = { read_ms: 0, hash_ms: 0, object_write_ms: 0, connect_ms: 0, begin_ms: 0, delete_ms: 0, insert_ms: 0, commit_ms: 0 };
    let failurePhase = "read";
    let client = null;
    let transactionStarted = false;
    try {
      for (const artifactName of Object.keys(buildOutput.artifacts).sort()) {
        const filePath = buildOutput.artifacts[artifactName];
        if (!filePath) continue;
        const readStartedAt = this.clock();
        const content = await this.readFile(filePath);
        const readMs = elapsedMs(this.clock, readStartedAt);
        const hashStartedAt = this.clock();
        const metadata = describeContent(content);
        const hashMs = elapsedMs(this.clock, hashStartedAt);
        const policy = this.artifactPolicySource.get(artifactName);
        if (!policy) throw new Error(`Artefakt ${artifactName} ist serverseitig nicht erlaubt.`);
        failurePhase = "object_write";
        const objectStartedAt = this.clock();
        const object = await this.writeObject(content);
        phases.object_write_ms += elapsedMs(this.clock, objectStartedAt);
        phases.read_ms += readMs;
        phases.hash_ms += hashMs;
        itemMetrics.push({ artifact_name: artifactName, size_bytes: metadata.size_bytes, read_ms: readMs, hash_ms: hashMs });
        rows.push({ artifactName, metadata, encoding: "identity", storedSizeBytes: content.length, policy, object, source });
        artifacts[artifactName] = publicMetadata(this.publicBaseUrl, jobId, artifactName, metadata);
      }
      failurePhase = "connect";
      const connectStartedAt = this.clock();
      client = await this.pool.connect();
      phases.connect_ms = elapsedMs(this.clock, connectStartedAt);
      failurePhase = "begin";
      const beginStartedAt = this.clock();
      await client.query("BEGIN");
      transactionStarted = true;
      phases.begin_ms = elapsedMs(this.clock, beginStartedAt);
      failurePhase = "delete";
      const deleteStartedAt = this.clock();
      await client.query("DELETE FROM build_artifacts WHERE retention_until IS NOT NULL AND retention_until <= NOW()");
      await client.query("DELETE FROM build_artifacts WHERE job_id=$1", [safeJobId]);
      phases.delete_ms = elapsedMs(this.clock, deleteStartedAt);
      if (rows.length) {
        failurePhase = "insert";
        const insertStartedAt = this.clock();
        const batch = buildBatchInsert(safeJobId, rows);
        await client.query(batch.sql, batch.values);
        phases.insert_ms = elapsedMs(this.clock, insertStartedAt);
      }
      failurePhase = "commit";
      const commitStartedAt = this.clock();
      await client.query("COMMIT");
      transactionStarted = false;
      phases.commit_ms = elapsedMs(this.clock, commitStartedAt);
      this.emitMetrics({ safeJobId, rows, itemMetrics, phases, startedAt, succeeded: true });
    } catch (error) {
      if (transactionStarted && client) try { await client.query("ROLLBACK"); } catch {}
      this.emitMetrics({ safeJobId, rows, itemMetrics, phases, startedAt, succeeded: false, failurePhase });
      throw error;
    } finally { client?.release(); }
    return artifacts;
  }

  async saveEncodedArtifacts(jobId, uploads) {
    const safeJobId = sanitizeJobId(jobId);
    const rows = [];
    const artifacts = {};
    for (const upload of uploads) {
      const source = requireSourceReference(upload);
      const serverPolicy = this.artifactPolicySource.get(upload.artifactName);
      if (!serverPolicy || serverPolicy.artifactClass !== upload.artifactClass || serverPolicy.retentionDays !== upload.retentionDays) {
        throw new Error(`Artefakt-Policy fuer ${upload.artifactName} stimmt nicht mit der Server-Policy ueberein.`);
      }
      const content = await this.readFile(upload.payloadPath);
      if (content.length !== upload.storedSizeBytes) throw new Error("Staged artifact size changed before publication.");
      const object = await this.writeObject(content);
      const metadata = { size_bytes: upload.sizeBytes, sha256: upload.sha256, esp_image_sha256: upload.espImageSha256 };
      rows.push({ artifactName: upload.artifactName, metadata, encoding: upload.encoding, storedSizeBytes: upload.storedSizeBytes, policy: serverPolicy, object, source });
      artifacts[upload.artifactName] = publicMetadata(this.publicBaseUrl, jobId, upload.artifactName, metadata);
    }
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query("BEGIN"); transactionStarted = true;
      await client.query("DELETE FROM build_artifacts WHERE retention_until IS NOT NULL AND retention_until <= NOW()");
      await client.query("DELETE FROM build_artifacts WHERE job_id=$1", [safeJobId]);
      if (rows.length) { const batch = buildBatchInsert(safeJobId, rows); await client.query(batch.sql, batch.values); }
      await client.query("COMMIT"); transactionStarted = false;
    } catch (error) {
      if (transactionStarted) try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally { client.release(); }
    return artifacts;
  }

  emitMetrics({ safeJobId, rows, itemMetrics, phases, startedAt, succeeded, failurePhase = null }) {
    try {
      this.reportMetrics({ event: "build_artifact_persistence", backend: "artifact_object_store", job_id: safeJobId, succeeded,
        ...(failurePhase ? { failure_phase: failurePhase } : {}), artifact_count: rows.length,
        total_bytes: rows.reduce((total, row) => total + row.metadata.size_bytes, 0), duration_ms: elapsedMs(this.clock, startedAt),
        phases: roundedPhases(phases), artifacts: itemMetrics });
    } catch {}
  }

  async getArtifact(jobId, artifactName) {
    const row = (await this.pool.query(`SELECT artifact_name,content_type,object_key,object_sha256,size_bytes::bigint AS size_bytes,sha256,storage_encoding
      FROM build_artifacts WHERE job_id=$1 AND artifact_name=$2 AND object_key IS NOT NULL
        AND (retention_until IS NULL OR retention_until > NOW())`, [sanitizeJobId(jobId), artifactName])).rows[0];
    if (!row) return null;
    const stored = await this.readObject(row.object_key);
    if (crypto.createHash("sha256").update(stored).digest("hex") !== row.object_sha256) throw new Error("Artifact object integrity check failed.");
    const content = row.storage_encoding === "gzip" ? await gunzip(stored) : stored;
    if (content.length !== Number(row.size_bytes) || crypto.createHash("sha256").update(content).digest("hex") !== row.sha256) {
      throw new Error("Artifact content integrity check failed.");
    }
    return { ...row, size_bytes: Number(row.size_bytes), content_blob: content };
  }

  async pruneExpired() {
    const result = await this.pool.query("DELETE FROM build_artifacts WHERE retention_until IS NOT NULL AND retention_until <= NOW()");
    return { deleted_count: Number(result.rowCount || 0) };
  }
  async close() { await this.pool.end(); }
}

function buildBatchInsert(jobId, rows) {
  const values = [];
  const tuples = rows.map((row) => {
    const offset = values.length;
    const retentionUntil = new Date(Date.now() + row.policy.retentionDays * 86400000);
    values.push(jobId, row.artifactName, contentType(row.artifactName), row.object.key, row.object.sha256,
      row.metadata.size_bytes, row.metadata.sha256, row.metadata.esp_image_sha256, row.encoding, row.storedSizeBytes,
      row.policy.artifactClass, retentionUntil, row.source.sourcePath, row.source.sourceVersion);
    return `($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},NOW(),$${offset+9},$${offset+10},$${offset+11},$${offset+12},$${offset+13},$${offset+14})`;
  });
  return { sql: `INSERT INTO build_artifacts
    (job_id,artifact_name,content_type,object_key,object_sha256,size_bytes,sha256,esp_image_sha256,created_at,storage_encoding,stored_size_bytes,artifact_class,retention_until,source_path,source_version)
    VALUES ${tuples.join(",")}`, values };
}

async function persistObject(root, content) {
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  const key = path.posix.join("objects", sha256.slice(0, 2), sha256);
  const target = resolveObjectPath(root, key);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${crypto.randomUUID()}.partial`;
  try {
    await fs.writeFile(temporary, content, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, target).catch(async (error) => {
      if (error.code !== "EEXIST") throw error;
      await fs.rm(temporary, { force: true });
    });
  } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  return { key, sha256 };
}

function resolveObjectPath(root, objectKey) {
  if (!/^objects\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(String(objectKey || ""))) throw new Error("Invalid artifact object key.");
  return path.join(root, ...objectKey.split("/"));
}

function publicMetadata(baseUrl, jobId, artifactName, metadata) {
  return { file_name: artifactName, size_bytes: metadata.size_bytes, sha256: metadata.sha256,
    ...(artifactName === "firmware.bin" && metadata.esp_image_sha256 ? { esp_image_sha256: metadata.esp_image_sha256 } : {}),
    download_url: baseUrl ? `${baseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`
      : `/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}` };
}
function elapsedMs(clock, startedAt) { return roundMs(Math.max(0, clock() - startedAt)); }
function roundMs(value) { return Math.round(value * 1000) / 1000; }
function roundedPhases(phases) { return Object.fromEntries(Object.entries(phases).map(([key, value]) => [key, roundMs(value)])); }

module.exports = { PostgresArtifactStore, persistObject, resolveObjectPath };
