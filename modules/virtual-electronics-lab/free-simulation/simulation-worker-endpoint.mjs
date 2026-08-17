import { SIMULATION_WORKER_MESSAGE_CONTRACT, normalizeSimulationWorkerRequestMessage } from "./simulation-worker-message-contract.mjs";
import { gateSimulationResourceRequest, gateSimulationResourceResult } from "./simulation-resource-gate.mjs";

function validOptions(options) {
  return options !== null
    && typeof options === "object"
    && !Array.isArray(options)
    && Object.keys(options).every((key) => ["provider", "postMessage"].includes(key))
    && options.provider !== null
    && typeof options.provider === "object"
    && typeof options.provider.execute === "function"
    && typeof options.postMessage === "function";
}

function failed(jobId, errorCode) {
  return Object.freeze({
    protocolVersion: SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion,
    type: "failed",
    jobId,
    errorCode,
  });
}

export function createSimulationWorkerEndpoint(options) {
  if (!validOptions(options)) throw new TypeError("ELAB_SIMULATION_WORKER_ENDPOINT_INVALID");
  let used = false;

  return Object.freeze({
    async handleMessage(input) {
      const jobId = typeof input?.jobId === "string" ? input.jobId : "invalid-job";
      if (used) {
        options.postMessage(failed(jobId, "ELAB_SIMULATION_WORKER_ALREADY_USED"));
        return;
      }
      used = true;

      const normalized = normalizeSimulationWorkerRequestMessage(input);
      if (!normalized.ok) {
        options.postMessage(failed(jobId, "ELAB_SIMULATION_WORKER_PROTOCOL_INVALID"));
        return;
      }
      const gatedRequest = gateSimulationResourceRequest(normalized.message.request);
      if (!gatedRequest.ok) {
        options.postMessage(failed(normalized.message.jobId, "ELAB_SIMULATION_WORKER_PROTOCOL_INVALID"));
        return;
      }

      let response;
      try {
        response = await options.provider.execute(gatedRequest.request);
      } catch {
        options.postMessage(failed(normalized.message.jobId, "ELAB_SIMULATION_PROVIDER_FAILED"));
        return;
      }
      if (!response?.ok) {
        const errorCode = response?.errors?.[0]?.code;
        options.postMessage(failed(
          normalized.message.jobId,
          SIMULATION_WORKER_MESSAGE_CONTRACT.failureCodes.includes(errorCode)
            ? errorCode
            : "ELAB_SIMULATION_PROVIDER_FAILED",
        ));
        return;
      }
      const gatedResult = gateSimulationResourceResult(response.result);
      if (!gatedResult.ok) {
        options.postMessage(failed(normalized.message.jobId, "ELAB_SIMULATION_PROVIDER_RESULT_INVALID"));
        return;
      }

      options.postMessage(Object.freeze({
        protocolVersion: SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion,
        type: "completed",
        jobId: normalized.message.jobId,
        providerId: response.providerId,
        providerVersion: response.providerVersion,
        result: gatedResult.result,
      }));
    },
  });
}
