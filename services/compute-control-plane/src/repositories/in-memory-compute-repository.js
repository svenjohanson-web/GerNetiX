"use strict";

const crypto = require("node:crypto");
const { orderRunnableJobs, workerCanRun } = require("../../../shared/elastic-compute-contract");

class InMemoryComputeRepository {
  constructor() {
    this.jobs = new Map();
    this.workers = new Map();
    this.usage = [];
    this.policy = defaultPolicy();
  }

  async addJob(job) {
    if (this.jobs.has(job.job_id)) return null;
    this.jobs.set(job.job_id, clone(job));
    return clone(job);
  }
  async findJob(jobId) { return clone(this.jobs.get(jobId) || null); }
  async listJobs(filter = {}) {
    return [...this.jobs.values()].filter((job) => !filter.status || job.status === filter.status).map(clone);
  }
  async saveWorker(worker, replaceBefore) {
    const current = this.workers.get(worker.worker_id);
    if (current && current.instance_id !== worker.instance_id && Date.parse(current.last_heartbeat_at) >= Date.parse(replaceBefore)) return null;
    this.workers.set(worker.worker_id, clone(worker)); return clone(worker);
  }
  async findWorker(workerId) { return clone(this.workers.get(workerId) || null); }
  async listWorkers() { return [...this.workers.values()].map(clone); }
  async setWorkerDraining(workerId, instanceId, draining, at) {
    const worker = this.workers.get(workerId);
    if (!worker || worker.instance_id !== instanceId) return null;
    Object.assign(worker, { draining, updated_at: at, last_heartbeat_at: at });
    return clone(worker);
  }
  async heartbeat(workerId, instanceId, patch, at) {
    const worker = this.workers.get(workerId);
    if (!worker || worker.instance_id !== instanceId) return null;
    worker.slots = { ...worker.slots, ...(patch.slots || {}) };
    if (typeof patch.draining === "boolean") worker.draining = patch.draining;
    worker.last_heartbeat_at = at;
    worker.updated_at = at;
    return clone(worker);
  }
  async leaseNext(worker, { now, leaseTtlMs }) {
    await this.reclaimExpired(now);
    const activeByTenant = {};
    for (const job of this.jobs.values()) {
      if (job.status !== "leased") continue;
      const key = `${job.tenant.account_id}:${job.tenant.project_id}`;
      activeByTenant[key] = (activeByTenant[key] || 0) + 1;
    }
    const runnable = orderRunnableJobs([...this.jobs.values()].filter((job) => job.status === "queued" && Date.parse(job.limits.deadline_at) > Date.parse(now) && workerCanRun(worker, job).eligible), activeByTenant);
    const job = runnable.find((item) => (activeByTenant[`${item.tenant.account_id}:${item.tenant.project_id}`] || 0) < this.policy.tenant_max_active_jobs);
    if (!job) return null;
    job.status = "leased";
    job.attempts += 1;
    job.lease = {
      lease_id: crypto.randomUUID(), worker_id: worker.worker_id, instance_id: worker.instance_id,
      fencing_token: job.fencing_token + 1, leased_at: now,
      expires_at: new Date(Date.parse(now) + leaseTtlMs).toISOString(),
    };
    job.fencing_token += 1;
    job.updated_at = now;
    return clone(job);
  }
  async renewLease(jobId, identity, leaseId, expiresAt, at) {
    const job = this.jobs.get(jobId);
    if (!currentLease(job, identity, leaseId, at)) return null;
    job.lease.expires_at = expiresAt;
    job.updated_at = at;
    return clone(job);
  }
  async finishJob(jobId, identity, leaseId, result) {
    const job = this.jobs.get(jobId);
    if (!currentLease(job, identity, leaseId, result.finished_at)) return null;
    job.status = result.status;
    job.result = result.result;
    job.failure = result.failure;
    job.finished_at = result.status === "queued" ? null : result.finished_at;
    job.updated_at = result.finished_at;
    job.lease = null;
    return clone(job);
  }
  async cancelJob(jobId, at) {
    const job = this.jobs.get(jobId);
    if (!job || ["succeeded", "failed", "cancelled", "dead_letter"].includes(job.status)) return null;
    job.status = "cancelled"; job.lease = null; job.finished_at = at; job.updated_at = at;
    return clone(job);
  }
  async reclaimExpired(now) {
    let reclaimed = 0;
    for (const job of this.jobs.values()) {
      if (job.status !== "leased" || Date.parse(job.lease.expires_at) > Date.parse(now)) continue;
      job.status = job.attempts >= job.limits.max_attempts ? "dead_letter" : "queued";
      job.failure = { code: "lease_expired", retryable: job.status === "queued" };
      job.lease = null; job.updated_at = now; reclaimed += 1;
    }
    return reclaimed;
  }
  async addUsage(event) { this.usage.push(clone(event)); return clone(event); }
  async listUsage() { return this.usage.map(clone); }
  async operationsState(now, staleMs) {
    const jobs = [...this.jobs.values()];
    const workers = [...this.workers.values()].filter((worker) => Date.parse(now) - Date.parse(worker.last_heartbeat_at) <= staleMs);
    const queued = jobs.filter((job) => job.status === "queued");
    return {
      jobs_by_status: countBy(jobs, "status"), workers_by_provider: countBy(workers, "provider"),
      queued_jobs: queued.length,
      oldest_created_at: queued.sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))[0]?.created_at || null,
      current_slots: workers.reduce((sum, worker) => sum + worker.slots.total, 0),
      free_slots: workers.reduce((sum, worker) => sum + worker.slots.free, 0),
      usage_events: this.usage.length,
    };
  }
  async getPolicy() { return clone(this.policy); }
  async savePolicy(policy) { this.policy = clone(policy); return clone(policy); }
}

function currentLease(job, identity, leaseId, now) {
  return Boolean(job && job.status === "leased" && job.lease?.lease_id === leaseId && job.lease.worker_id === identity.worker_id && job.lease.instance_id === identity.instance_id && Date.parse(job.lease.expires_at) > Date.parse(now));
}
function defaultPolicy() { return { policy_id: "default", min_slots: 0, max_slots: 100, target_wait_ms: 5000, provider_enabled: true, budget_available: true, kill_switch: false, tenant_max_active_jobs: 10, cloud_daily_remaining_micros: 0, cloud_monthly_remaining_micros: 0, allowed_cloud_execution_classes: ["trusted_system"], updated_at: new Date(0).toISOString() }; }
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function countBy(items, key) { return items.reduce((all, item) => ({ ...all, [item[key]]: (all[item[key]] || 0) + 1 }), {}); }

module.exports = { InMemoryComputeRepository, defaultPolicy };
