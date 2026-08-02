"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  computeJobProblems,
  createComputeJobContract,
  createWorkerRegistrationContract,
  decideCapacityAction,
  deterministicScheduleJitterMs,
  estimateRequiredSlots,
  orderRunnableJobs,
  usageDimensions,
  workerCanRun,
  workerRegistrationProblems,
} = require("./elastic-compute-contract");

function job(overrides = {}) {
  return {
    job_id: "job-1",
    job_type: "firmware_build",
    execution_class: "trusted_system",
    tenant: { account_id: "account-1", project_id: "project-1" },
    priority_class: "interactive",
    input_revision: "sha256:0123456789abcdef0123456789abcdef",
    requirements: {
      cpu_arch: ["amd64", "arm64"],
      cpu_millis: 2000,
      memory_bytes: 4294967296,
      accelerator: null,
      accelerator_memory_bytes: 0,
      toolchains: ["platformio-6.1.18"],
      network_policy: "artifact_api_only",
    },
    limits: {
      deadline_at: "2026-08-02T12:10:00Z",
      max_runtime_ms: 600000,
      max_output_bytes: 33554432,
      max_attempts: 2,
    },
    ...overrides,
  };
}

function worker(overrides = {}) {
  return createWorkerRegistrationContract({
    worker_id: "worker-home-1",
    instance_id: "instance-1",
    provider: "private-worker",
    region: "home-de",
    trust_zone: "private",
    cpu_arch: "arm64",
    cpu_cores: 12,
    memory_bytes: 68719476736,
    accelerators: [],
    toolchains: ["platformio-6.1.18"],
    execution_classes: ["trusted_system", "isolated_project_rule"],
    slots: { total: 4, free: 2 },
    cost: { currency: "EUR", per_hour_micros: 0 },
    ...overrides,
  });
}

test("creates a provider-neutral allowlisted compute job", () => {
  const contract = createComputeJobContract(job());
  assert.equal(contract.kind, "gernetix_compute_job");
  assert.deepEqual(contract.requirements.cpu_arch, ["amd64", "arm64"]);
  assert.equal(contract.requirements.network_policy, "artifact_api_only");
  assert.equal(Object.hasOwn(contract, "provider"), false);
});

test("rejects database credentials shell commands and nested secrets", () => {
  const problems = computeJobProblems(job({
    database_url: "postgres://forbidden",
    payload: { command: "curl example.invalid", nested: { secret: "forbidden" } },
  }));
  assert.equal(problems.some((item) => item.includes("database_url")), true);
  assert.equal(problems.some((item) => item.includes("payload.command")), true);
  assert.equal(problems.some((item) => item.includes("nested.secret")), true);
  assert.throws(() => createComputeJobContract(job({ token: "forbidden" })), { code: "invalid_compute_job" });
});

test("requires tenant scope and the project runtime API for customer rules", () => {
  const isolated = job({
    job_type: "project_rule_evaluation",
    execution_class: "isolated_project_rule",
    priority_class: "customer_background",
    tenant: { account_id: "", project_id: "" },
    requirements: { ...job().requirements, toolchains: [], network_policy: "none" },
  });
  const problems = computeJobProblems(isolated);
  assert.equal(problems.some((item) => item.includes("account_id und project_id")), true);
  assert.equal(problems.some((item) => item.includes("project_runtime_api_only")), true);
});

test("rejects worker registrations containing credentials or invalid capacity", () => {
  assert.equal(workerRegistrationProblems({
    worker_id: "worker",
    instance_id: "instance",
    provider: "cloud",
    trust_zone: "cloud",
    cpu_arch: "amd64",
    cpu_cores: 8,
    memory_bytes: 1024,
    accelerators: [],
    toolchains: [],
    execution_classes: ["trusted_system"],
    slots: { total: 2, free: 3 },
    cost: { currency: "EUR", per_hour_micros: 1 },
    credentials: { token: "forbidden" },
  }).some((item) => item.includes("verbotenes Feld")), true);
  assert.throws(() => worker({ slots: { total: 1, free: 2 } }), { code: "invalid_worker_registration" });
});

test("matches workers by class architecture memory toolchain accelerator and drain state", () => {
  const build = createComputeJobContract(job());
  assert.deepEqual(workerCanRun(worker(), build), { eligible: true, reasons: [] });
  const mismatch = workerCanRun(worker({
    cpu_arch: "amd64",
    memory_bytes: 1073741824,
    toolchains: [],
    execution_classes: ["trusted_ai"],
    slots: { total: 1, free: 0 },
    draining: true,
  }), build);
  assert.equal(mismatch.eligible, false);
  assert.deepEqual(new Set(mismatch.reasons), new Set([
    "worker_draining",
    "execution_class_missing",
    "memory_insufficient",
    "no_free_slot",
    "toolchain_missing",
  ]));
});

test("requires a matching accelerator kind and memory", () => {
  const aiJob = createComputeJobContract(job({
    job_type: "embedding_index",
    execution_class: "trusted_ai",
    priority_class: "system_background",
    requirements: {
      ...job().requirements,
      accelerator: "nvidia-cuda",
      accelerator_memory_bytes: 17179869184,
      toolchains: [],
      network_policy: "ai_policy_proxy_only",
    },
  }));
  assert.equal(workerCanRun(worker({ execution_classes: ["trusted_ai"] }), aiJob).reasons.includes("accelerator_missing"), true);
  assert.equal(workerCanRun(worker({
    execution_classes: ["trusted_ai"],
    accelerators: [{ kind: "nvidia-cuda", memory_bytes: 25769803776, runtime: "cuda-13" }],
  }), aiJob).eligible, true);
});

test("turns a million daily one-second jobs into measurable slot demand", () => {
  const result = estimateRequiredSlots([{ jobs_per_second: 1000000 / 86400, mean_runtime_ms: 1000 }], { headroom_ratio: 0.25 });
  assert.equal(result.base_concurrency, 11.574);
  assert.equal(result.required_slots, 15);
});

test("scales up for a violated queue SLO but never above the capacity ceiling", () => {
  assert.deepEqual(decideCapacityAction({
    queue: { queued_jobs: 50, oldest_job_age_ms: 15000 },
    required_slots: 12,
    current_slots: 8,
    free_eligible_slots: 2,
    policy: { min_slots: 2, max_slots: 12, target_wait_ms: 5000, provider_enabled: true, budget_available: true },
  }), { action: "scale_up", slots: 4, reason: "queue_slo" });
});

test("uses backpressure when budget or maximum capacity blocks scale-up", () => {
  assert.deepEqual(decideCapacityAction({
    queue: { queued_jobs: 10, oldest_job_age_ms: 10000 },
    required_slots: 8,
    current_slots: 2,
    free_eligible_slots: 0,
    policy: { min_slots: 1, max_slots: 10, target_wait_ms: 1000, provider_enabled: true, budget_available: false },
  }), { action: "backpressure", slots: 0, reason: "budget_exhausted" });
  assert.deepEqual(decideCapacityAction({
    queue: { queued_jobs: 10, oldest_job_age_ms: 10000 },
    required_slots: 8,
    current_slots: 8,
    free_eligible_slots: 0,
    policy: { min_slots: 1, max_slots: 8, target_wait_ms: 1000, provider_enabled: true, budget_available: true },
  }), { action: "backpressure", slots: 0, reason: "capacity_ceiling" });
});

test("drains idle capacity without dropping below the configured base load", () => {
  assert.deepEqual(decideCapacityAction({
    queue: { queued_jobs: 0, oldest_job_age_ms: 0 },
    required_slots: 0,
    current_slots: 6,
    free_eligible_slots: 5,
    policy: { min_slots: 2, max_slots: 20, target_wait_ms: 1000, provider_enabled: true, budget_available: true },
  }), { action: "drain", slots: 3, reason: "idle_capacity" });
});

test("orders equal-priority customer jobs by current tenant activity", () => {
  const ordered = orderRunnableJobs([
    { job_id: "busy", priority_class: "customer_background", tenant: { account_id: "a", project_id: "p" }, due_at: "2026-08-02T10:00:00Z" },
    { job_id: "free", priority_class: "customer_background", tenant: { account_id: "b", project_id: "p" }, due_at: "2026-08-02T10:01:00Z" },
    { job_id: "security", priority_class: "security", tenant: { account_id: "system", project_id: "ops" }, due_at: "2026-08-02T10:02:00Z" },
  ], { "a:p": 4, "b:p": 0, "system:ops": 1 });
  assert.deepEqual(ordered.map((item) => item.job_id), ["security", "free", "busy"]);
});

test("jitters schedules deterministically and keeps usage metrics payload-free", () => {
  const first = deterministicScheduleJitterMs("account-1:project-1:tick", 60000);
  assert.equal(first, deterministicScheduleJitterMs("account-1:project-1:tick", 60000));
  assert.equal(first >= 0 && first < 60000, true);
  const dimensions = usageDimensions({
    job_type: "project_rule_evaluation",
    execution_class: "isolated_project_rule",
    priority_class: "customer_background",
    provider: "cloud",
    trust_zone: "cloud",
    status: "succeeded",
    runtime_ms: 12,
    payload: { private: true },
    patch: { private: true },
  });
  assert.equal(dimensions.runtime_ms, 12);
  assert.equal(Object.hasOwn(dimensions, "payload"), false);
  assert.equal(Object.hasOwn(dimensions, "patch"), false);
});
