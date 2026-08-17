import { simulateFreeDcOperatingPoint } from "./dc-learning-solver-adapter.mjs";
import { normalizeSimulationRequest } from "./simulation-request-contract.mjs";
import { simulateFreeTransient } from "./transient-learning-solver.mjs";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function executeLearningSimulationRequest(input) {
  const normalized = normalizeSimulationRequest(input);
  if (!normalized.ok) {
    return deepFreeze({
      ok: false,
      errorSource: "simulation-request-contract",
      errors: normalized.errors,
    });
  }
  const { circuit, analysis } = normalized.request;
  if (analysis.type === "dc-operating-point") return deepFreeze(simulateFreeDcOperatingPoint(circuit));
  return deepFreeze(simulateFreeTransient(circuit, {
    timeStepS: analysis.timeStepS,
    stopTimeS: analysis.stopTimeS,
  }));
}
