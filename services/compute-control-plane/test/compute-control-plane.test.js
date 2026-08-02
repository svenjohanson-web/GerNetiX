"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CapacityProviderRegistry,
  CloudBurstCapacityProvider,
  ComputeControlPlaneService,
  ComputeWorkerAgent,
  InMemoryComputeRepository,
  KubernetesCapacityProvider,
  PostgresComputeRepository,
  ProjectRuntimeGrantService,
  WorkerTokenService,
  createProjectRuleHandler,
  deriveComputeAlerts,
  evaluateChaosScenario,
  evaluateDailyLoadProfile,
  executeProjectRule,
} = require("../src");

function clock(start = "2026-08-02T08:00:00.000Z") {
  let value = new Date(start);
  return { now: () => new Date(value), advance: (ms) => { value = new Date(value.getTime() + ms); } };
}
function job(overrides = {}) {
  return {
    job_id: overrides.job_id || "job-1", job_type: "firmware_build", execution_class: "trusted_system",
    tenant: { account_id: "account-a", project_id: "project-a" }, priority_class: "customer_background",
    input_revision: "sha256:0123456789abcdef", requirements: { cpu_arch: ["amd64", "arm64"], cpu_millis: 1000, memory_bytes: 1024, toolchains: ["platformio-6"], network_policy: "artifact_api_only" },
    limits: { deadline_at: "2026-08-03T08:00:00.000Z", max_runtime_ms: 60000, max_output_bytes: 4096, max_attempts: 2 }, ...overrides,
  };
}
function worker(overrides = {}) {
  return {
    worker_id: overrides.worker_id || "worker-a", instance_id: overrides.instance_id || "instance-a", provider: "private-home", region: "de-home", trust_zone: "private", cpu_arch: "arm64", cpu_cores: 8, memory_bytes: 16_000_000_000,
    accelerators: [], toolchains: ["platformio-6"], execution_classes: ["trusted_system", "isolated_project_rule"], slots: { total: 4, free: 4 }, cost: { currency: "EUR", per_hour_micros: 120000 }, draining: false, ...overrides,
  };
}

test("job lifecycle fences late worker results", async () => {
  const time = clock();
  const repository = new InMemoryComputeRepository();
  const service = new ComputeControlPlaneService({ repository, leaseTtlMs: 10000, now: time.now });
  await service.submitJob(job());
  await service.registerWorker(worker());
  const identity = { worker_id: "worker-a", instance_id: "instance-a" };
  const first = (await service.leaseNext(identity)).job;
  assert.equal(first.status, "leased");
  time.advance(10001);
  await repository.reclaimExpired(time.now().toISOString());
  const second = (await service.leaseNext(identity)).job;
  assert.equal(second.lease.fencing_token, 2);
  await assert.rejects(() => service.complete(identity, first.job_id, first.lease.lease_id, {}), { code: "stale_or_expired_lease" });
  assert.equal((await service.complete(identity, second.job_id, second.lease.lease_id, { output_revision: "sha256:fedcba9876543210", output_bytes: 12 })).status, "succeeded");
  assert.equal((await repository.listUsage()).length, 1);
});

test("repeated worker loss stops at max_attempts instead of creating a retry storm", async () => {
  const time = clock(); const repository = new InMemoryComputeRepository();
  const service = new ComputeControlPlaneService({ repository, leaseTtlMs: 5000, now: time.now });
  await service.submitJob(job({ job_id: "retry-storm", limits: { ...job().limits, max_attempts: 2 } }));
  await service.registerWorker(worker());
  const identity = { worker_id: "worker-a", instance_id: "instance-a" };
  await service.leaseNext(identity); time.advance(5001); await repository.reclaimExpired(time.now().toISOString());
  await service.leaseNext(identity); time.advance(5001); await repository.reclaimExpired(time.now().toISOString());
  assert.equal((await service.getJob("retry-storm")).status, "dead_letter");
  assert.equal((await service.leaseNext(identity)).job, null);
});

test("tenant fairness selects tenant with fewer active leases", async () => {
  const time = clock();
  const repository = new InMemoryComputeRepository();
  const service = new ComputeControlPlaneService({ repository, now: time.now });
  await service.registerWorker(worker());
  await service.submitJob(job({ job_id: "a-1" }));
  await service.submitJob(job({ job_id: "a-2" }));
  await service.submitJob(job({ job_id: "b-1", tenant: { account_id: "account-b", project_id: "project-b" } }));
  const identity = { worker_id: "worker-a", instance_id: "instance-a" };
  assert.equal((await service.leaseNext(identity)).job.job_id, "a-1");
  assert.equal((await service.leaseNext(identity)).job.job_id, "b-1");
});

test("tenant parallel quota creates backpressure without blocking another tenant", async () => {
  const repository = new InMemoryComputeRepository();
  const service = new ComputeControlPlaneService({ repository });
  await service.savePolicy({ tenant_max_active_jobs: 1 });
  await service.registerWorker(worker());
  await service.submitJob(job({ job_id: "tenant-a-1" }));
  await service.submitJob(job({ job_id: "tenant-a-2" }));
  await service.submitJob(job({ job_id: "tenant-b-1", tenant: { account_id: "account-b", project_id: "project-b" } }));
  const identity = { worker_id: "worker-a", instance_id: "instance-a" };
  assert.equal((await service.leaseNext(identity)).job.job_id, "tenant-a-1");
  assert.equal((await service.leaseNext(identity)).job.job_id, "tenant-b-1");
  assert.equal((await service.leaseNext(identity)).job, null);
});

test("concurrent lease requests never assign one job twice", async () => {
  const repository = new InMemoryComputeRepository(); const service = new ComputeControlPlaneService({ repository });
  for (let index = 0; index < 100; index += 1) await service.submitJob(job({ job_id: `parallel-${index}` }));
  const identities = [];
  for (let index = 0; index < 20; index += 1) { const registration = worker({ worker_id: `worker-${index}`, instance_id: `instance-${index}` }); await service.registerWorker(registration); identities.push({ worker_id: registration.worker_id, instance_id: registration.instance_id }); }
  const leased = await Promise.all(identities.map((identity) => service.leaseNext(identity)));
  const ids = leased.map((result) => result.job?.job_id).filter(Boolean);
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, ids.length);
});

test("draining and incompatible workers do not receive jobs", async () => {
  const service = new ComputeControlPlaneService({ repository: new InMemoryComputeRepository() });
  await service.submitJob(job());
  await service.registerWorker(worker({ draining: true }));
  assert.equal((await service.leaseNext({ worker_id: "worker-a", instance_id: "instance-a" })).reason, "worker_draining");
});

test("an active worker id cannot be taken over by another instance", async () => {
  const time = clock();
  const service = new ComputeControlPlaneService({ repository: new InMemoryComputeRepository(), leaseTtlMs: 10000, now: time.now });
  await service.registerWorker(worker());
  await assert.rejects(() => service.registerWorker(worker({ instance_id: "instance-b" })), { code: "worker_instance_conflict" });
  time.advance(20001);
  assert.equal((await service.registerWorker(worker({ instance_id: "instance-b" }))).instance_id, "instance-b");
});

test("worker tokens are signed, scoped to an instance and expire", () => {
  const time = clock();
  const tokens = new WorkerTokenService({ secret: "test-signing-secret", ttlSeconds: 60, now: () => time.now().getTime() });
  const issued = tokens.issue(worker());
  assert.deepEqual(tokens.verify(issued.token), { worker_id: "worker-a", instance_id: "instance-a", exp: 1785657660 });
  assert.throws(() => tokens.verify(`${issued.token}x`), { code: "worker_access_denied" });
  time.advance(60001);
  assert.throws(() => tokens.verify(issued.token), { code: "worker_access_denied" });
});

test("project rule runtime only reads and writes granted paths", () => {
  const result = executeProjectRule({ statements: [{ type: "if", condition: { type: "binary", op: "gt", left: { type: "read", path: "sensor.temperature" }, right: { type: "literal", value: 25 } }, then: [{ type: "set", path: "actuator.fan", value: { type: "literal", value: true } }] }] }, { sensor: { temperature: 28 } }, { read_paths: ["sensor.temperature"], write_paths: ["actuator.fan"] });
  assert.deepEqual(result.patch, { actuator: { fan: true } });
  assert.throws(() => executeProjectRule({ statements: [{ type: "set", path: "other.tenant", value: { type: "literal", value: true } }] }, {}, { write_paths: ["actuator.fan"] }), { code: "write_path_denied" });
});

test("project rule runtime rejects unknown statements and excessive depth", () => {
  assert.throws(() => executeProjectRule({ statements: [{ type: "shell", command: "anything" }] }, {}, {}), { code: "invalid_project_rule" });
  const nested = { type: "not", value: { type: "not", value: { type: "literal", value: true } } };
  assert.throws(() => executeProjectRule({ statements: [{ type: "if", condition: nested, then: [] }] }, {}, {}, { maxDepth: 2 }), { code: "project_rule_depth_limit" });
});

test("capacity providers create plans without external mutation or embedded secrets", () => {
  const registry = new CapacityProviderRegistry([new CloudBurstCapacityProvider({ allowedRegions: ["eu-central-1"] }), new KubernetesCapacityProvider({ workerImage: "registry/worker@sha256:123" })]);
  const cloudPolicy = { region: "eu-central-1", provider_enabled: true, budget_available: true, cloud_daily_remaining_micros: 1000000, cloud_monthly_remaining_micros: 10000000, max_slots: 50, allowed_cloud_execution_classes: ["trusted_system"] };
  const cloud = registry.plan("cloud-burst", { action: "scale_up", slots: 12, reason: "queue_slo", execution_class: "trusted_system" }, cloudPolicy);
  assert.equal(cloud.mutates_external_state, false);
  assert.equal(cloud.slots, 12);
  const kubernetes = registry.plan("kubernetes", { action: "scale_up", slots: 5 });
  assert.equal(kubernetes.workload.spec.template.automount_service_account_token, false);
  assert.equal(JSON.stringify(kubernetes).includes("password"), false);
});

test("cloud burst refuses a scale plan when kill switch, budget or class policy blocks it", () => {
  const provider = new CloudBurstCapacityProvider({ allowedRegions: ["eu-central-1"] });
  const recommendation = { action: "scale_up", slots: 100, execution_class: "isolated_project_rule" };
  const base = { region: "eu-central-1", provider_enabled: true, budget_available: true, cloud_daily_remaining_micros: 1, cloud_monthly_remaining_micros: 1, allowed_cloud_execution_classes: ["trusted_system"] };
  assert.equal(provider.plan(recommendation, base).reason, "execution_class_denied");
  assert.equal(provider.plan({ ...recommendation, execution_class: "trusted_system" }, { ...base, kill_switch: true }).reason, "kill_switch");
  assert.equal(provider.plan({ ...recommendation, execution_class: "trusted_system" }, { ...base, cloud_daily_remaining_micros: 0 }).reason, "budget_exhausted");
});

test("operations summary returns a bounded capacity recommendation", async () => {
  const time = clock();
  const service = new ComputeControlPlaneService({ repository: new InMemoryComputeRepository(), now: time.now });
  await service.submitJob(job());
  time.advance(6000);
  const summary = await service.operationsSummary([{ jobs_per_second: 2, mean_runtime_ms: 1000 }]);
  assert.equal(summary.queue.queued_jobs, 1);
  assert.equal(summary.capacity.required_slots, 3);
  assert.equal(summary.recommendation.action, "scale_up");
  assert.deepEqual(summary.alerts.map((alert) => alert.code), ["compute_capacity_unavailable", "compute_queue_slo_violated"]);
});

test("reference worker heartbeats, executes a registered handler and reports completion", async () => {
  const calls = [];
  const leasedJob = { job_id: "worker-job", job_type: "firmware_build", lease: { lease_id: "lease-1" } };
  const client = {
    async register(value) { calls.push(["register", value.worker_id]); return { worker: value }; },
    async heartbeat(value) { calls.push(["heartbeat", value.slots.free]); },
    async leaseNext() { calls.push(["lease"]); return { job: leasedJob }; },
    async complete(value, output) { calls.push(["complete", value.job_id, output.output_revision]); },
    async fail() { calls.push(["fail"]); },
    async renew() {}, async drain() {},
  };
  const agent = new ComputeWorkerAgent({ client, registration: worker(), handlers: { firmware_build: async () => ({ output_revision: "sha256:fedcba9876543210", output_bytes: 12 }) } });
  assert.equal((await agent.runOnce()).status, "succeeded");
  assert.deepEqual(calls.map((item) => item[0]), ["register", "heartbeat", "lease", "complete", "heartbeat"]);
  assert.equal(calls.at(-1)[1], 4);
});

test("project-rule handler resolves immutable input and publishes only a tenant-scoped patch", async () => {
  const published = [];
  const handler = createProjectRuleHandler({
    async inputResolver(reference) {
      assert.deepEqual(reference.tenant, { account_id: "account-a", project_id: "project-a" });
      return { program: { statements: [{ type: "set", path: "actuator.fan", value: { type: "literal", value: true } }] }, snapshot: {}, grant: { write_paths: ["actuator.fan"] } };
    },
    async outputPublisher(output) { published.push(output); return { output_revision: "sha256:aaaaaaaaaaaaaaaa", output_bytes: 20 }; },
  });
  const result = await handler({ ...job(), execution_class: "isolated_project_rule", tenant: { account_id: "account-a", project_id: "project-a" } });
  assert.equal(result.output_revision, "sha256:aaaaaaaaaaaaaaaa");
  assert.deepEqual(published[0].patch, { actuator: { fan: true } });
});

test("PostgreSQL dispatch locks candidates with SKIP LOCKED before assigning a lease", async () => {
  const queued = { ...job(), status: "queued", attempts: 0, fencing_token: 0, created_at: "2026-08-02T08:00:00.000Z", updated_at: "2026-08-02T08:00:00.000Z", lease: null };
  const sql = [];
  const client = {
    async query(statement) {
      const normalized = statement.replace(/\s+/g, " ").trim().toLowerCase(); sql.push(normalized);
      if (normalized.includes("from compute_capacity_policy")) return { rows: [{ raw_json: { tenant_max_active_jobs: 10 } }], rowCount: 1 };
      if (normalized.includes("group by account_id")) return { rows: [], rowCount: 0 };
      if (normalized.includes("from compute_jobs") && normalized.includes("status='queued'")) return { rows: [{ raw_json: structuredClone(queued) }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const repository = new PostgresComputeRepository({ connect: async () => client });
  const leased = await repository.leaseNext(worker(), { now: "2026-08-02T08:01:00.000Z", leaseTtlMs: 60000 });
  assert.equal(leased.status, "leased");
  assert.equal(leased.fencing_token, 1);
  assert.equal(sql.some((statement) => statement.includes("for update skip locked")), true);
  assert.equal(sql.at(-1), "commit");
});

test("project runtime grants bind tenant, revision, expiry and patch paths", async () => {
  const time = clock();
  const grants = new ProjectRuntimeGrantService({ secret: "project-grant-secret", now: () => time.now().getTime(), maxTtlSeconds: 60 });
  const issued = grants.issue({ account_id: "account-a", project_id: "project-a", input_revision: "sha256:0123456789abcdef", write_paths: ["actuator.fan"], read_paths: ["sensor.temperature"], ttl_seconds: 30 });
  const writes = [];
  await grants.applyPatch({ token: issued.token, account_id: "account-a", project_id: "project-a", input_revision: "sha256:0123456789abcdef", patch: { actuator: { fan: true } } }, async (value) => { writes.push(value); return { status: "applied" }; });
  assert.equal(writes.length, 1);
  await assert.rejects(() => grants.applyPatch({ token: issued.token, account_id: "account-b", project_id: "project-a", input_revision: "sha256:0123456789abcdef", patch: {} }, async () => {}), { code: "project_grant_scope_mismatch" });
  await assert.rejects(() => grants.applyPatch({ token: issued.token, account_id: "account-a", project_id: "project-a", input_revision: "sha256:0123456789abcdef", patch: { actuator: { heater: true } } }, async () => {}), { code: "project_patch_path_denied" });
  time.advance(30001);
  assert.throws(() => grants.verify(issued.token, { account_id: "account-a", project_id: "project-a", input_revision: "sha256:0123456789abcdef" }), { code: "project_grant_expired" });
});

test("million-job profiles remain calculable for 100ms, 1s and 10s work", () => {
  const profiles = [100, 1000, 10000].map((mean_runtime_ms) => evaluateDailyLoadProfile({ daily_jobs: 1_000_000, mean_runtime_ms, peak_factor: 4, headroom_ratio: 0.25, available_slots: 600 }));
  assert.deepEqual(profiles.map((profile) => profile.peak_required_slots), [6, 58, 579]);
  assert.equal(profiles.every((profile) => profile.stable_at_peak), true);
  assert.equal(evaluateDailyLoadProfile({ daily_jobs: 1_000_000, mean_runtime_ms: 10000, peak_factor: 4, available_slots: 100 }).missing_peak_slots > 400, true);
});

test("worker and provider loss requests burst or deterministic backpressure without losing jobs", () => {
  assert.deepEqual(evaluateChaosScenario({ healthy_slots: 100, lost_slots: 80, required_slots: 50, cloud_allowed: true }).action, "request_burst");
  const blocked = evaluateChaosScenario({ healthy_slots: 100, lost_slots: 80, required_slots: 50, cloud_allowed: false });
  assert.equal(blocked.action, "backpressure");
  assert.equal(blocked.jobs_are_lost, false);
  assert.equal(blocked.expired_leases_are_requeued, true);
});

test("operations alerts stay payload-free for missing capacity, queue SLO and kill switch", () => {
  const alerts = deriveComputeAlerts({ queue: { queued_jobs: 20, oldest_job_age_ms: 10000 }, capacity: { current_slots: 0 }, recommendation: { reason: "budget_exhausted" }, policy: { target_wait_ms: 5000, kill_switch: true } });
  assert.deepEqual(alerts.map((alert) => alert.code), ["compute_capacity_unavailable", "compute_queue_slo_violated", "compute_cloud_budget_exhausted", "compute_cloud_kill_switch"]);
  assert.equal(alerts.every((alert) => alert.payload_included === false), true);
});
