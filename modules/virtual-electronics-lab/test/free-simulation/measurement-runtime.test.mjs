import assert from "node:assert/strict";
import test from "node:test";

import { createFreeDcDividerDocument, createFreeDcDividerMeasurementSetup } from "../../free-simulation/free-circuit-presets.mjs";
import { MEASUREMENT_COMMAND_TYPES, createMeasurementRuntime } from "../../free-simulation/measurement-runtime.mjs";

test("FREE-005: Messpunkte lassen sich platzieren, versetzen und entfernen", () => {
  const document = createFreeDcDividerDocument();
  const runtime = createMeasurementRuntime({ document });
  assert.equal(runtime.dispatch({ type: MEASUREMENT_COMMAND_TYPES.AddMeasurementPoint, pointId: "mp-1", label: "Quelle", nodeId: "r1-p" }, document).ok, true);
  assert.equal(runtime.dispatch({ type: MEASUREMENT_COMMAND_TYPES.MoveMeasurementPoint, pointId: "mp-1", nodeId: "r1-n" }, document).ok, true);
  assert.equal(runtime.getSnapshot().points[0].nodeId, "r1-n");
  assert.equal(runtime.dispatch({ type: MEASUREMENT_COMMAND_TYPES.RemoveMeasurementPoint, pointId: "mp-1" }, document).ok, true);
});

test("FREE-005: Entfernen eines Messpunkts entfernt abhängige Tastköpfe", () => {
  const document = createFreeDcDividerDocument();
  const runtime = createMeasurementRuntime({ setup: createFreeDcDividerMeasurementSetup(), document });
  assert.equal(runtime.dispatch({ type: MEASUREMENT_COMMAND_TYPES.RemoveMeasurementPoint, pointId: "mp-gnd" }, document).ok, true);
  assert.equal(runtime.getSnapshot().voltageProbes.length, 0);
});

test("FREE-005: ungültige Messbefehle verändern den Zustand nicht", () => {
  const document = createFreeDcDividerDocument();
  const runtime = createMeasurementRuntime({ setup: createFreeDcDividerMeasurementSetup(), document });
  const before = runtime.getSnapshot();
  const result = runtime.dispatch({ type: MEASUREMENT_COMMAND_TYPES.AddMeasurementPoint, pointId: "mp-x", label: "Falsch", nodeId: "missing" }, document);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_MEASUREMENT_POINT_NODE_INVALID");
  assert.equal(runtime.getSnapshot(), before);
});

test("FREE-005: Reconcile räumt Messmittel an verschwundenen Knoten auf", () => {
  const initialDocument = createFreeDcDividerDocument();
  const runtime = createMeasurementRuntime({ setup: createFreeDcDividerMeasurementSetup(), document: initialDocument });
  const changedDocument = { ...initialDocument, nodes: initialDocument.nodes.filter((node) => node.id !== "r1-n") };
  const result = runtime.reconcile(changedDocument);
  assert.deepEqual(result.removedPointIds, ["mp-mid"]);
  assert.deepEqual(result.removedProbeIds, ["probe-1"]);
});
