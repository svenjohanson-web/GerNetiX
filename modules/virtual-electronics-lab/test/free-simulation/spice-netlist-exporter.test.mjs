import assert from "node:assert/strict";
import test from "node:test";

import { FREE_CIRCUIT_COMMAND_TYPES, createFreeCircuitCommandRuntime } from "../../free-simulation/free-circuit-command-runtime.mjs";
import { createFreeDcDividerDocument, createFreeEmptyDocument, createFreeRcChargeDocument } from "../../free-simulation/free-circuit-presets.mjs";
import { SPICE_NETLIST_EXPORT_MODEL, exportSpiceNetlist } from "../../free-simulation/spice-netlist-exporter.mjs";

function request(circuit, analysis = { type: "dc-operating-point" }) {
  return { schemaVersion: "1.0.0", circuit, analysis };
}

test("SPICE-001: DC-Netlist ist deterministisch, geerdet und rückverfolgbar", () => {
  const input = request(createFreeDcDividerDocument());
  const first = exportSpiceNetlist(input);
  const second = exportSpiceNetlist(input);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.match(first.result.netlist, /^\* GerNetiX deterministic SPICE netlist\n/);
  assert.match(first.result.netlist, /\* node 0 = gnd\n/);
  assert.match(first.result.netlist, /V1 \S+ 0 DC 5\n/);
  assert.match(first.result.netlist, /R1 \S+ \S+ 1000\n/);
  assert.match(first.result.netlist, /\.op\n\.end\n$/);
  assert.equal(first.result.dialect, SPICE_NETLIST_EXPORT_MODEL.dialect);
  assert.equal(Object.isFrozen(first.result.mappings.nodes), true);
});

test("SPICE-001: Eingabereihenfolge verändert die Netlist nicht", () => {
  const circuit = structuredClone(createFreeDcDividerDocument());
  const reordered = {
    ...circuit,
    nodes: [...circuit.nodes].reverse(),
    components: [...circuit.components].reverse(),
  };
  assert.equal(
    exportSpiceNetlist(request(circuit)).result.netlist,
    exportSpiceNetlist(request(reordered)).result.netlist,
  );
});

test("SPICE-001: Transientenauftrag exportiert R, C und begrenzte Analyse", () => {
  const result = exportSpiceNetlist(request(createFreeRcChargeDocument(), {
    type: "transient",
    timeStepS: 0.0001,
    stopTimeS: 0.01,
  }));
  assert.equal(result.ok, true);
  assert.match(result.result.netlist, /C1 \S+ 0 0\.000001\n/);
  assert.match(result.result.netlist, /\.tran 0\.0001 0\.01 0 UIC\n\.end\n$/);
});

test("SPICE-001: nicht unterstützte Bauteile und fehlender Inhalt werden abgelehnt", () => {
  const runtime = createFreeCircuitCommandRuntime();
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "gnd1", componentType: "gnd" });
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "d1", componentType: "led" });
  runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: "d1", portId: "cathode" },
    to: { componentId: "gnd1", portId: "0" },
  });
  const unsupported = exportSpiceNetlist(request(runtime.getSnapshot()));
  assert.equal(unsupported.errors[0].code, "ELAB_SPICE_COMPONENT_UNSUPPORTED");
  assert.deepEqual(unsupported.errors[0].componentIds, ["d1"]);
  assert.equal(exportSpiceNetlist(request(createFreeEmptyDocument())).errors[0].code, "ELAB_SPICE_GROUND_REQUIRED");
});

test("SPICE-001: mehrere getrennte Masseknoten werden abgelehnt", () => {
  const runtime = createFreeCircuitCommandRuntime();
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "gnd1", componentType: "gnd" });
  runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId: "gnd2", componentType: "gnd" });
  const result = exportSpiceNetlist(request(runtime.getSnapshot()));
  assert.equal(result.errors[0].code, "ELAB_SPICE_GROUND_REQUIRED");
});

test("SPICE-001: Export verändert den Auftrag nicht", () => {
  const input = request(structuredClone(createFreeDcDividerDocument()));
  const before = structuredClone(input);
  exportSpiceNetlist(input);
  assert.deepEqual(input, before);
});
