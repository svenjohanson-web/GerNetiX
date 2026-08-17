import assert from "node:assert/strict";
import test from "node:test";

import { createFreeDcDividerDocument, createFreeDcDividerMeasurementSetup } from "../../free-simulation/free-circuit-presets.mjs";
import { MEASUREMENT_SETUP_CONTRACT, normalizeMeasurementSetup } from "../../free-simulation/measurement-point-contract.mjs";

test("FREE-005: Messpunkte und Tastköpfe werden deterministisch normalisiert", () => {
  const result = normalizeMeasurementSetup(createFreeDcDividerMeasurementSetup(), createFreeDcDividerDocument());
  assert.equal(result.ok, true);
  assert.deepEqual(result.setup.points.map((point) => point.id), ["mp-gnd", "mp-mid"]);
  assert.equal(result.setup.voltageProbes[0].positivePointId, "mp-mid");
  assert.equal(Object.isFrozen(result.setup.points), true);
  assert.equal(result.setup.modelLimits.probeLoading, "ideal-infinite-input-impedance");
});

test("FREE-005: unbekannte Knoten und Messpunktreferenzen werden abgelehnt", () => {
  const document = createFreeDcDividerDocument();
  const missingNode = createFreeDcDividerMeasurementSetup();
  missingNode.points[1].nodeId = "unknown";
  assert.equal(normalizeMeasurementSetup(missingNode, document).errors[0].code, "ELAB_MEASUREMENT_POINT_NODE_INVALID");

  const missingPoint = createFreeDcDividerMeasurementSetup();
  missingPoint.voltageProbes[0].referencePointId = "unknown";
  assert.equal(normalizeMeasurementSetup(missingPoint, document).errors[0].code, "ELAB_VOLTAGE_PROBE_REFERENCE_INVALID");
});

test("FREE-005: feste Grenzen verhindern unbegrenzte Messaufbauten", () => {
  assert.equal(MEASUREMENT_SETUP_CONTRACT.maxPoints, 16);
  assert.equal(MEASUREMENT_SETUP_CONTRACT.maxVoltageProbes, 8);
  const setup = createFreeDcDividerMeasurementSetup();
  setup.points = Array.from({ length: 17 }, (_, index) => ({ id: `p-${index}`, label: `P ${index}`, nodeId: "gnd" }));
  setup.voltageProbes = [];
  assert.equal(normalizeMeasurementSetup(setup, createFreeDcDividerDocument()).errors[0].code, "ELAB_MEASUREMENT_POINT_LIMIT");
});

