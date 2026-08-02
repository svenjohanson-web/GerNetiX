"use strict";

const { ComputeError } = require("./errors");

class CapacityProviderRegistry {
  constructor(providers = []) { this.providers = new Map(providers.map((provider) => [provider.id, provider])); }
  plan(providerId, recommendation, policy = {}) {
    const provider = this.providers.get(providerId);
    if (!provider) throw new ComputeError("capacity_provider_not_found", "Kapazitätsanbieter wurde nicht gefunden.", 404);
    return provider.plan(recommendation, policy);
  }
  list() { return [...this.providers.values()].map((provider) => provider.describe()); }
}

class StaticCapacityProvider {
  constructor({ id = "static-private", trustZone = "private" } = {}) { this.id = id; this.trustZone = trustZone; }
  describe() { return { id: this.id, kind: "static", trust_zone: this.trustZone, mutates_external_state: false }; }
  plan(recommendation) { return { provider_id: this.id, mode: "observe", action: recommendation.action, slots: 0, reason: "static_capacity_is_operator_managed" }; }
}

class PrivateCapacityProvider {
  constructor({ id = "private-fleet", maxSlots = 100 } = {}) { this.id = id; this.maxSlots = maxSlots; }
  describe() { return { id: this.id, kind: "private", trust_zone: "private", mutates_external_state: false }; }
  plan(recommendation) { return declarative(this.id, recommendation, this.maxSlots, "set_private_worker_target"); }
}

class CloudBurstCapacityProvider {
  constructor({ id = "cloud-burst", maxSlots = 500, allowedRegions = [] } = {}) { this.id = id; this.maxSlots = maxSlots; this.allowedRegions = allowedRegions; }
  describe() { return { id: this.id, kind: "cloud_burst", trust_zone: "cloud", allowed_regions: this.allowedRegions, mutates_external_state: false }; }
  plan(recommendation, policy = {}) {
    if (!policy.region || (this.allowedRegions.length && !this.allowedRegions.includes(policy.region))) throw new ComputeError("cloud_region_denied", "Cloud-Region ist nicht freigegeben.", 422);
    if (recommendation.action === "scale_up") {
      const allowedClasses = policy.allowed_cloud_execution_classes || [];
      const blockedReason = policy.kill_switch === true ? "kill_switch"
        : policy.provider_enabled !== true ? "provider_disabled"
          : policy.budget_available !== true || Number(policy.cloud_daily_remaining_micros || 0) <= 0 || Number(policy.cloud_monthly_remaining_micros || 0) <= 0 ? "budget_exhausted"
            : !allowedClasses.includes(recommendation.execution_class) ? "execution_class_denied" : "";
      if (blockedReason) return { provider_id: this.id, mode: "blocked", action: "backpressure", slots: 0, reason: blockedReason, region: policy.region, mutates_external_state: false };
    }
    const providerMaximum = Math.min(this.maxSlots, Number.isInteger(policy.max_slots) ? policy.max_slots : this.maxSlots);
    return { ...declarative(this.id, recommendation, providerMaximum, recommendation.action === "drain" ? "terminate_ephemeral_workers" : "launch_ephemeral_workers"), region: policy.region, budget_guard: "validated", credentials: "external_secret_reference_only" };
  }
}

class KubernetesCapacityProvider {
  constructor({ id = "kubernetes", namespace = "gernetix-compute", workerImage = "gernetix/compute-worker:pin-required", maxReplicas = 500 } = {}) { this.id = id; this.namespace = namespace; this.workerImage = workerImage; this.maxReplicas = maxReplicas; }
  describe() { return { id: this.id, kind: "kubernetes", trust_zone: "kubernetes", namespace: this.namespace, mutates_external_state: false }; }
  plan(recommendation) {
    const replicasDelta = Math.min(this.maxReplicas, Math.max(0, recommendation.slots || 0));
    return {
      provider_id: this.id, mode: "declarative_plan", action: recommendation.action,
      workload: {
        apiVersion: "apps/v1", kind: "Deployment",
        metadata: { name: "gernetix-compute-worker", namespace: this.namespace },
        spec: { replicas_delta: recommendation.action === "drain" ? -replicasDelta : replicasDelta, template: { image: this.workerImage, automount_service_account_token: false, read_only_root_filesystem: true, secret_refs: ["compute-worker-bootstrap"] } },
      },
    };
  }
}

function declarative(providerId, recommendation, maximum, operation) {
  return { provider_id: providerId, mode: "declarative_plan", action: recommendation.action, operation, slots: Math.min(maximum, Math.max(0, recommendation.slots || 0)), reason: recommendation.reason, mutates_external_state: false };
}

module.exports = { CapacityProviderRegistry, CloudBurstCapacityProvider, KubernetesCapacityProvider, PrivateCapacityProvider, StaticCapacityProvider };
