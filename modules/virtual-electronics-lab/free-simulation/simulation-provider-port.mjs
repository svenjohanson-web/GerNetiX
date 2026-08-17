import { SIMULATION_REQUEST_CONTRACT, normalizeSimulationRequest } from "./simulation-request-contract.mjs";
import { SOLVER_RESULT_CONTRACT, normalizeSolverResult } from "./solver-result-contract.mjs";

export const SIMULATION_PROVIDER_PORT = Object.freeze({
  schemaVersion: "1.0.0",
  requestSchemaVersion: SIMULATION_REQUEST_CONTRACT.schemaVersion,
  resultSchemaVersion: SOLVER_RESULT_CONTRACT.schemaVersion,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code, message, details = {}) {
  return deepFreeze({ ok: false, errorSource: "simulation-provider-port", errors: [{ code, message, ...details }] });
}

function validProviderDefinition(provider) {
  return provider !== null
    && typeof provider === "object"
    && !Array.isArray(provider)
    && Object.keys(provider).every((key) => ["providerId", "providerVersion", "execute"].includes(key))
    && typeof provider.providerId === "string"
    && provider.providerId.length > 0
    && provider.providerId.length <= 64
    && typeof provider.providerVersion === "string"
    && provider.providerVersion.length > 0
    && provider.providerVersion.length <= 64
    && typeof provider.execute === "function";
}

export function createSimulationProviderPort(provider) {
  if (!validProviderDefinition(provider)) throw new TypeError("ELAB_SIMULATION_PROVIDER_INVALID");
  const providerId = provider.providerId;
  const providerVersion = provider.providerVersion;
  const executeProvider = provider.execute;

  return Object.freeze({
    providerId,
    providerVersion,
    async execute(input) {
      const normalizedRequest = normalizeSimulationRequest(input);
      if (!normalizedRequest.ok) {
        return failure("ELAB_SIMULATION_PROVIDER_REQUEST_INVALID", "Der Providerauftrag ist ungültig.", {
          cause: normalizedRequest.errors[0]?.code || "ELAB_SIMULATION_REQUEST_INVALID",
        });
      }

      let providerOutput;
      try {
        providerOutput = await executeProvider(normalizedRequest.request);
      } catch {
        return failure("ELAB_SIMULATION_PROVIDER_FAILED", "Der Simulationsprovider konnte den Auftrag nicht ausführen.", { providerId });
      }

      const normalizedResult = normalizeSolverResult(providerOutput);
      if (!normalizedResult.ok) {
        return failure("ELAB_SIMULATION_PROVIDER_RESULT_INVALID", "Der Simulationsprovider lieferte kein gültiges Ergebnis.", {
          providerId,
          cause: normalizedResult.errors[0]?.code || "ELAB_SOLVER_RESULT_INVALID",
        });
      }
      if (normalizedResult.result.documentId !== normalizedRequest.request.circuit.id
        || normalizedResult.result.documentVersion !== normalizedRequest.request.circuit.version
        || normalizedResult.result.analysis !== normalizedRequest.request.analysis.type) {
        return failure("ELAB_SIMULATION_PROVIDER_RESULT_MISMATCH", "Das Providerergebnis gehört nicht zum Simulationsauftrag.", { providerId });
      }

      return deepFreeze({ ok: true, providerId, providerVersion, result: normalizedResult.result });
    },
  });
}

export function createFakeSimulationProvider(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)
    || Object.keys(options).some((key) => !["providerId", "providerVersion", "resultFactory"].includes(key))
    || typeof options.resultFactory !== "function") {
    throw new TypeError("ELAB_FAKE_SIMULATION_PROVIDER_INVALID");
  }
  return createSimulationProviderPort({
    providerId: options.providerId || "fake-simulation-provider",
    providerVersion: options.providerVersion || "1.0.0",
    execute: options.resultFactory,
  });
}
