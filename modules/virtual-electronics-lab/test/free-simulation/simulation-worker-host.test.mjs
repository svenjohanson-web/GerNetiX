import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createFreeDcDividerDocument } from "../../free-simulation/free-circuit-presets.mjs";
import { createFakeSimulationProvider } from "../../free-simulation/simulation-provider-port.mjs";
import { createSimulationWorkerEndpoint } from "../../free-simulation/simulation-worker-endpoint.mjs";
import { createSimulationWorkerHost } from "../../free-simulation/simulation-worker-host.mjs";
import {
  SIMULATION_WORKER_MESSAGE_CONTRACT,
  normalizeSimulationWorkerRequestMessage,
  normalizeSimulationWorkerResponseMessage,
} from "../../free-simulation/simulation-worker-message-contract.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeDirectory = path.resolve(testDirectory, "../../free-simulation");

function dcRequest(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    circuit: createFreeDcDividerDocument(),
    analysis: { type: "dc-operating-point" },
    ...overrides,
  };
}

function solverResult(request) {
  return {
    schemaVersion: "1.0.0",
    requestSchemaVersion: request.schemaVersion,
    documentId: request.circuit.id,
    documentVersion: request.circuit.version,
    analysis: request.analysis.type,
    axis: { kind: "operating-point", unit: "index", values: [0] },
    nodes: request.circuit.nodes.map((node) => ({ nodeId: node.id, values: [{ voltageV: 0 }] })),
    branches: [],
    models: [{ modelId: "worker-fake", modelVersion: "1.0.0" }],
    diagnostics: [],
  };
}

function createWorkerFactory(modes = ["complete"]) {
  const workers = [];
  const provider = createFakeSimulationProvider({ resultFactory: solverResult });
  const workerFactory = () => {
    const mode = modes[workers.length] || modes.at(-1);
    const listeners = { message: new Set(), error: new Set() };
    const worker = {
      terminated: false,
      posted: [],
      addEventListener(type, listener) { listeners[type].add(listener); },
      removeEventListener(type, listener) { listeners[type].delete(listener); },
      terminate() { this.terminated = true; },
      postMessage(message) {
        this.posted.push(message);
        if (mode === "hang") return;
        if (mode === "crash") {
          queueMicrotask(() => {
            if (!this.terminated) for (const listener of listeners.error) listener({ message: "secret worker crash" });
          });
          return;
        }
        if (mode === "wrong-job") {
          queueMicrotask(() => {
            if (!this.terminated) for (const listener of listeners.message) listener({ data: { protocolVersion: "1.0.0", type: "failed", jobId: "other", errorCode: "ELAB_SIMULATION_PROVIDER_FAILED" } });
          });
          return;
        }
        const endpoint = createSimulationWorkerEndpoint({
          provider,
          postMessage(data) {
            queueMicrotask(() => {
              if (!worker.terminated) for (const listener of listeners.message) listener({ data });
            });
          },
        });
        queueMicrotask(() => endpoint.handleMessage(message).catch(() => {
          if (!worker.terminated) for (const listener of listeners.error) listener({ message: "secret rejection" });
        }));
      },
    };
    workers.push(worker);
    return worker;
  };
  return { workerFactory, workers };
}

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") assertDeepFrozen(child);
  }
}

test("SPICE-007: geschlossenes Protokoll akzeptiert nur typisierte Aufträge und Antworten", () => {
  const request = dcRequest();
  const valid = normalizeSimulationWorkerRequestMessage({
    protocolVersion: "1.0.0",
    type: "execute",
    jobId: "job-1",
    request,
  });
  assert.equal(valid.ok, true);
  assertDeepFrozen(valid);
  assert.equal(normalizeSimulationWorkerRequestMessage({ ...valid.message, rawNetlist: ".op" }).ok, false);
  assert.equal(normalizeSimulationWorkerRequestMessage({ ...valid.message, type: "command" }).ok, false);

  const completed = {
    protocolVersion: "1.0.0",
    type: "completed",
    jobId: "job-1",
    providerId: "fake",
    providerVersion: "1",
    result: solverResult(valid.message.request),
  };
  assert.equal(normalizeSimulationWorkerResponseMessage(completed, "job-1").ok, true);
  assert.equal(normalizeSimulationWorkerResponseMessage({ ...completed, stdout: "raw" }, "job-1").ok, false);
  assert.equal(normalizeSimulationWorkerResponseMessage(completed, "job-2").ok, false);
});

test("SPICE-007: Runtime-Dateien öffnen keine DOM-, Netzwerk-, Storage- oder Codekanäle", () => {
  const runtimeFiles = [
    "simulation-worker-message-contract.mjs",
    "simulation-worker-endpoint.mjs",
    "simulation-worker-host.mjs",
  ];
  const forbidden = [
    /\b(?:document|window|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|eval)\b/u,
    /\bnew\s+Function\b/u,
    /\brawNetlist\b/u,
    /\bcommand\s*:/u,
    /type\s*:\s*["']command["']/u,
    /["']\.(?:op|ac|tran|dc|end)["']/u,
  ];
  for (const runtimeFile of runtimeFiles) {
    const source = fs.readFileSync(path.join(runtimeDirectory, runtimeFile), "utf8");
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${runtimeFile}: ${pattern}`);
  }
});

test("SPICE-007: Timeoutvertrag ist positiv und auf zwei Sekunden gedeckelt", () => {
  const fake = createWorkerFactory();
  assert.doesNotThrow(() => createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 0.1 }));
  assert.doesNotThrow(() => createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 2_000 }));
  assert.throws(() => createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 0 }), /ELAB_SIMULATION_WORKER_HOST_INVALID/u);
  assert.throws(() => createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 2_000.1 }), /ELAB_SIMULATION_WORKER_HOST_INVALID/u);
});

test("SPICE-007: Worker-Endpoint verarbeitet genau einen Auftrag pro Lebenszyklus", async () => {
  const messages = [];
  const provider = createFakeSimulationProvider({ resultFactory: solverResult });
  const endpoint = createSimulationWorkerEndpoint({ provider, postMessage: (message) => messages.push(message) });
  const message = {
    protocolVersion: SIMULATION_WORKER_MESSAGE_CONTRACT.protocolVersion,
    type: "execute",
    jobId: "only-job",
    request: dcRequest(),
  };
  await endpoint.handleMessage(message);
  await endpoint.handleMessage({ ...message, jobId: "second-job" });
  assert.equal(messages[0].type, "completed");
  assert.deepEqual(messages[1], {
    protocolVersion: "1.0.0",
    type: "failed",
    jobId: "second-job",
    errorCode: "ELAB_SIMULATION_WORKER_ALREADY_USED",
  });
});

test("SPICE-007: Worker-Endpoint kapselt Enginefehler ohne freie Fehlermeldung", async () => {
  const messages = [];
  const endpoint = createSimulationWorkerEndpoint({
    provider: { async execute() { throw new Error("secret fake-engine detail"); } },
    postMessage: (message) => messages.push(message),
  });
  await endpoint.handleMessage({
    protocolVersion: "1.0.0",
    type: "execute",
    jobId: "failing-job",
    request: dcRequest(),
  });
  assert.equal(messages[0].errorCode, "ELAB_SIMULATION_PROVIDER_FAILED");
  assert.equal(JSON.stringify(messages).includes("secret fake-engine detail"), false);
});

test("SPICE-007: Host verwendet pro erfolgreichem Auftrag einen frischen beendeten Worker", async () => {
  const fake = createWorkerFactory(["complete", "complete"]);
  const host = createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 100 });
  const first = await host.execute(dcRequest());
  const second = await host.execute(dcRequest());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(fake.workers.length, 2);
  assert.notEqual(fake.workers[0].posted[0].jobId, fake.workers[1].posted[0].jobId);
  assert.equal(fake.workers.every((worker) => worker.posted.length === 1 && worker.terminated), true);
  assertDeepFrozen(first);
});

test("SPICE-007: Timeout beendet den Worker und ein Folgeauftrag startet frisch", async () => {
  const fake = createWorkerFactory(["hang", "complete"]);
  const host = createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 5 });
  const timedOut = await host.execute(dcRequest());
  const recovered = await host.execute(dcRequest());
  assert.equal(timedOut.errors[0].code, "ELAB_SIMULATION_WORKER_TIMEOUT");
  assert.equal(recovered.ok, true);
  assert.equal(fake.workers.length, 2);
  assert.equal(fake.workers.every((worker) => worker.terminated), true);
});

test("SPICE-007: Abort beendet den Auftrag ohne Teilergebnis", async () => {
  const fake = createWorkerFactory(["hang"]);
  const host = createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 100 });
  const controller = new AbortController();
  const pending = host.execute(dcRequest(), { signal: controller.signal });
  controller.abort();
  const response = await pending;
  assert.deepEqual(response.errors, [{ code: "ELAB_SIMULATION_WORKER_ABORTED" }]);
  assert.equal(response.result, undefined);
  assert.equal(fake.workers[0].terminated, true);
});

test("SPICE-007: Worker-Crash wird ohne internes Fehlerdetail gekapselt", async () => {
  const fake = createWorkerFactory(["crash"]);
  const host = createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 100 });
  const response = await host.execute(dcRequest());
  assert.equal(response.errors[0].code, "ELAB_SIMULATION_WORKER_CRASHED");
  assert.equal(JSON.stringify(response).includes("secret worker crash"), false);
  assert.equal(fake.workers[0].terminated, true);
});

test("SPICE-007: falsche Job-ID wird fail-closed verworfen", async () => {
  const fake = createWorkerFactory(["wrong-job"]);
  const host = createSimulationWorkerHost({ workerFactory: fake.workerFactory, timeoutMs: 100 });
  const response = await host.execute(dcRequest());
  assert.equal(response.errors[0].code, "ELAB_SIMULATION_WORKER_PROTOCOL_INVALID");
  assert.equal(fake.workers[0].terminated, true);
});

test("SPICE-007: ungültiger Auftrag erzeugt weder Worker noch Raw-Netlist-Nebenkanal", async () => {
  const fake = createWorkerFactory();
  const host = createSimulationWorkerHost({ workerFactory: fake.workerFactory });
  const raw = await host.execute("V1 in 0 5\n.op\n.end\n");
  const unknown = await host.execute({ ...dcRequest(), command: "op" });
  assert.equal(raw.errors[0].code, "ELAB_SIMULATION_WORKER_REQUEST_INVALID");
  assert.equal(unknown.errors[0].code, "ELAB_SIMULATION_WORKER_REQUEST_INVALID");
  assert.equal(fake.workers.length, 0);
});
