import assert from "node:assert/strict";
import test from "node:test";

import { createFreeDcDividerDocument } from "../../free-simulation/free-circuit-presets.mjs";
import { createFakeSimulationProvider, createSimulationProviderPort } from "../../free-simulation/simulation-provider-port.mjs";

function dcRequest(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    circuit: createFreeDcDividerDocument(),
    analysis: { type: "dc-operating-point" },
    ...overrides,
  };
}

function resultFor(request) {
  return {
    schemaVersion: "1.0.0",
    requestSchemaVersion: request.schemaVersion,
    documentId: request.circuit.id,
    documentVersion: request.circuit.version,
    analysis: request.analysis.type,
    axis: { kind: "operating-point", unit: "index", values: [0] },
    nodes: request.circuit.nodes.map((node) => ({ nodeId: node.id, values: [{ voltageV: 0 }] })),
    branches: [],
    models: [{ modelId: "deterministic-fake", modelVersion: "1.0.0" }],
    diagnostics: [],
  };
}

test("SPICE-005: Port übergibt ausschließlich den normalisierten Simulationsauftrag", async () => {
  let received;
  const provider = createFakeSimulationProvider({
    resultFactory(request) {
      received = request;
      return resultFor(request);
    },
  });
  const input = dcRequest();
  input.circuit = structuredClone(input.circuit);
  input.circuit.nodes.reverse();
  input.circuit.components.reverse();
  const response = await provider.execute(input);
  assert.equal(response.ok, true);
  assert.equal(Object.isFrozen(received), true);
  assert.equal(Object.isFrozen(received.circuit.components), true);
  assert.deepEqual(received.components, undefined);
  assert.deepEqual(Object.keys(received), ["schemaVersion", "circuit", "analysis"]);
  assert.notStrictEqual(received, input);
});

test("SPICE-005: Raw-Netlist und unbekannte Auftragsfelder erreichen den Provider nicht", async () => {
  let calls = 0;
  const provider = createFakeSimulationProvider({ resultFactory(request) { calls += 1; return resultFor(request); } });
  const raw = await provider.execute("V1 in 0 5\n.op\n.end\n");
  const unknown = await provider.execute(dcRequest({ rawNetlist: ".op" }));
  assert.equal(raw.ok, false);
  assert.equal(raw.errors[0].cause, "ELAB_SIMULATION_REQUEST_REQUIRED");
  assert.equal(unknown.errors[0].cause, "ELAB_SIMULATION_REQUEST_UNKNOWN_KEYS");
  assert.equal(calls, 0);
});

test("SPICE-005: austauschbare Fake-Provider erfüllen denselben Portvertrag", async () => {
  const first = createFakeSimulationProvider({ providerId: "fake-a", providerVersion: "1.0.0", resultFactory: resultFor });
  const second = createFakeSimulationProvider({ providerId: "fake-b", providerVersion: "2.0.0", resultFactory: async (request) => resultFor(request) });
  const [left, right] = await Promise.all([first.execute(dcRequest()), second.execute(dcRequest())]);
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.deepEqual(left.result, right.result);
  assert.equal(left.providerId, "fake-a");
  assert.equal(right.providerId, "fake-b");
  assert.equal(Object.isFrozen(left), true);
});

test("SPICE-005: ungültige und nicht zum Auftrag gehörende Providerergebnisse werden abgelehnt", async () => {
  const invalid = createFakeSimulationProvider({ resultFactory: () => ({ ok: true, raw: "provider text" }) });
  const mismatch = createFakeSimulationProvider({ resultFactory: (request) => ({ ...resultFor(request), documentId: "other-circuit" }) });
  const invalidResponse = await invalid.execute(dcRequest());
  const mismatchResponse = await mismatch.execute(dcRequest());
  assert.equal(invalidResponse.errors[0].code, "ELAB_SIMULATION_PROVIDER_RESULT_INVALID");
  assert.equal(invalidResponse.errors[0].cause, "ELAB_SOLVER_RESULT_UNKNOWN_KEYS");
  assert.equal(mismatchResponse.errors[0].code, "ELAB_SIMULATION_PROVIDER_RESULT_MISMATCH");
});

test("SPICE-005: Providerfehler werden ohne freie interne Fehlermeldung stabil gekapselt", async () => {
  const provider = createSimulationProviderPort({
    providerId: "throwing-fake",
    providerVersion: "1.0.0",
    execute() { throw new Error("secret internal provider detail"); },
  });
  const response = await provider.execute(dcRequest());
  assert.equal(response.errors[0].code, "ELAB_SIMULATION_PROVIDER_FAILED");
  assert.equal(JSON.stringify(response).includes("secret internal provider detail"), false);
});

test("SPICE-005: Providerdefinitionen besitzen eine kleine geschlossene Oberfläche", () => {
  assert.throws(() => createSimulationProviderPort({ providerId: "x", providerVersion: "1", execute() {}, rawNetlist: true }), /ELAB_SIMULATION_PROVIDER_INVALID/);
  assert.throws(() => createFakeSimulationProvider({ resultFactory() {}, command: "op" }), /ELAB_FAKE_SIMULATION_PROVIDER_INVALID/);
});
