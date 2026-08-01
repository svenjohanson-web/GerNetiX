const fs = require("node:fs/promises");
const { describeFile } = require("./artifact-store");

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
    const artifacts = {};
    const rows = [];
    for (const artifactName of Object.keys(buildOutput.artifacts).sort()) {
      const sourcePath = buildOutput.artifacts[artifactName];
      if (!sourcePath) continue;
      const content = await fs.readFile(sourcePath);
      const metadata = await describeFile(sourcePath);
      rows.push({ artifactName, content, metadata });
      artifacts[artifactName] = {
        file_name: artifactName, size_bytes: metadata.size_bytes, sha256: metadata.sha256,
        ...(artifactName === "firmware.bin" && metadata.esp_image_sha256 ? { esp_image_sha256: metadata.esp_image_sha256 } : {}),
        download_url: this.publicBaseUrl
          ? `${this.publicBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`
          : `/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`,
      };
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM build_artifacts WHERE job_id=$1", [sanitizeName(jobId)]);
      for (const row of rows) await client.query(`
        INSERT INTO build_artifacts
          (job_id,artifact_name,content_type,content_blob,size_bytes,sha256,esp_image_sha256,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      `, [sanitizeName(jobId),row.artifactName,contentType(row.artifactName),row.content,row.metadata.size_bytes,row.metadata.sha256,row.metadata.esp_image_sha256]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    return artifacts;
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
module.exports={PostgresArtifactStore};
