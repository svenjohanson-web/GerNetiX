"use strict";

const crypto = require("node:crypto");

const COMPUTE_CONTRACT_VERSION = 1;
const COMPUTE_JOB_KIND = "gernetix_compute_job";
const WORKER_REGISTRATION_KIND = "gernetix_worker_registration";
const EXECUTION_CLASSES = Object.freeze([
  "trusted_system",
  "trusted_ai",
  "isolated_project_rule",
  "operator_maintenance",
]);
const PRIORITY_CLASSES = Object.freeze([
  "security",
  "interactive",
  "system_background",
  "customer_background",
  "maintenance",
]);
const TRUST_ZONES = Object.freeze(["vps", "private", "cloud", "kubernetes"]);
const CPU_ARCHITECTURES = Object.freeze(["amd64", "arm64"]);
const NETWORK_POLICIES = Object.freeze([
  "none",
  "artifact_api_only",
  "project_runtime_api_only",
  "ai_policy_proxy_only",
  "operator_internal_only",
]);
const FORBIDDEN_JOB_FIELDS = Object.freeze(new Set([
  "command",
  "credentials",
  "database_url",
  "databaseUrl",
  "environment",
  "password",
  "private_key",
  "privateKey",
  "secret",
  "secrets",
  "shell",
  "token",
]));
const PRIORITY_ORDER = new Map(PRIORITY_CLASSES.map((value, index) => [value, index]));

function createComputeJobContract(input = {}) {
  const problems = computeJobProblems(input);
  if (problems.length) throw contractError("invalid_compute_job", problems);
  const requirements = input.requirements || {};
  const limits = input.limits || {};
  return {
    kind: COMPUTE_JOB_KIND,
    schema_version: COMPUTE_CONTRACT_VERSION,
    job_id: stringValue(input.job_id),
    job_type: stringValue(input.job_type),
    execution_class: stringValue(input.execution_class),
    tenant: normalizeTenant(input.tenant),
    priority_class: stringValue(input.priority_class),
    input_revision: stringValue(input.input_revision),
    requirements: {
      cpu_arch: uniqueStrings(requirements.cpu_arch),
      cpu_millis: positiveInteger(requirements.cpu_millis, 1000),
      memory_bytes: positiveInteger(requirements.memory_bytes, 268435456),
      accelerator: requirements.accelerator ? stringValue(requirements.accelerator) : null,
      accelerator_memory_bytes: requirements.accelerator
        ? nonNegativeInteger(requirements.accelerator_memory_bytes, 0)
        : 0,
      toolchains: uniqueStrings(requirements.toolchains),
      network_policy: stringValue(requirements.network_policy),
    },
    limits: {
      deadline_at: new Date(limits.deadline_at).toISOString(),
      max_runtime_ms: positiveInteger(limits.max_runtime_ms),
      max_output_bytes: nonNegativeInteger(limits.max_output_bytes, 0),
      max_attempts: positiveInteger(limits.max_attempts, 1),
    },
  };
}

function computeJobProblems(input = {}) {
  const problems = forbiddenFieldProblems(input);
  const requirements = input.requirements || {};
  const limits = input.limits || {};
  if (input.kind !== undefined && input.kind !== COMPUTE_JOB_KIND) problems.push(`kind muss ${COMPUTE_JOB_KIND} sein`);
  if (input.schema_version !== undefined && Number(input.schema_version) !== COMPUTE_CONTRACT_VERSION) problems.push(`schema_version muss ${COMPUTE_CONTRACT_VERSION} sein`);
  if (!stringValue(input.job_id)) problems.push("job_id fehlt");
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(stringValue(input.job_type))) problems.push("job_type ist ungueltig");
  if (!EXECUTION_CLASSES.includes(input.execution_class)) problems.push("execution_class ist ungueltig");
  if (!PRIORITY_CLASSES.includes(input.priority_class)) problems.push("priority_class ist ungueltig");
  if (!/^sha256:[a-f0-9]{16,128}$/i.test(stringValue(input.input_revision))) problems.push("input_revision braucht einen sha256-Hash");
  if (!Array.isArray(requirements.cpu_arch) || requirements.cpu_arch.length === 0 || requirements.cpu_arch.some((item) => !CPU_ARCHITECTURES.includes(item))) problems.push("cpu_arch braucht mindestens amd64 oder arm64");
  if (!isPositiveInteger(requirements.cpu_millis)) problems.push("cpu_millis muss positiv sein");
  if (!isPositiveInteger(requirements.memory_bytes)) problems.push("memory_bytes muss positiv sein");
  if (!NETWORK_POLICIES.includes(requirements.network_policy)) problems.push("network_policy ist ungueltig");
  if (requirements.accelerator && !stringValue(requirements.accelerator)) problems.push("accelerator ist ungueltig");
  if (requirements.accelerator && !isNonNegativeInteger(requirements.accelerator_memory_bytes)) problems.push("accelerator_memory_bytes ist ungueltig");
  if (!Array.isArray(requirements.toolchains)) problems.push("toolchains muss eine Liste sein");
  if (!validTimestamp(limits.deadline_at)) problems.push("deadline_at ist ungueltig");
  if (!isPositiveInteger(limits.max_runtime_ms)) problems.push("max_runtime_ms muss positiv sein");
  if (!isNonNegativeInteger(limits.max_output_bytes)) problems.push("max_output_bytes ist ungueltig");
  if (!isPositiveInteger(limits.max_attempts)) problems.push("max_attempts muss positiv sein");
  if (input.execution_class === "isolated_project_rule") {
    if (!stringValue(input.tenant?.account_id) || !stringValue(input.tenant?.project_id)) problems.push("isolated_project_rule braucht account_id und project_id");
    if (requirements.network_policy !== "project_runtime_api_only") problems.push("isolated_project_rule braucht project_runtime_api_only");
    if (requirements.accelerator) problems.push("isolated_project_rule darf keinen Accelerator verlangen");
  }
  if (input.execution_class === "trusted_ai" && requirements.network_policy !== "ai_policy_proxy_only") problems.push("trusted_ai braucht ai_policy_proxy_only");
  return uniqueStrings(problems);
}

function createWorkerRegistrationContract(input = {}) {
  const problems = workerRegistrationProblems(input);
  if (problems.length) throw contractError("invalid_worker_registration", problems);
  return {
    kind: WORKER_REGISTRATION_KIND,
    schema_version: COMPUTE_CONTRACT_VERSION,
    worker_id: stringValue(input.worker_id),
    instance_id: stringValue(input.instance_id),
    provider: stringValue(input.provider),
    region: stringValue(input.region),
    trust_zone: stringValue(input.trust_zone),
    cpu_arch: stringValue(input.cpu_arch),
    cpu_cores: positiveInteger(input.cpu_cores),
    memory_bytes: positiveInteger(input.memory_bytes),
    accelerators: normalizeAccelerators(input.accelerators),
    toolchains: uniqueStrings(input.toolchains),
    execution_classes: uniqueStrings(input.execution_classes),
    slots: {
      total: positiveInteger(input.slots?.total),
      free: nonNegativeInteger(input.slots?.free, 0),
    },
    cost: {
      currency: stringValue(input.cost?.currency || "EUR").toUpperCase(),
      per_hour_micros: nonNegativeInteger(input.cost?.per_hour_micros, 0),
    },
    draining: input.draining === true,
  };
}

function workerRegistrationProblems(input = {}) {
  const problems = forbiddenFieldProblems(input);
  if (input.kind !== undefined && input.kind !== WORKER_REGISTRATION_KIND) problems.push(`kind muss ${WORKER_REGISTRATION_KIND} sein`);
  if (input.schema_version !== undefined && Number(input.schema_version) !== COMPUTE_CONTRACT_VERSION) problems.push(`schema_version muss ${COMPUTE_CONTRACT_VERSION} sein`);
  if (!stringValue(input.worker_id)) problems.push("worker_id fehlt");
  if (!stringValue(input.instance_id)) problems.push("instance_id fehlt");
  if (!stringValue(input.provider)) problems.push("provider fehlt");
  if (!TRUST_ZONES.includes(input.trust_zone)) problems.push("trust_zone ist ungueltig");
  if (!CPU_ARCHITECTURES.includes(input.cpu_arch)) problems.push("cpu_arch ist ungueltig");
  if (!isPositiveInteger(input.cpu_cores)) problems.push("cpu_cores muss positiv sein");
  if (!isPositiveInteger(input.memory_bytes)) problems.push("memory_bytes muss positiv sein");
  if (!Array.isArray(input.toolchains)) problems.push("toolchains muss eine Liste sein");
  if (!Array.isArray(input.execution_classes) || input.execution_classes.length === 0 || input.execution_classes.some((item) => !EXECUTION_CLASSES.includes(item))) problems.push("execution_classes ist ungueltig");
  if (!isPositiveInteger(input.slots?.total)) problems.push("slots.total muss positiv sein");
  if (!isNonNegativeInteger(input.slots?.free) || Number(input.slots?.free) > Number(input.slots?.total)) problems.push("slots.free ist ungueltig");
  if (!Array.isArray(input.accelerators)) problems.push("accelerators muss eine Liste sein");
  for (const accelerator of Array.isArray(input.accelerators) ? input.accelerators : []) {
    if (!stringValue(accelerator.kind) || !isNonNegativeInteger(accelerator.memory_bytes)) problems.push("accelerator ist ungueltig");
  }
  if (!/^[A-Z]{3}$/.test(stringValue(input.cost?.currency || "EUR").toUpperCase())) problems.push("cost.currency ist ungueltig");
  if (!isNonNegativeInteger(input.cost?.per_hour_micros ?? 0)) problems.push("cost.per_hour_micros ist ungueltig");
  return uniqueStrings(problems);
}

function workerCanRun(worker = {}, job = {}) {
  const reasons = [];
  if (worker.draining) reasons.push("worker_draining");
  if (!worker.execution_classes?.includes(job.execution_class)) reasons.push("execution_class_missing");
  if (!job.requirements?.cpu_arch?.includes(worker.cpu_arch)) reasons.push("cpu_arch_mismatch");
  if (Number(worker.memory_bytes || 0) < Number(job.requirements?.memory_bytes || 0)) reasons.push("memory_insufficient");
  if (Number(worker.slots?.free || 0) < 1) reasons.push("no_free_slot");
  const availableToolchains = new Set(worker.toolchains || []);
  if ((job.requirements?.toolchains || []).some((item) => !availableToolchains.has(item))) reasons.push("toolchain_missing");
  if (job.requirements?.accelerator) {
    const match = (worker.accelerators || []).some((item) => item.kind === job.requirements.accelerator
      && Number(item.memory_bytes || 0) >= Number(job.requirements.accelerator_memory_bytes || 0));
    if (!match) reasons.push("accelerator_missing");
  }
  return { eligible: reasons.length === 0, reasons };
}

function estimateRequiredSlots(samples = [], options = {}) {
  const headroomRatio = finiteRange(options.headroom_ratio, 0.25, 0, 10);
  const baseConcurrency = samples.reduce((sum, sample) => {
    const rate = finiteRange(sample.jobs_per_second, 0, 0, Number.MAX_SAFE_INTEGER);
    const runtimeSeconds = finiteRange(sample.mean_runtime_ms, 0, 0, Number.MAX_SAFE_INTEGER) / 1000;
    return sum + (rate * runtimeSeconds);
  }, 0);
  return {
    base_concurrency: round(baseConcurrency, 3),
    headroom_ratio: headroomRatio,
    required_slots: Math.ceil(baseConcurrency * (1 + headroomRatio)),
  };
}

function decideCapacityAction(input = {}) {
  const policy = input.policy || {};
  const queue = input.queue || {};
  const currentSlots = nonNegativeInteger(input.current_slots, 0);
  const freeEligibleSlots = nonNegativeInteger(input.free_eligible_slots, 0);
  const requiredSlots = nonNegativeInteger(input.required_slots, 0);
  const minSlots = nonNegativeInteger(policy.min_slots, 0);
  const maxSlots = Math.max(minSlots, nonNegativeInteger(policy.max_slots, minSlots));
  const targetWaitMs = positiveInteger(policy.target_wait_ms, 1000);
  const oldestJobAgeMs = nonNegativeInteger(queue.oldest_job_age_ms, 0);
  const queuedJobs = nonNegativeInteger(queue.queued_jobs, 0);
  const scaleLimit = Math.max(0, maxSlots - currentSlots);
  const requested = Math.max(0, requiredSlots - freeEligibleSlots);
  if (queuedJobs > 0 && (policy.kill_switch === true || policy.provider_enabled === false || policy.budget_available === false)) {
    return { action: "backpressure", slots: 0, reason: policy.kill_switch === true ? "kill_switch" : policy.budget_available === false ? "budget_exhausted" : "provider_disabled" };
  }
  if (queuedJobs > 0 && oldestJobAgeMs >= targetWaitMs && requested > 0) {
    const slots = Math.min(requested, scaleLimit);
    return slots > 0
      ? { action: "scale_up", slots, reason: "queue_slo" }
      : { action: "backpressure", slots: 0, reason: "capacity_ceiling" };
  }
  if (queuedJobs === 0 && currentSlots > minSlots && freeEligibleSlots > minSlots) {
    return { action: "drain", slots: Math.min(currentSlots - minSlots, freeEligibleSlots - minSlots), reason: "idle_capacity" };
  }
  return { action: "hold", slots: 0, reason: "within_policy" };
}

function orderRunnableJobs(jobs = [], activeByTenant = {}) {
  return [...jobs].sort((left, right) => {
    const priority = priorityRank(left.priority_class) - priorityRank(right.priority_class);
    if (priority !== 0) return priority;
    const active = tenantActivity(left, activeByTenant) - tenantActivity(right, activeByTenant);
    if (active !== 0) return active;
    const due = timestampValue(left.due_at) - timestampValue(right.due_at);
    if (due !== 0) return due;
    return stringValue(left.job_id).localeCompare(stringValue(right.job_id));
  });
}

function deterministicScheduleJitterMs(scheduleId, windowMs) {
  const window = positiveInteger(windowMs);
  if (!window) return 0;
  const digest = crypto.createHash("sha256").update(stringValue(scheduleId)).digest();
  return digest.readUInt32BE(0) % window;
}

function usageDimensions(input = {}) {
  return {
    job_type: stringValue(input.job_type),
    execution_class: stringValue(input.execution_class),
    priority_class: stringValue(input.priority_class),
    provider: stringValue(input.provider),
    trust_zone: stringValue(input.trust_zone),
    status: stringValue(input.status),
    queue_wait_ms: nonNegativeInteger(input.queue_wait_ms, 0),
    runtime_ms: nonNegativeInteger(input.runtime_ms, 0),
    cpu_millis: nonNegativeInteger(input.cpu_millis, 0),
    accelerator_millis: nonNegativeInteger(input.accelerator_millis, 0),
    input_bytes: nonNegativeInteger(input.input_bytes, 0),
    output_bytes: nonNegativeInteger(input.output_bytes, 0),
    attempts: nonNegativeInteger(input.attempts, 0),
  };
}

function normalizeTenant(tenant = {}) {
  return {
    account_id: stringValue(tenant.account_id),
    project_id: stringValue(tenant.project_id),
  };
}

function normalizeAccelerators(accelerators = []) {
  return accelerators.map((item) => ({
    kind: stringValue(item.kind),
    memory_bytes: nonNegativeInteger(item.memory_bytes, 0),
    runtime: stringValue(item.runtime),
  }));
}

function forbiddenFieldProblems(value, path = "job") {
  if (!value || typeof value !== "object") return [];
  const problems = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_JOB_FIELDS.has(key)) problems.push(`verbotenes Feld: ${childPath}`);
    if (child && typeof child === "object") problems.push(...forbiddenFieldProblems(child, childPath));
  }
  return problems;
}

function tenantActivity(job, activeByTenant) {
  const key = `${stringValue(job.tenant?.account_id)}:${stringValue(job.tenant?.project_id)}`;
  return nonNegativeInteger(activeByTenant[key], 0);
}

function priorityRank(value) {
  return PRIORITY_ORDER.get(value) ?? PRIORITY_CLASSES.length;
}

function timestampValue(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function validTimestamp(value) {
  return Number.isFinite(Date.parse(value || ""));
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(stringValue).filter(Boolean)));
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}

function positiveInteger(value, fallback = 0) {
  return isPositiveInteger(value) ? Number(value) : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return isNonNegativeInteger(value) ? Number(value) : fallback;
}

function finiteRange(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function contractError(code, problems) {
  const error = new Error(problems.join("; "));
  error.code = code;
  error.problems = problems;
  return error;
}

module.exports = {
  COMPUTE_CONTRACT_VERSION,
  COMPUTE_JOB_KIND,
  CPU_ARCHITECTURES,
  EXECUTION_CLASSES,
  NETWORK_POLICIES,
  PRIORITY_CLASSES,
  TRUST_ZONES,
  WORKER_REGISTRATION_KIND,
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
};
