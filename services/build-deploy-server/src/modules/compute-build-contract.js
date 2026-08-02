"use strict";

const crypto = require("node:crypto");
const { createComputeJobContract } = require("../../../shared/elastic-compute-contract");
const { BuildDeployError } = require("../errors");

function createFirmwareBuildComputeJob(buildJob, context = {}, options = {}) {
  if (!buildJob || !["build", "prebuild"].includes(buildJob.mode || "build") || buildJob.deploy?.requested || buildJob.usb_flash?.requested || buildJob.flashbox?.requested) {
    throw new BuildDeployError("compute_job_not_build_only", "Nur reine Builds dürfen an elastische Compute-Worker delegiert werden.", 409);
  }
  const accountId = String(context.account_id || "").trim();
  const projectId = String(context.project_id || buildJob.project_id || "").trim();
  if (!accountId || !projectId) throw new BuildDeployError("compute_job_tenant_missing", "Elastischer Build braucht Account- und Projektzuordnung.", 422);
  const createdAt = Date.parse(buildJob.created_at || "") || Date.now();
  return createComputeJobContract({
    job_id: String(buildJob.job_id), job_type: "firmware_build", execution_class: "trusted_system",
    tenant: { account_id: accountId, project_id: projectId }, priority_class: options.priority_class || "customer_background",
    input_revision: `sha256:${crypto.createHash("sha256").update(stableJson(buildJob.build_package || {})).digest("hex")}`,
    requirements: {
      cpu_arch: options.cpu_arch || ["amd64", "arm64"], cpu_millis: options.cpu_millis || 1000,
      memory_bytes: options.memory_bytes || 536870912, toolchains: options.toolchains || ["platformio-6.1.18"],
      network_policy: "artifact_api_only",
    },
    limits: {
      deadline_at: new Date(createdAt + (options.deadline_ms || 3600000)).toISOString(),
      max_runtime_ms: options.max_runtime_ms || 900000, max_output_bytes: options.max_output_bytes || 134217728,
      max_attempts: options.max_attempts || 2,
    },
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

module.exports = { createFirmwareBuildComputeJob };
