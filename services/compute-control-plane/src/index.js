"use strict";

const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { InMemoryComputeRepository } = require("./repositories/in-memory-compute-repository");
const { PostgresComputeRepository } = require("./repositories/postgres-compute-repository");
const { ComputeControlPlaneService } = require("./services/compute-control-plane-service");
const { WorkerTokenService } = require("./worker-token-service");
const { CapacityProviderRegistry, CloudBurstCapacityProvider, KubernetesCapacityProvider, PrivateCapacityProvider, StaticCapacityProvider } = require("./capacity-providers");
const { createProjectRuleHandler, executeProjectRule } = require("./project-rule-runtime");
const { ComputeGatewayClient, ComputeWorkerAgent } = require("./worker-agent");
const { ProjectRuntimeGrantService } = require("./project-runtime-grants");
const { deriveComputeAlerts } = require("./operations-alerts");
const { evaluateChaosScenario, evaluateDailyLoadProfile } = require("./load-profile");

async function createDefaultComputeControlPlane(config = createConfig()) {
  const repository = ["postgres", "postgresql"].includes(config.persistenceBackend)
    ? await PostgresComputeRepository.create({ poolOptions: config.postgres.connectionString ? { connectionString: config.postgres.connectionString } : config.postgres })
    : new InMemoryComputeRepository();
  const service = new ComputeControlPlaneService({ repository, leaseTtlMs: config.leaseTtlMs });
  const tokenService = new WorkerTokenService({ secret: config.workerSigningSecret, ttlSeconds: config.workerTokenTtlSeconds });
  const projectRuntimeGrants = new ProjectRuntimeGrantService({ secret: config.projectGrantSigningSecret });
  const providers = new CapacityProviderRegistry([new StaticCapacityProvider(), new PrivateCapacityProvider(), new CloudBurstCapacityProvider({ allowedRegions: ["eu-central-1", "eu-west-1"] }), new KubernetesCapacityProvider()]);
  return { repository, service, tokenService, projectRuntimeGrants, providers };
}

module.exports = { CapacityProviderRegistry, CloudBurstCapacityProvider, ComputeControlPlaneService, ComputeGatewayClient, ComputeWorkerAgent, InMemoryComputeRepository, KubernetesCapacityProvider, PostgresComputeRepository, PrivateCapacityProvider, ProjectRuntimeGrantService, StaticCapacityProvider, WorkerTokenService, createConfig, createDefaultComputeControlPlane, createHttpApp, createProjectRuleHandler, deriveComputeAlerts, evaluateChaosScenario, evaluateDailyLoadProfile, executeProjectRule };
