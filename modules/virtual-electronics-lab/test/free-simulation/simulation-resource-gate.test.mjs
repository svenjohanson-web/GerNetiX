import assert from "node:assert/strict";
import test from "node:test";

import { CIRCUIT_DOCUMENT_CONTRACT } from "../../free-simulation/circuit-document-contract.mjs";
import { createFreeDcDividerDocument } from "../../free-simulation/free-circuit-presets.mjs";
import {
  FAKE_WASM_MEMORY_CONTRACT,
  SIMULATION_RESOURCE_LIMITS,
  createFixedFakeWasmMemory,
  gateSimulationResourceRequest,
  gateSimulationResourceResult,
} from "../../free-simulation/simulation-resource-gate.mjs";
import { createSimulationWorkerEndpoint } from "../../free-simulation/simulation-worker-endpoint.mjs";
import { SIMULATION_WORKER_HOST_CONTRACT, createSimulationWorkerHost } from "../../free-simulation/simulation-worker-host.mjs";
import { SOLVER_RESULT_CONTRACT } from "../../free-simulation/solver-result-contract.mjs";

function dcRequest(circuit = createFreeDcDividerDocument()) {
  return { schemaVersion: "1.0.0", circuit, analysis: { type: "dc-operating-point" } };
}

function solverResult(request, overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    requestSchemaVersion: request.schemaVersion,
    documentId: request.circuit.id,
    documentVersion: request.circuit.version,
    analysis: request.analysis.type,
    axis: { kind: "operating-point", unit: "index", values: [0] },
    nodes: request.circuit.nodes.map((node) => ({ nodeId: node.id, values: [{ voltageV: 0 }] })),
    branches: [],
    models: [{ modelId: "resource-fake", modelVersion: "1.0.0" }],
    diagnostics: [],
    ...overrides,
  };
}

function oversizedValidCircuit() {
  const fixedId = (prefix, index) => `${prefix}-${index}-${"x".repeat(64)}`.slice(0, 64);
  const nodes = Array.from({ length: CIRCUIT_DOCUMENT_CONTRACT.maxNodes }, (_, index) => ({
    id: fixedId("node", index),
    label: `Messknoten-${index}-${"x".repeat(80)}`.slice(0, 80),
  }));
  const components = Array.from({ length: CIRCUIT_DOCUMENT_CONTRACT.maxComponents }, (_, index) => ({
    id: fixedId("resistor", index),
    type: "resistor",
    ports: [
      { id: "p", nodeId: nodes[index].id },
      { id: "n", nodeId: nodes[index + 1].id },
    ],
    parameters: { resistance: { value: 1_000, unit: "Ω" } },
  }));
  return {
    schemaVersion: "1.0.0",
    id: "oversized-circuit",
    version: "1.0.0",
    nodes,
    components,
    modelLimits: { maxVoltageV: 24, maxCurrentA: 5 },
  };
}

function fakeWorkerFactory(records) {
  return () => {
    const listeners = { message: new Set(), error: new Set() };
    const worker = {
      terminated: false,
      addEventListener(type, listener) { listeners[type].add(listener); },
      removeEventListener(type, listener) { listeners[type].delete(listener); },
      terminate() { this.terminated = true; },
      postMessage(message) { records.push(message); },
    };
    return worker;
  };
}

test("SPICE-008: Grenzen sind an Dokument- und Ergebnisverträge gekoppelt", () => {
  assert.equal(SIMULATION_RESOURCE_LIMITS.maxComponents, CIRCUIT_DOCUMENT_CONTRACT.maxComponents);
  assert.equal(SIMULATION_RESOURCE_LIMITS.maxNodes, CIRCUIT_DOCUMENT_CONTRACT.maxNodes);
  assert.equal(SIMULATION_RESOURCE_LIMITS.maxSerializedEngineInputBytes, 16 * 1024);
  assert.equal(SIMULATION_RESOURCE_LIMITS.maxOutputValues, SOLVER_RESULT_CONTRACT.limits.maxOutputValues);
  assert.equal(SIMULATION_RESOURCE_LIMITS.maxExecutionMs, 2_000);
  assert.equal(SIMULATION_WORKER_HOST_CONTRACT.defaultTimeoutMs, SIMULATION_RESOURCE_LIMITS.maxExecutionMs);
  assert.equal(SIMULATION_RESOURCE_LIMITS.maxMemoryBytes, 64 * 1024 * 1024);
  assert.equal(Object.isFrozen(SIMULATION_RESOURCE_LIMITS), true);
});

test("SPICE-008: malformed und übergroße Engineeingaben werden fail-closed abgewiesen", () => {
  assert.equal(gateSimulationResourceRequest(".op\n.end").errors[0].code, "ELAB_SIMULATION_RESOURCE_REQUEST_INVALID");
  const input = dcRequest(oversizedValidCircuit());
  assert.ok(new TextEncoder().encode(JSON.stringify(input)).byteLength > SIMULATION_RESOURCE_LIMITS.maxSerializedEngineInputBytes);
  const oversized = gateSimulationResourceRequest(input);
  assert.equal(oversized.errors[0].code, "ELAB_SIMULATION_RESOURCE_INPUT_LIMIT");
  assert.equal(oversized.request, undefined);
});

test("SPICE-008: Host startet für eine übergroße Eingabe keinen Worker", async () => {
  const posted = [];
  let created = 0;
  const baseFactory = fakeWorkerFactory(posted);
  const host = createSimulationWorkerHost({ workerFactory() { created += 1; return baseFactory(); } });
  const response = await host.execute(dcRequest(oversizedValidCircuit()));
  assert.equal(response.ok, false);
  assert.equal(response.result, undefined);
  assert.equal(created, 0);
  assert.deepEqual(posted, []);
});

test("SPICE-008: Ergebnisflut verlässt den Worker-Endpoint nicht", async () => {
  const request = dcRequest();
  const messages = [];
  const axisValues = Array.from({ length: 1_001 }, (_, index) => index / 1_000);
  const nodes = Array.from({ length: 64 }, (_, nodeIndex) => ({
    nodeId: `n-${nodeIndex}`,
    values: axisValues.map(() => ({ voltageV: 0 })),
  }));
  const endpoint = createSimulationWorkerEndpoint({
    provider: {
      async execute() {
        return {
          ok: true,
          providerId: "malicious-fake",
          providerVersion: "1.0.0",
          result: solverResult(request, {
            analysis: "transient",
            axis: { kind: "time", unit: "s", values: axisValues },
            nodes,
          }),
        };
      },
    },
    postMessage: (message) => messages.push(message),
  });
  await endpoint.handleMessage({ protocolVersion: "1.0.0", type: "execute", jobId: "flood", request });
  assert.deepEqual(messages, [{
    protocolVersion: "1.0.0",
    type: "failed",
    jobId: "flood",
    errorCode: "ELAB_SIMULATION_PROVIDER_RESULT_INVALID",
  }]);
  assert.equal(messages[0].result, undefined);
});

test("SPICE-008: Ergebnisflut wird beendet und ein Folgeauftrag startet ohne State-Leak", async () => {
  const request = dcRequest();
  const workers = [];
  const axisValues = Array.from({ length: 1_001 }, (_, index) => index / 1_000);
  const floodedResult = solverResult(request, {
    analysis: "transient",
    axis: { kind: "time", unit: "s", values: axisValues },
    nodes: Array.from({ length: 64 }, (_, nodeIndex) => ({
      nodeId: `n-${nodeIndex}`,
      values: axisValues.map(() => ({ voltageV: 0 })),
    })),
  });
  const host = createSimulationWorkerHost({
    timeoutMs: 100,
    workerFactory() {
      const index = workers.length;
      const listeners = { message: new Set(), error: new Set() };
      const worker = {
        terminated: false,
        addEventListener(type, listener) { listeners[type].add(listener); },
        removeEventListener(type, listener) { listeners[type].delete(listener); },
        terminate() { this.terminated = true; },
        postMessage(message) {
          const result = index === 0 ? floodedResult : solverResult(message.request);
          queueMicrotask(() => {
            if (this.terminated) return;
            for (const listener of listeners.message) listener({ data: {
              protocolVersion: "1.0.0",
              type: "completed",
              jobId: message.jobId,
              providerId: "fake",
              providerVersion: "1.0.0",
              result,
            } });
          });
        },
      };
      workers.push(worker);
      return worker;
    },
  });
  const flooded = await host.execute(request);
  const recovered = await host.execute(request);
  assert.equal(flooded.ok, false);
  assert.equal(flooded.result, undefined);
  assert.equal(recovered.ok, true);
  assert.equal(workers.length, 2);
  assert.equal(workers.every((worker) => worker.terminated), true);
});

test("SPICE-008: Fake-WASM-Speicher ist bei 64 MiB fixiert und kann nicht wachsen", () => {
  const memory = createFixedFakeWasmMemory();
  assert.deepEqual(FAKE_WASM_MEMORY_CONTRACT, {
    pageSizeBytes: 65_536,
    initialPages: 1_024,
    maximumPages: 1_024,
    growthAllowed: false,
    byteLength: 64 * 1024 * 1024,
  });
  assert.equal(memory.initialPages, memory.maximumPages);
  assert.equal(memory.byteLength, SIMULATION_RESOURCE_LIMITS.maxMemoryBytes);
  assert.throws(() => memory.grow(1), /ELAB_SIMULATION_WASM_MEMORY_GROWTH_BLOCKED/u);
  assert.equal(Object.isFrozen(memory), true);
});

test("SPICE-008: ungültige Ergebnisse liefern niemals Teilwerte", () => {
  const request = dcRequest();
  const invalid = gateSimulationResourceResult(solverResult(request, {
    nodes: [{ nodeId: "out", values: [{ voltageV: Number.NaN }] }],
  }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.result, undefined);
  assert.equal(Object.isFrozen(invalid), true);
});
