"use strict";

const crypto = require("node:crypto");
const { orderRunnableJobs, workerCanRun } = require("../../../shared/elastic-compute-contract");
const { defaultPolicy } = require("./in-memory-compute-repository");

class PostgresComputeRepository {
  constructor(pool) { this.pool = pool; }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const repository = new PostgresComputeRepository(options.pool || new Pool(options.poolOptions || options));
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS compute_jobs (
        job_id text PRIMARY KEY,
        status text NOT NULL,
        priority_rank integer NOT NULL,
        account_id text NOT NULL,
        project_id text NOT NULL,
        deadline_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_compute_jobs_dispatch
        ON compute_jobs (status, priority_rank, created_at);
      CREATE INDEX IF NOT EXISTS idx_compute_jobs_tenant_status
        ON compute_jobs (account_id, project_id, status);
      CREATE TABLE IF NOT EXISTS compute_workers (
        worker_id text PRIMARY KEY,
        instance_id text NOT NULL,
        provider text NOT NULL,
        last_heartbeat_at timestamptz NOT NULL,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_compute_workers_provider
        ON compute_workers (provider, last_heartbeat_at);
      CREATE TABLE IF NOT EXISTS compute_usage_events (
        usage_id text PRIMARY KEY,
        job_id text NOT NULL,
        account_id text NOT NULL,
        project_id text NOT NULL,
        created_at timestamptz NOT NULL,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_compute_usage_tenant
        ON compute_usage_events (account_id, project_id, created_at);
      CREATE TABLE IF NOT EXISTS compute_capacity_policy (
        policy_id text PRIMARY KEY,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
    `);
    await this.pool.query(`INSERT INTO compute_capacity_policy (policy_id, raw_json, updated_at) VALUES ($1,$2,$3) ON CONFLICT (policy_id) DO NOTHING`, ["default", defaultPolicy(), new Date(0).toISOString()]);
  }

  async addJob(job) {
    const result = await this.pool.query(`
      INSERT INTO compute_jobs (job_id,status,priority_rank,account_id,project_id,deadline_at,created_at,updated_at,raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (job_id) DO NOTHING RETURNING raw_json
    `, [job.job_id, job.status, priorityRank(job.priority_class), job.tenant.account_id, job.tenant.project_id, job.limits.deadline_at, job.created_at, job.updated_at, job]);
    return first(result);
  }
  async findJob(jobId) { return first(await this.pool.query("SELECT raw_json FROM compute_jobs WHERE job_id=$1", [jobId])); }
  async listJobs(filter = {}) {
    return rows(filter.status
      ? await this.pool.query("SELECT raw_json FROM compute_jobs WHERE status=$1 ORDER BY created_at,job_id", [filter.status])
      : await this.pool.query("SELECT raw_json FROM compute_jobs ORDER BY created_at,job_id"));
  }
  async saveWorker(worker, replaceBefore) {
    return first(await this.pool.query(`
      INSERT INTO compute_workers (worker_id,instance_id,provider,last_heartbeat_at,raw_json) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (worker_id) DO UPDATE SET instance_id=EXCLUDED.instance_id,provider=EXCLUDED.provider,last_heartbeat_at=EXCLUDED.last_heartbeat_at,raw_json=EXCLUDED.raw_json
      WHERE compute_workers.instance_id=EXCLUDED.instance_id OR compute_workers.last_heartbeat_at < $6
      RETURNING raw_json
    `, [worker.worker_id, worker.instance_id, worker.provider, worker.last_heartbeat_at, worker, replaceBefore]));
  }
  async findWorker(workerId) { return first(await this.pool.query("SELECT raw_json FROM compute_workers WHERE worker_id=$1", [workerId])); }
  async listWorkers() { return rows(await this.pool.query("SELECT raw_json FROM compute_workers ORDER BY worker_id")); }
  async setWorkerDraining(workerId, instanceId, draining, at) {
    return this.#patchWorker(workerId, instanceId, (worker) => ({ ...worker, draining, updated_at: at, last_heartbeat_at: at }));
  }
  async heartbeat(workerId, instanceId, patch, at) {
    return this.#patchWorker(workerId, instanceId, (worker) => ({ ...worker, slots: { ...worker.slots, ...(patch.slots || {}) }, draining: typeof patch.draining === "boolean" ? patch.draining : worker.draining, last_heartbeat_at: at, updated_at: at }));
  }
  async #patchWorker(workerId, instanceId, mapper) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = first(await client.query("SELECT raw_json FROM compute_workers WHERE worker_id=$1 FOR UPDATE", [workerId]));
      if (!current || (instanceId && current.instance_id !== instanceId)) { await client.query("ROLLBACK"); return null; }
      const worker = mapper(current);
      await client.query("UPDATE compute_workers SET instance_id=$2,provider=$3,last_heartbeat_at=$4,raw_json=$5 WHERE worker_id=$1", [workerId, worker.instance_id, worker.provider, worker.last_heartbeat_at, worker]);
      await client.query("COMMIT");
      return worker;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async leaseNext(worker, { now, leaseTtlMs }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await reclaimExpiredWith(client, now);
      const policy = first(await client.query("SELECT raw_json FROM compute_capacity_policy WHERE policy_id='default'")) || defaultPolicy();
      const activeRows = await client.query("SELECT account_id,project_id,count(*)::int AS count FROM compute_jobs WHERE status='leased' GROUP BY account_id,project_id");
      const activeByTenant = Object.fromEntries(activeRows.rows.map((row) => [`${row.account_id}:${row.project_id}`, Number(row.count)]));
      const candidates = rows(await client.query(`
        SELECT raw_json FROM compute_jobs
        WHERE status='queued' AND deadline_at > $1
        ORDER BY priority_rank,created_at,job_id
        FOR UPDATE SKIP LOCKED LIMIT 100
      `, [now])).filter((job) => workerCanRun(worker, job).eligible)
        .filter((job) => (activeByTenant[`${job.tenant.account_id}:${job.tenant.project_id}`] || 0) < policy.tenant_max_active_jobs);
      const job = orderRunnableJobs(candidates, activeByTenant)[0];
      if (!job) { await client.query("COMMIT"); return null; }
      job.status = "leased"; job.attempts += 1; job.fencing_token += 1; job.updated_at = now;
      job.lease = { lease_id: crypto.randomUUID(), worker_id: worker.worker_id, instance_id: worker.instance_id, fencing_token: job.fencing_token, leased_at: now, expires_at: new Date(Date.parse(now) + leaseTtlMs).toISOString() };
      await saveJob(client, job);
      await client.query("COMMIT");
      return job;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async renewLease(jobId, identity, leaseId, expiresAt, at) {
    return this.#lockedJob(jobId, (job) => {
      if (!currentLease(job, identity, leaseId, at)) return null;
      job.lease.expires_at = expiresAt; job.updated_at = at; return job;
    });
  }
  async finishJob(jobId, identity, leaseId, result) {
    return this.#lockedJob(jobId, (job) => {
      if (!currentLease(job, identity, leaseId, result.finished_at)) return null;
      job.status = result.status; job.result = result.result; job.failure = result.failure; job.finished_at = result.status === "queued" ? null : result.finished_at; job.updated_at = result.finished_at; job.lease = null; return job;
    });
  }
  async cancelJob(jobId, at) {
    return this.#lockedJob(jobId, (job) => {
      if (!job || ["succeeded", "failed", "cancelled", "dead_letter"].includes(job.status)) return null;
      job.status = "cancelled"; job.lease = null; job.finished_at = at; job.updated_at = at; return job;
    });
  }
  async #lockedJob(jobId, mapper) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = first(await client.query("SELECT raw_json FROM compute_jobs WHERE job_id=$1 FOR UPDATE", [jobId]));
      const job = mapper(current);
      if (!job) { await client.query("ROLLBACK"); return null; }
      await saveJob(client, job); await client.query("COMMIT"); return job;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async reclaimExpired(now) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const count = await reclaimExpiredWith(client, now); await client.query("COMMIT"); return count; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async addUsage(event) {
    return first(await this.pool.query(`INSERT INTO compute_usage_events (usage_id,job_id,account_id,project_id,created_at,raw_json) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (usage_id) DO NOTHING RETURNING raw_json`, [event.usage_id, event.job_id, event.account_id, event.project_id, event.created_at, event]));
  }
  async listUsage() { return rows(await this.pool.query("SELECT raw_json FROM compute_usage_events ORDER BY created_at,usage_id")); }
  async operationsState(now, staleMs) {
    const staleAt = new Date(Date.parse(now) - staleMs).toISOString();
    const [jobCounts, workerCounts, capacity, queue, usage] = await Promise.all([
      this.pool.query("SELECT status,count(*)::int AS count FROM compute_jobs GROUP BY status"),
      this.pool.query("SELECT provider,count(*)::int AS count FROM compute_workers WHERE last_heartbeat_at >= $1 GROUP BY provider", [staleAt]),
      this.pool.query("SELECT COALESCE(sum((raw_json->'slots'->>'total')::int),0)::int AS current_slots,COALESCE(sum((raw_json->'slots'->>'free')::int),0)::int AS free_slots FROM compute_workers WHERE last_heartbeat_at >= $1", [staleAt]),
      this.pool.query("SELECT count(*)::int AS queued_jobs,min(created_at) AS oldest_created_at FROM compute_jobs WHERE status='queued'"),
      this.pool.query("SELECT count(*)::int AS count FROM compute_usage_events"),
    ]);
    return {
      jobs_by_status: Object.fromEntries(jobCounts.rows.map((row) => [row.status, Number(row.count)])),
      workers_by_provider: Object.fromEntries(workerCounts.rows.map((row) => [row.provider, Number(row.count)])),
      queued_jobs: Number(queue.rows[0]?.queued_jobs || 0), oldest_created_at: queue.rows[0]?.oldest_created_at || null,
      current_slots: Number(capacity.rows[0]?.current_slots || 0), free_slots: Number(capacity.rows[0]?.free_slots || 0),
      usage_events: Number(usage.rows[0]?.count || 0),
    };
  }
  async getPolicy() { return first(await this.pool.query("SELECT raw_json FROM compute_capacity_policy WHERE policy_id='default'")) || defaultPolicy(); }
  async savePolicy(policy) {
    return first(await this.pool.query(`INSERT INTO compute_capacity_policy (policy_id,raw_json,updated_at) VALUES ($1,$2,$3) ON CONFLICT (policy_id) DO UPDATE SET raw_json=EXCLUDED.raw_json,updated_at=EXCLUDED.updated_at RETURNING raw_json`, [policy.policy_id, policy, policy.updated_at]));
  }
}

async function reclaimExpiredWith(client, now) {
  const result = await client.query("SELECT job_id,raw_json FROM compute_jobs WHERE status='leased' AND (raw_json->'lease'->>'expires_at')::timestamptz <= $1 FOR UPDATE SKIP LOCKED", [now]);
  for (const row of result.rows) {
    const job = row.raw_json;
    job.status = job.attempts >= job.limits.max_attempts ? "dead_letter" : "queued"; job.failure = { code: "lease_expired", retryable: job.status === "queued" }; job.lease = null; job.updated_at = now;
    await saveJob(client, job);
  }
  return result.rowCount;
}
function saveJob(client, job) { return client.query("UPDATE compute_jobs SET status=$2,updated_at=$3,raw_json=$4 WHERE job_id=$1", [job.job_id, job.status, job.updated_at, job]); }
function currentLease(job, identity, leaseId, now) { return Boolean(job && job.status === "leased" && job.lease?.lease_id === leaseId && job.lease.worker_id === identity.worker_id && job.lease.instance_id === identity.instance_id && Date.parse(job.lease.expires_at) > Date.parse(now)); }
function priorityRank(value) { return ({ security: 0, interactive: 1, system_background: 2, customer_background: 3, maintenance: 4 })[value] ?? 9; }
function first(result) { return result.rows[0]?.raw_json || null; }
function rows(result) { return result.rows.map((row) => row.raw_json); }

module.exports = { PostgresComputeRepository };
