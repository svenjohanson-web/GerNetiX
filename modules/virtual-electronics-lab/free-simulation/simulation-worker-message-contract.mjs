import { normalizeSimulationRequest } from "./simulation-request-contract.mjs";
import { normalizeSolverResult } from "./solver-result-contract.mjs";

export const SIMULATION_WORKER_MESSAGE_CONTRACT = Object.freeze({
  protocolVersion: "1.0.0",
  requestType: "execute",
  responseTypes: Object.freeze(["completed", "failed"]),
  failureCodes: Object.freeze([
    "ELAB_SIMULATION_PROVIDER_REQUEST_INVALID",
    "ELAB_SIMULATION_PROVIDER_FAILED",
    "ELAB_SIMULATION_PROVIDER_RESULT_INVALID",
    "ELAB_SIMULATION_PROVIDER_RESULT_MISMATCH",
    "ELAB_SIMULATION_WORKER_ALREADY_USED",
    "ELAB_SIMULATION_WORKER_PROTOCOL_INVALID",
  ]),
  maxJobIdLength: 64,
  maxProviderIdentityLength: 64,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validIdentity(value, maximumLength) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function failure() {
  return deepFreeze({ ok: false, error: { code: "ELAB_SIMULATION_WORKER_PROTOCOL_INVALID" } });
}

export function normalizeSimulationWorkerRequestMessage(input) {
  if (!isRecord(input)
    || !hasOnlyKeys(input, ["protocolVersion", "type", "jobId", "request"])
    || input.protocolVersion !== SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion
    || input.type !== SIMULATION_WORKER_MESSAGE_CONTRACT.requestType
    || !validIdentity(input.jobId, SIMULATION_WORKER_MESSAGE_CONTRACT.maxJobIdLength)) return failure();
  const normalizedRequest = normalizeSimulationRequest(input.request);
  if (!normalizedRequest.ok) return failure();
  return deepFreeze({
    ok: true,
    message: {
      protocolVersion: SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion,
      type: "execute",
      jobId: input.jobId,
      request: normalizedRequest.request,
    },
  });
}

export function normalizeSimulationWorkerResponseMessage(input, expectedJobId) {
  if (!isRecord(input)
    || input.protocolVersion !== SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion
    || !validIdentity(input.jobId, SIMULATION_WORKER_MESSAGE_CONTRACT.maxJobIdLength)
    || input.jobId !== expectedJobId
    || !SIMULATION_WORKER_MESSAGE_CONTRACT.responseTypes.includes(input.type)) return failure();

  if (input.type === "failed") {
    if (!hasOnlyKeys(input, ["protocolVersion", "type", "jobId", "errorCode"])
      || !SIMULATION_WORKER_MESSAGE_CONTRACT.failureCodes.includes(input.errorCode)) return failure();
    return deepFreeze({ ok: true, message: { ...input } });
  }

  if (!hasOnlyKeys(input, ["protocolVersion", "type", "jobId", "providerId", "providerVersion", "result"])
    || !validIdentity(input.providerId, SIMULATION_WORKER_MESSAGE_CONTRACT.maxProviderIdentityLength)
    || !validIdentity(input.providerVersion, SIMULATION_WORKER_MESSAGE_CONTRACT.maxProviderIdentityLength)) return failure();
  const normalizedResult = normalizeSolverResult(input.result);
  if (!normalizedResult.ok) return failure();
  return deepFreeze({
    ok: true,
    message: {
      protocolVersion: SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion,
      type: "completed",
      jobId: input.jobId,
      providerId: input.providerId,
      providerVersion: input.providerVersion,
      result: normalizedResult.result,
    },
  });
}
