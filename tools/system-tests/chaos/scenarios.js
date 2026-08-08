"use strict";

const MIN_DURATION_MS = 100;
const MAX_DURATION_MS = 60_000;
const DEFAULT_DURATION_MS = 5_000;
const FORGEJO_LATENCY_TOXIC = "gernetix_test_forgejo_latency";

const SCENARIOS = Object.freeze({
  forgejo_latency: Object.freeze({ kind: "latency", proxy: "forgejo", latencyMs: 2_000, jitterMs: 0 }),
  forgejo_unavailable: Object.freeze({ kind: "connection_cut", proxy: "forgejo" }),
  postgres_connection_cut: Object.freeze({ kind: "connection_cut", proxy: "postgres" }),
  mqtt_connection_cut: Object.freeze({ kind: "connection_cut", proxy: "mqtt" }),
});
const ALLOWED_SCENARIOS = Object.freeze(Object.keys(SCENARIOS));

function validateDuration(durationMs) {
  if (!Number.isInteger(durationMs) || durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    throw new Error(`durationMs must be an integer between ${MIN_DURATION_MS} and ${MAX_DURATION_MS}`);
  }
  return durationMs;
}

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function recoverWithoutMasking(client, recovery, primaryError) {
  try {
    await recovery();
  } catch (recoveryError) {
    if (primaryError) {
      throw new AggregateError([primaryError, recoveryError], "Chaos scenario and recovery both failed");
    }
    throw recoveryError;
  }
  if (primaryError) throw primaryError;
}

async function runScenario(options) {
  const scenarioName = options?.scenario;
  const definition = SCENARIOS[scenarioName];
  if (!definition) throw new Error(`Unknown chaos scenario: ${scenarioName}`);
  const durationMs = validateDuration(options.durationMs ?? DEFAULT_DURATION_MS);
  const wait = options.wait || delay;
  const client = options.client;
  if (!client || typeof wait !== "function") throw new Error("client and wait are required");

  let primaryError;
  if (definition.kind === "latency") {
    try {
      await client.addToxic(definition.proxy, {
        name: FORGEJO_LATENCY_TOXIC,
        type: "latency",
        stream: "downstream",
        toxicity: 1,
        attributes: { latency: definition.latencyMs, jitter: definition.jitterMs },
      });
      await wait(durationMs);
    } catch (error) {
      primaryError = error;
    } finally {
      await recoverWithoutMasking(
        client,
        () => client.removeToxic(definition.proxy, FORGEJO_LATENCY_TOXIC),
        primaryError,
      );
    }
  } else {
    try {
      await client.setProxyEnabled(definition.proxy, false);
      await wait(durationMs);
    } catch (error) {
      primaryError = error;
    } finally {
      await recoverWithoutMasking(client, () => client.setProxyEnabled(definition.proxy, true), primaryError);
    }
  }

  return Object.freeze({ scenario: scenarioName, duration_ms: durationMs, recovered: true });
}

module.exports = {
  ALLOWED_SCENARIOS,
  DEFAULT_DURATION_MS,
  FORGEJO_LATENCY_TOXIC,
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  SCENARIOS,
  runScenario,
  validateDuration,
};
