import { SIMULATION_RESOURCE_LIMITS, gateSimulationResourceRequest } from "./simulation-resource-gate.mjs";
import {
  SIMULATION_WORKER_MESSAGE_CONTRACT,
  normalizeSimulationWorkerResponseMessage,
} from "./simulation-worker-message-contract.mjs";

export const SIMULATION_WORKER_HOST_CONTRACT = Object.freeze({
  schemaVersion: "1.0.0",
  defaultTimeoutMs: SIMULATION_RESOURCE_LIMITS.maxExecutionMs,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code) {
  return deepFreeze({ ok: false, errorSource: "simulation-worker-host", errors: [{ code }] });
}

function validWorker(worker) {
  return worker !== null
    && typeof worker === "object"
    && typeof worker.postMessage === "function"
    && typeof worker.terminate === "function"
    && typeof worker.addEventListener === "function"
    && typeof worker.removeEventListener === "function";
}

function validOptions(options) {
  return options !== null
    && typeof options === "object"
    && !Array.isArray(options)
    && Object.keys(options).every((key) => ["workerFactory", "timeoutMs"].includes(key))
    && typeof options.workerFactory === "function"
    && (options.timeoutMs === undefined || (Number.isFinite(options.timeoutMs)
      && options.timeoutMs > 0
      && options.timeoutMs <= SIMULATION_WORKER_HOST_CONTRACT.defaultTimeoutMs));
}

function validSignal(signal) {
  return signal === undefined || (signal !== null
    && typeof signal === "object"
    && typeof signal.aborted === "boolean"
    && typeof signal.addEventListener === "function"
    && typeof signal.removeEventListener === "function");
}

let nextJobNumber = 1;

export function createSimulationWorkerHost(options) {
  if (!validOptions(options)) throw new TypeError("ELAB_SIMULATION_WORKER_HOST_INVALID");
  const timeoutMs = options.timeoutMs ?? SIMULATION_WORKER_HOST_CONTRACT.defaultTimeoutMs;

  return Object.freeze({
    async execute(input, executionOptions = {}) {
      if (!executionOptions || typeof executionOptions !== "object" || Array.isArray(executionOptions)
        || Object.keys(executionOptions).some((key) => key !== "signal")
        || !validSignal(executionOptions.signal)) throw new TypeError("ELAB_SIMULATION_WORKER_EXECUTION_INVALID");

      const normalizedRequest = gateSimulationResourceRequest(input);
      if (!normalizedRequest.ok) return failure("ELAB_SIMULATION_WORKER_REQUEST_INVALID");
      if (executionOptions.signal?.aborted) return failure("ELAB_SIMULATION_WORKER_ABORTED");

      let worker;
      try {
        worker = options.workerFactory();
      } catch {
        return failure("ELAB_SIMULATION_WORKER_CRASHED");
      }
      if (!validWorker(worker)) {
        try { worker?.terminate?.(); } catch {}
        return failure("ELAB_SIMULATION_WORKER_CRASHED");
      }

      const jobId = `elab-worker-job-${nextJobNumber}`;
      nextJobNumber += 1;

      return new Promise((resolve) => {
        let settled = false;
        let timeoutHandle;

        const settle = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutHandle);
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          executionOptions.signal?.removeEventListener("abort", onAbort);
          try { worker.terminate(); } catch {}
          resolve(result);
        };
        const onMessage = (event) => {
          const normalizedResponse = normalizeSimulationWorkerResponseMessage(event?.data, jobId);
          if (!normalizedResponse.ok) {
            settle(failure("ELAB_SIMULATION_WORKER_PROTOCOL_INVALID"));
            return;
          }
          if (normalizedResponse.message.type === "failed") {
            settle(failure(normalizedResponse.message.errorCode));
            return;
          }
          settle(deepFreeze({
            ok: true,
            providerId: normalizedResponse.message.providerId,
            providerVersion: normalizedResponse.message.providerVersion,
            result: normalizedResponse.message.result,
          }));
        };
        const onError = () => settle(failure("ELAB_SIMULATION_WORKER_CRASHED"));
        const onAbort = () => settle(failure("ELAB_SIMULATION_WORKER_ABORTED"));

        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);
        executionOptions.signal?.addEventListener("abort", onAbort, { once: true });
        timeoutHandle = setTimeout(() => settle(failure("ELAB_SIMULATION_WORKER_TIMEOUT")), timeoutMs);

        try {
          worker.postMessage({
            protocolVersion: SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion,
            type: "execute",
            jobId,
            request: normalizedRequest.request,
          });
        } catch {
          settle(failure("ELAB_SIMULATION_WORKER_CRASHED"));
        }
      });
    },
  });
}
