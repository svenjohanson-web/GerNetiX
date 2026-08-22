import { CIRCUIT_DOCUMENT_CONTRACT } from "./circuit-document-contract.mjs";
import { normalizeSimulationRequest } from "./simulation-request-contract.mjs";
import { SOLVER_RESULT_CONTRACT, normalizeSolverResult } from "./solver-result-contract.mjs";

const WASM_PAGE_BYTES = 64 * 1024;
const MAX_WASM_PAGES = 1_024;

export const SIMULATION_RESOURCE_LIMITS = Object.freeze({
  schemaVersion: "1.0.0",
  maxComponents: CIRCUIT_DOCUMENT_CONTRACT.maxComponents,
  maxNodes: CIRCUIT_DOCUMENT_CONTRACT.maxNodes,
  maxSerializedEngineInputBytes: 16 * 1024,
  maxOutputValues: SOLVER_RESULT_CONTRACT.limits.maxOutputValues,
  maxExecutionMs: 2_000,
  maxMemoryBytes: WASM_PAGE_BYTES * MAX_WASM_PAGES,
});

export const FAKE_WASM_MEMORY_CONTRACT = Object.freeze({
  pageSizeBytes: WASM_PAGE_BYTES,
  initialPages: MAX_WASM_PAGES,
  maximumPages: MAX_WASM_PAGES,
  growthAllowed: false,
  byteLength: WASM_PAGE_BYTES * MAX_WASM_PAGES,
});

const textEncoder = new TextEncoder();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failure(code) {
  return deepFreeze({ ok: false, errors: [{ code }] });
}

function serializedByteLength(value) {
  try {
    return textEncoder.encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function gateSimulationResourceRequest(input) {
  const normalized = normalizeSimulationRequest(input);
  if (!normalized.ok) return failure("ELAB_SIMULATION_RESOURCE_REQUEST_INVALID");
  const { circuit } = normalized.request;
  if (circuit.components.length > SIMULATION_RESOURCE_LIMITS.maxComponents
    || circuit.nodes.length > SIMULATION_RESOURCE_LIMITS.maxNodes
    || serializedByteLength(normalized.request) > SIMULATION_RESOURCE_LIMITS.maxSerializedEngineInputBytes) {
    return failure("ELAB_SIMULATION_RESOURCE_INPUT_LIMIT");
  }
  return deepFreeze({ ok: true, request: normalized.request });
}

export function gateSimulationResourceResult(input) {
  const normalized = normalizeSolverResult(input);
  if (!normalized.ok) return failure("ELAB_SIMULATION_RESOURCE_RESULT_LIMIT");
  return deepFreeze({ ok: true, result: normalized.result });
}

export function createFixedFakeWasmMemory() {
  return Object.freeze({
    ...FAKE_WASM_MEMORY_CONTRACT,
    grow() {
      throw new RangeError("ELAB_SIMULATION_WASM_MEMORY_GROWTH_BLOCKED");
    },
  });
}
