"use strict";

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: boundedInteger(env.PORT, 5700, 1, 65535),
    persistenceBackend: env.COMPUTE_PERSISTENCE_BACKEND || env.PERSISTENCE_BACKEND || "memory",
    internalToken: String(env.COMPUTE_INTERNAL_TOKEN || ""),
    workerBootstrapToken: String(env.COMPUTE_WORKER_BOOTSTRAP_TOKEN || ""),
    workerSigningSecret: String(env.COMPUTE_WORKER_SIGNING_SECRET || ""),
    projectGrantSigningSecret: String(env.COMPUTE_PROJECT_GRANT_SIGNING_SECRET || ""),
    workerTokenTtlSeconds: boundedInteger(env.COMPUTE_WORKER_TOKEN_TTL_SECONDS, 900, 60, 86400),
    leaseTtlMs: boundedInteger(env.COMPUTE_LEASE_TTL_MS, 60000, 5000, 3600000),
    candidateLimit: boundedInteger(env.COMPUTE_CANDIDATE_LIMIT, 100, 1, 1000),
    postgres: {
      connectionString: env.COMPUTE_POSTGRES_URL || "",
      host: env.COMPUTE_POSTGRES_HOST || "127.0.0.1",
      port: boundedInteger(env.COMPUTE_POSTGRES_PORT, 5432, 1, 65535),
      database: env.COMPUTE_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.COMPUTE_POSTGRES_USER || "gernetix_runtime",
      password: env.COMPUTE_POSTGRES_PASSWORD || "",
    },
  };
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

module.exports = { createConfig };
