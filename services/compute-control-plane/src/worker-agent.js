"use strict";

class ComputeGatewayClient {
  constructor({ baseUrl, bootstrapToken, fetchImpl = fetch }) {
    this.baseUrl = String(baseUrl || "").replace(/\/$/, ""); this.bootstrapToken = bootstrapToken; this.fetch = fetchImpl; this.token = "";
  }
  async register(registration) { const body = await this.#request("/api/compute/workers/register", registration, { "x-gernetix-worker-bootstrap-token": this.bootstrapToken }); this.token = body.worker_credential.token; return body; }
  heartbeat(input) { return this.#worker("/api/compute/workers/heartbeat", input); }
  drain(draining = true) { return this.#worker("/api/compute/workers/drain", { draining }); }
  leaseNext() { return this.#worker("/api/compute/workers/leases/next", {}); }
  renew(job) { return this.#worker(`/api/compute/workers/jobs/${encodeURIComponent(job.job_id)}/leases/${encodeURIComponent(job.lease.lease_id)}/renew`, {}); }
  complete(job, output) { return this.#worker(`/api/compute/workers/jobs/${encodeURIComponent(job.job_id)}/leases/${encodeURIComponent(job.lease.lease_id)}/complete`, output); }
  fail(job, failure) { return this.#worker(`/api/compute/workers/jobs/${encodeURIComponent(job.job_id)}/leases/${encodeURIComponent(job.lease.lease_id)}/fail`, failure); }
  #worker(path, body) { return this.#request(path, body, { authorization: `Bearer ${this.token}` }); }
  async #request(path, body, headers) {
    const response = await this.fetch(`${this.baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body || {}) });
    const payload = await response.json();
    if (!response.ok) { const error = new Error(payload.message || payload.error || "Compute Gateway request failed"); error.code = payload.error; error.status = response.status; throw error; }
    return payload;
  }
}

class ComputeWorkerAgent {
  constructor({ client, registration, handlers = {}, renewEveryMs = 20000 }) {
    this.client = client; this.registration = structuredClone(registration); this.handlers = handlers; this.renewEveryMs = renewEveryMs; this.running = false;
  }
  async start() { const registered = await this.client.register(this.registration); this.running = true; return registered; }
  async runOnce() {
    if (!this.running) await this.start();
    await this.client.heartbeat({ slots: this.registration.slots, draining: this.registration.draining === true });
    const leased = await this.client.leaseNext();
    if (!leased.job) return leased;
    const job = leased.job;
    const handler = this.handlers[job.job_type];
    if (!handler) { await this.client.fail(job, { code: "worker_handler_missing", retryable: false }); return { job, status: "failed", reason: "worker_handler_missing" }; }
    this.registration.slots.free = Math.max(0, this.registration.slots.free - 1);
    let renewal;
    try {
      renewal = setInterval(() => this.client.renew(job).catch(() => {}), this.renewEveryMs);
      renewal.unref?.();
      const result = await handler(job);
      await this.client.complete(job, sanitizeOutput(result));
      return { job, status: "succeeded" };
    } catch (error) {
      await this.client.fail(job, { code: safeCode(error.code), retryable: error.retryable === true });
      return { job, status: "failed", reason: safeCode(error.code) };
    } finally {
      if (renewal) clearInterval(renewal);
      this.registration.slots.free = Math.min(this.registration.slots.total, this.registration.slots.free + 1);
      await this.client.heartbeat({ slots: this.registration.slots, draining: this.registration.draining === true });
    }
  }
  async stop() { this.registration.draining = true; await this.client.drain(true); this.running = false; }
}

function sanitizeOutput(value = {}) { return { output_revision: value.output_revision || null, output_bytes: Number.isInteger(value.output_bytes) && value.output_bytes >= 0 ? value.output_bytes : 0 }; }
function safeCode(value) { const code = String(value || "worker_handler_failed"); return /^[a-z][a-z0-9_]{2,79}$/.test(code) ? code : "worker_handler_failed"; }

module.exports = { ComputeGatewayClient, ComputeWorkerAgent };
