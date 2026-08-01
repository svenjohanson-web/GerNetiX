const os = require("node:os");
const { BuildDeployError } = require("../errors");
const { buildTargetKey } = require("./build-target-lock");

class PostgresBuildCoordination {
  static async create(options = {}) {
    const { Pool } = require("pg");
    const metadataPool = options.pool || new Pool({ ...options.poolOptions, max: 5 });
    const lockPool = options.lockPool || new Pool({ ...options.poolOptions, max: options.poolMax || 20 });
    const coordination = new PostgresBuildCoordination(
      metadataPool,
      { ...options, lockPool },
    );
    await coordination.migrate();
    await coordination.failJobsFromStaleWorkers();
    await coordination.registerWorker();
    coordination.startHeartbeat();
    return coordination;
  }

  constructor(pool, options = {}) {
    this.pool = pool;
    this.lockPool = options.lockPool || pool;
    this.workerId = String(options.workerId || os.hostname()).trim();
    this.heartbeatMs = Number(options.heartbeatMs || 15000);
    this.staleMs = Number(options.staleMs || 120000);
    this.heartbeatTimer = null;
    this.heartbeatInFlight = null;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS build_workers (
        worker_id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        heartbeat_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS build_execution_jobs (
        job_id TEXT PRIMARY KEY,
        target_key TEXT NOT NULL,
        project_id TEXT,
        software_unit_id TEXT,
        device_id TEXT,
        worker_id TEXT NOT NULL,
        status TEXT NOT NULL,
        state_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        finished_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_build_execution_jobs_target
        ON build_execution_jobs(target_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_build_execution_jobs_status
        ON build_execution_jobs(status, updated_at DESC);
      CREATE TABLE IF NOT EXISTS build_project_cache_epochs (
        project_id TEXT PRIMARY KEY,
        generation BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);
  }

  async registerWorker() {
    await this.pool.query(`
      INSERT INTO build_workers (worker_id, hostname, started_at, heartbeat_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (worker_id) DO UPDATE SET
        hostname = EXCLUDED.hostname,
        started_at = EXCLUDED.started_at,
        heartbeat_at = EXCLUDED.heartbeat_at
    `, [this.workerId, os.hostname()]);
  }

  startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.heartbeatInFlight) return;
      this.heartbeatInFlight = (async () => {
        await this.pool.query("UPDATE build_workers SET heartbeat_at = NOW() WHERE worker_id = $1", [this.workerId]);
        await this.failJobsFromStaleWorkers();
      })().catch((error) => {
        console.error(`Build-Worker-Heartbeat fehlgeschlagen: ${error.message}`);
      }).finally(() => {
        this.heartbeatInFlight = null;
      });
    }, this.heartbeatMs);
    this.heartbeatTimer.unref?.();
  }

  async failJobsFromStaleWorkers() {
    await this.pool.query(`
      UPDATE build_execution_jobs AS jobs SET
        status = 'failed',
        state_json = jsonb_set(
          jsonb_set(jobs.state_json, '{status}', '"failed"'::jsonb, true),
          '{error}',
          '{"code":"worker_lost","message":"Der ausführende Build-Rechner ist nicht mehr erreichbar.","details":{}}'::jsonb,
          true
        ),
        updated_at = NOW(),
        finished_at = NOW()
      FROM build_workers AS workers
      WHERE jobs.worker_id = workers.worker_id
        AND jobs.status IN ('accepted', 'queued', 'running')
        AND workers.heartbeat_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
    `, [this.staleMs]);
  }

  async registerJob(job, state) {
    const result = await this.pool.query(`
      INSERT INTO build_execution_jobs (
        job_id, target_key, project_id, software_unit_id, device_id,
        worker_id, status, state_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
      ON CONFLICT (job_id) DO NOTHING
    `, [
      job.job_id,
      buildTargetKey(job) || `job--${job.job_id}`,
      job.project_id,
      job.software_unit_id || null,
      job.device_id,
      this.workerId,
      job.status,
      JSON.stringify(state),
    ]);
    if (result.rowCount !== 1) {
      throw new BuildDeployError("duplicate_job_id", "Diese BuildJob-ID wurde bereits auf einem Build-Rechner registriert.", 409);
    }
  }

  async saveJob(job, state) {
    const result = await this.pool.query(`
      UPDATE build_execution_jobs SET
        worker_id = $2,
        status = $3,
        state_json = $4::jsonb,
        updated_at = NOW(),
        finished_at = CASE WHEN $3 IN ('succeeded', 'failed', 'replaced') THEN NOW() ELSE NULL END
      WHERE job_id = $1
        AND NOT (
          status = 'failed'
          AND state_json->'error'->>'code' = 'worker_lost'
        )
    `, [job.job_id, this.workerId, job.status, JSON.stringify(state)]);
    if (result.rowCount !== 1) {
      throw new BuildDeployError("job_not_registered", "Der zentral registrierte BuildJob wurde nicht gefunden.", 500);
    }
    await this.pool.query("UPDATE build_workers SET heartbeat_at = NOW() WHERE worker_id = $1", [this.workerId]);
  }

  async getJob(jobId) {
    const result = await this.pool.query(
      "SELECT state_json, worker_id FROM build_execution_jobs WHERE job_id = $1",
      [String(jobId || "")],
    );
    const row = result.rows[0];
    return row ? { ...row.state_json, worker_id: row.worker_id } : null;
  }

  async hasActiveProjectJob(projectId) {
    const result = await this.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM build_execution_jobs
        WHERE project_id = $1 AND status IN ('accepted', 'queued', 'running')
      ) AS active
    `, [String(projectId || "")]);
    return result.rows[0]?.active === true;
  }

  async getProjectCacheEpoch(projectId) {
    if (!projectId) return 0;
    const result = await this.pool.query(
      "SELECT generation::bigint AS generation FROM build_project_cache_epochs WHERE project_id = $1",
      [String(projectId)],
    );
    return Number(result.rows[0]?.generation || 0);
  }

  async bumpProjectCacheEpoch(projectId) {
    const result = await this.pool.query(`
      INSERT INTO build_project_cache_epochs (project_id, generation, updated_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (project_id) DO UPDATE SET
        generation = build_project_cache_epochs.generation + 1,
        updated_at = NOW()
      RETURNING generation::bigint AS generation
    `, [String(projectId)]);
    return Number(result.rows[0].generation);
  }

  async runExclusive(job, task, onWait) {
    const key = buildTargetKey(job);
    if (!key) return task();
    const client = await this.lockPool.connect();
    try {
      const attempt = await client.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
        [key],
      );
      if (!attempt.rows[0]?.acquired) {
        if (typeof onWait === "function") onWait(key);
        await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [key]);
      }
      return await task();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key]).catch(() => {});
      client.release();
    }
  }

  health() {
    return { backend: "postgres", worker_id: this.workerId, distributed: true };
  }

  async close() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    await this.pool.end();
    if (this.lockPool !== this.pool) await this.lockPool.end();
  }
}

module.exports = { PostgresBuildCoordination };
