"use strict";

const crypto = require("node:crypto");
const {
  createComputeJobContract,
  createWorkerRegistrationContract,
  decideCapacityAction,
  estimateRequiredSlots,
  usageDimensions,
} = require("../../../shared/elastic-compute-contract");
const { ComputeError } = require("../errors");
const { deriveComputeAlerts } = require("../operations-alerts");

class ComputeControlPlaneService {
  constructor({ repository, leaseTtlMs = 60000, now = () => new Date() }) {
    this.repository = repository;
    this.leaseTtlMs = leaseTtlMs;
    this.now = now;
  }

  async submitJob(input) {
    let contract;
    try { contract = createComputeJobContract(input); } catch (error) { throw invalidContract(error); }
    const at = this.#timestamp();
    const saved = await this.repository.addJob({
      ...contract, status: "queued", attempts: 0, fencing_token: 0,
      lease: null, result: null, failure: null, created_at: at, updated_at: at,
    });
    if (!saved) throw new ComputeError("job_already_exists", "Die Compute-Job-ID existiert bereits.", 409);
    return saved;
  }

  async getJob(jobId) { return requireFound(await this.repository.findJob(jobId), "job_not_found", "Compute-Job wurde nicht gefunden."); }
  async listJobs(filter) { return this.repository.listJobs(filter); }

  async registerWorker(input) {
    let contract;
    try { contract = createWorkerRegistrationContract(input); } catch (error) { throw invalidContract(error); }
    const at = this.#timestamp();
    const existing = await this.repository.findWorker(contract.worker_id);
    if (existing && existing.instance_id !== contract.instance_id && isRecent(existing.last_heartbeat_at, at, this.leaseTtlMs * 2)) {
      throw new ComputeError("worker_instance_conflict", "Eine andere aktive Instanz verwendet diese Worker-ID.", 409);
    }
    const saved = await this.repository.saveWorker(
      { ...contract, registered_at: existing?.registered_at || at, last_heartbeat_at: at, updated_at: at },
      new Date(Date.parse(at) - this.leaseTtlMs * 2).toISOString(),
    );
    if (!saved) throw new ComputeError("worker_instance_conflict", "Eine andere aktive Instanz verwendet diese Worker-ID.", 409);
    return saved;
  }

  async heartbeat(identity, patch = {}) {
    validateSlotsPatch(patch.slots);
    return requireFound(await this.repository.heartbeat(identity.worker_id, identity.instance_id, patch, this.#timestamp()), "worker_not_found", "Worker oder Instanz wurde nicht gefunden.");
  }

  async drain(identity, draining = true) {
    const worker = await this.#authenticatedWorker(identity);
    return requireFound(await this.repository.setWorkerDraining(worker.worker_id, worker.instance_id, draining, this.#timestamp()), "worker_not_found", "Worker wurde nicht gefunden.");
  }

  async leaseNext(identity) {
    const worker = await this.#authenticatedWorker(identity);
    if (worker.draining || worker.slots.free < 1) return { job: null, reason: worker.draining ? "worker_draining" : "no_free_slot" };
    const job = await this.repository.leaseNext(worker, { now: this.#timestamp(), leaseTtlMs: this.leaseTtlMs });
    return { job, reason: job ? "leased" : "no_eligible_job" };
  }

  async renewLease(identity, jobId, leaseId) {
    const at = this.#timestamp();
    const expiresAt = new Date(Date.parse(at) + this.leaseTtlMs).toISOString();
    const job = await this.repository.renewLease(jobId, identity, leaseId, expiresAt, at);
    if (!job) throw staleLease();
    return job;
  }

  async complete(identity, jobId, leaseId, input = {}) {
    return this.#finish(identity, jobId, leaseId, "succeeded", { output_revision: optionalRevision(input.output_revision), output_bytes: nonNegative(input.output_bytes) }, null);
  }

  async fail(identity, jobId, leaseId, input = {}) {
    const failure = { code: safeCode(input.code || "worker_job_failed"), retryable: input.retryable === true };
    const current = await this.getJob(jobId);
    const terminalStatus = failure.retryable && current.attempts < current.limits.max_attempts ? "queued" : (current.attempts >= current.limits.max_attempts ? "dead_letter" : "failed");
    return this.#finish(identity, jobId, leaseId, terminalStatus, null, failure);
  }

  async cancel(jobId) { return requireFound(await this.repository.cancelJob(jobId, this.#timestamp()), "job_not_cancellable", "Compute-Job wurde nicht gefunden oder ist bereits abgeschlossen."); }

  async getPolicy() { return this.repository.getPolicy(); }
  async savePolicy(input = {}) {
    const current = await this.repository.getPolicy();
    const policy = {
      ...current,
      min_slots: bounded(input.min_slots, current.min_slots, 0, 100000),
      max_slots: bounded(input.max_slots, current.max_slots, 0, 100000),
      target_wait_ms: bounded(input.target_wait_ms, current.target_wait_ms, 100, 3600000),
      provider_enabled: boolean(input.provider_enabled, current.provider_enabled),
      budget_available: boolean(input.budget_available, current.budget_available),
      kill_switch: boolean(input.kill_switch, current.kill_switch),
      tenant_max_active_jobs: bounded(input.tenant_max_active_jobs, current.tenant_max_active_jobs, 1, 10000),
      cloud_daily_remaining_micros: bounded(input.cloud_daily_remaining_micros, current.cloud_daily_remaining_micros, 0, Number.MAX_SAFE_INTEGER),
      cloud_monthly_remaining_micros: bounded(input.cloud_monthly_remaining_micros, current.cloud_monthly_remaining_micros, 0, Number.MAX_SAFE_INTEGER),
      allowed_cloud_execution_classes: executionClasses(input.allowed_cloud_execution_classes, current.allowed_cloud_execution_classes),
      updated_at: this.#timestamp(),
    };
    if (policy.max_slots < policy.min_slots) throw new ComputeError("invalid_capacity_policy", "max_slots darf nicht kleiner als min_slots sein.");
    return this.repository.savePolicy(policy);
  }

  async operationsSummary(samples = []) {
    const at = this.#timestamp();
    await this.repository.reclaimExpired(at);
    const [state, policy] = await Promise.all([this.repository.operationsState(at, this.leaseTtlMs * 2), this.repository.getPolicy()]);
    const estimate = estimateRequiredSlots(samples);
    const requiredSlots = Math.max(estimate.required_slots, Math.min(state.queued_jobs, policy.max_slots));
    const oldest = state.oldest_created_at ? Math.max(0, Date.parse(at) - Date.parse(state.oldest_created_at)) : 0;
    const summary = {
      generated_at: at,
      jobs_by_status: state.jobs_by_status, workers_by_provider: state.workers_by_provider,
      queue: { queued_jobs: state.queued_jobs, oldest_job_age_ms: oldest },
      capacity: { current_slots: state.current_slots, free_slots: state.free_slots, ...estimate, required_slots: requiredSlots },
      recommendation: decideCapacityAction({ policy, queue: { queued_jobs: state.queued_jobs, oldest_job_age_ms: oldest }, current_slots: state.current_slots, free_eligible_slots: state.free_slots, required_slots: requiredSlots }),
      policy, usage_events: state.usage_events,
    };
    return { ...summary, alerts: deriveComputeAlerts(summary) };
  }

  async #finish(identity, jobId, leaseId, status, result, failure) {
    const at = this.#timestamp();
    const job = await this.repository.finishJob(jobId, identity, leaseId, { status, result, failure, finished_at: at });
    if (!job) throw staleLease();
    await this.repository.addUsage({ usage_id: crypto.randomUUID(), job_id: job.job_id, account_id: job.tenant.account_id, project_id: job.tenant.project_id, created_at: at, ...usageDimensions({ ...job, provider: (await this.repository.findWorker(identity.worker_id))?.provider, trust_zone: (await this.repository.findWorker(identity.worker_id))?.trust_zone, status, attempts: job.attempts, output_bytes: result?.output_bytes }) });
    return job;
  }

  async #authenticatedWorker(identity) {
    const worker = await this.repository.findWorker(identity.worker_id);
    if (!worker || worker.instance_id !== identity.instance_id) throw new ComputeError("worker_not_found", "Worker oder Instanz wurde nicht gefunden.", 404);
    return worker;
  }
  #timestamp() { return this.now().toISOString(); }
}

function invalidContract(error) { return new ComputeError(error.code || "invalid_compute_contract", "Compute-Vertrag ist ungültig.", 422, { problems: error.problems || [error.message] }); }
function staleLease() { return new ComputeError("stale_or_expired_lease", "Lease ist abgelaufen oder gehört zu einer anderen Worker-Instanz.", 409); }
function requireFound(value, code, message) { if (!value) throw new ComputeError(code, message, 404); return value; }
function validateSlotsPatch(slots) { if (!slots) return; if (!Number.isInteger(Number(slots.total)) || Number(slots.total) < 1 || !Number.isInteger(Number(slots.free)) || Number(slots.free) < 0 || Number(slots.free) > Number(slots.total)) throw new ComputeError("invalid_worker_slots", "Worker-Slots sind ungültig.", 422); }
function optionalRevision(value) { if (value == null || value === "") return null; if (!/^sha256:[a-f0-9]{16,128}$/i.test(String(value))) throw new ComputeError("invalid_output_revision", "output_revision braucht einen SHA-256-Hash.", 422); return String(value); }
function nonNegative(value) { const number = Number(value || 0); if (!Number.isInteger(number) || number < 0) throw new ComputeError("invalid_output_bytes", "output_bytes ist ungültig.", 422); return number; }
function safeCode(value) { const code = String(value); return /^[a-z][a-z0-9_]{2,79}$/.test(code) ? code : "worker_job_failed"; }
function bounded(value, fallback, min, max) { if (value === undefined) return fallback; const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new ComputeError("invalid_capacity_policy", "Kapazitätswert ist ungültig.", 422); return number; }
function boolean(value, fallback) { return value === undefined ? fallback : value === true; }
function executionClasses(value, fallback) { if (value === undefined) return fallback; const allowed = new Set(["trusted_system", "trusted_ai", "isolated_project_rule", "operator_maintenance"]); if (!Array.isArray(value) || value.length === 0 || value.some((item) => !allowed.has(item))) throw new ComputeError("invalid_capacity_policy", "Cloud-Ausführungsklassen sind ungültig.", 422); return [...new Set(value)]; }
function isRecent(timestamp, now, windowMs) { return Number.isFinite(Date.parse(timestamp || "")) && Date.parse(now) - Date.parse(timestamp) <= windowMs; }
module.exports = { ComputeControlPlaneService };
