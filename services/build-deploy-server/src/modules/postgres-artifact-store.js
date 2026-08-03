const fs = require("node:fs/promises");
const { performance } = require("node:perf_hooks");
const { describeContent } = require("./artifact-store");

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
    this.readFile = options.readFile || fs.readFile;
    this.clock = options.clock || (() => performance.now());
    this.reportMetrics = options.reportMetrics || (() => {});
  }
  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS build_artifacts (
        job_id TEXT NOT NULL, artifact_name TEXT NOT NULL, content_type TEXT NOT NULL,
        content_blob BYTEA NOT NULL, size_bytes BIGINT NOT NULL, sha256 TEXT NOT NULL,
        esp_image_sha256 TEXT, created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (job_id,artifact_name)
      );
      CREATE INDEX IF NOT EXISTS idx_build_artifacts_job ON build_artifacts(job_id);
    `);
  }
  async saveBuildArtifacts(jobId, buildOutput) {
    const startedAt = this.clock();
    const safeJobId = sanitizeName(jobId);
    const artifacts = {};
    const rows = [];
    const itemMetrics = [];
    const phases = {
      read_ms: 0,
      hash_ms: 0,
      connect_ms: 0,
      begin_ms: 0,
      delete_ms: 0,
      insert_ms: 0,
      commit_ms: 0,
    };
    let failurePhase = "read";
    let client = null;
    let transactionStarted = false;
    try {
      for (const artifactName of Object.keys(buildOutput.artifacts).sort()) {
        const sourcePath = buildOutput.artifacts[artifactName];
        if (!sourcePath) continue;
        const readStartedAt = this.clock();
        const content = await this.readFile(sourcePath);
        const readMs = elapsedMs(this.clock, readStartedAt);
        const hashStartedAt = this.clock();
        const metadata = describeContent(content);
        const hashMs = elapsedMs(this.clock, hashStartedAt);
        phases.read_ms += readMs;
        phases.hash_ms += hashMs;
        itemMetrics.push({ artifact_name: artifactName, size_bytes: metadata.size_bytes, read_ms: readMs, hash_ms: hashMs });
        rows.push({ artifactName, content, metadata });
        artifacts[artifactName] = {
          file_name: artifactName, size_bytes: metadata.size_bytes, sha256: metadata.sha256,
          ...(artifactName === "firmware.bin" && metadata.esp_image_sha256 ? { esp_image_sha256: metadata.esp_image_sha256 } : {}),
          download_url: this.publicBaseUrl
            ? `${this.publicBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`
            : `/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`,
        };
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
      if (transactionStarted && client) {
        try { await client.query("ROLLBACK"); } catch {}
      }
      this.emitMetrics({ safeJobId, rows, itemMetrics, phases, startedAt, succeeded: false, failurePhase });
      throw error;
    } finally { client?.release(); }
    return artifacts;
  }
  emitMetrics({ safeJobId, rows, itemMetrics, phases, startedAt, succeeded, failurePhase = null }) {
    try {
      this.reportMetrics({
        event: "build_artifact_persistence",
        backend: "postgres",
        job_id: safeJobId,
        succeeded,
        ...(failurePhase ? { failure_phase: failurePhase } : {}),
        artifact_count: rows.length,
        total_bytes: rows.reduce((total, row) => total + row.metadata.size_bytes, 0),
        duration_ms: elapsedMs(this.clock, startedAt),
        phases: roundedPhases(phases),
        artifacts: itemMetrics,
      });
    } catch {
      // Operational metrics must never change the result of artifact persistence.
    }
  }
  async getArtifact(jobId,artifactName) {
    const row=(await this.pool.query(`SELECT artifact_name,content_type,content_blob,size_bytes::bigint AS size_bytes,sha256
      FROM build_artifacts WHERE job_id=$1 AND artifact_name=$2`,[sanitizeName(jobId),artifactName])).rows[0];
    return row?{...row,size_bytes:Number(row.size_bytes),content_blob:Buffer.from(row.content_blob)}:null;
  }
  async close(){await this.pool.end();}
}
function contentType(name){return name==="build.log"?"text/plain; charset=utf-8":"application/octet-stream";}
function sanitizeName(value){return String(value||"").replace(/[^a-zA-Z0-9_.-]/g,"_");}
function buildBatchInsert(jobId, rows) {
  const values = [];
  const tuples = rows.map((row) => {
    const offset = values.length;
    values.push(jobId,row.artifactName,contentType(row.artifactName),row.content,row.metadata.size_bytes,row.metadata.sha256,row.metadata.esp_image_sha256);
    return `($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},NOW())`;
  });
  return {
    sql: `INSERT INTO build_artifacts
      (job_id,artifact_name,content_type,content_blob,size_bytes,sha256,esp_image_sha256,created_at)
      VALUES ${tuples.join(",")}`,
    values,
  };
}
function elapsedMs(clock, startedAt){return roundMs(Math.max(0,clock()-startedAt));}
function roundMs(value){return Math.round(value*1000)/1000;}
function roundedPhases(phases){return Object.fromEntries(Object.entries(phases).map(([key,value])=>[key,roundMs(value)]));}
module.exports={PostgresArtifactStore};
