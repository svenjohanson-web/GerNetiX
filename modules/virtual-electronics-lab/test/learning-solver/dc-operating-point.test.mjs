import assert from "node:assert/strict";
import test from "node:test";

import {
  DC_COMPONENT_TYPES,
  DC_OPERATING_POINT_ANALYSIS,
  DC_SOLVER_LIMITS,
  DC_SOLVER_SCHEMA_VERSION,
  getDcLearningSolverCapabilities,
  solveDcOperatingPoint,
  validateDcCircuit,
} from "../../learning-solver/dc-operating-point.mjs";

function circuit(components, overrides = {}) {
  return {
    schemaVersion: DC_SOLVER_SCHEMA_VERSION,
    analysis: DC_OPERATING_POINT_ANALYSIS,
    groundNode: "0",
    components,
    ...overrides,
  };
}

function voltageSource(id, positiveNode, negativeNode, voltageV) {
  return {
    id,
    type: DC_COMPONENT_TYPES.VOLTAGE_SOURCE,
    positiveNode,
    negativeNode,
    voltageV,
  };
}

function currentSource(id, positiveNode, negativeNode, currentA) {
  return {
    id,
    type: DC_COMPONENT_TYPES.CURRENT_SOURCE,
    positiveNode,
    negativeNode,
    currentA,
  };
}

function resistor(id, fromNode, toNode, resistanceOhm) {
  return {
    id,
    type: DC_COMPONENT_TYPES.RESISTOR,
    fromNode,
    toNode,
    resistanceOhm,
  };
}

function nodeVoltage(result, nodeId) {
  return result.nodeVoltages.find((entry) => entry.nodeId === nodeId).voltageV;
}

function branch(result, componentId) {
  return result.branches.find((entry) => entry.componentId === componentId);
}

function approximately(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("Spannungsteiler liefert Knotenwerte, Zweigstroeme und Leistungsbilanz", () => {
  const result = solveDcOperatingPoint(
    circuit([
      voltageSource("V1", "vcc", "0", 10),
      resistor("R1", "vcc", "out", 1000),
      resistor("R2", "out", "0", 1000),
    ])
  );

  assert.equal(result.ok, true);
  approximately(nodeVoltage(result, "vcc"), 10);
  approximately(nodeVoltage(result, "out"), 5);
  approximately(branch(result, "R1").currentA, 0.005);
  approximately(branch(result, "R2").currentA, 0.005);
  approximately(branch(result, "V1").currentA, -0.005);
  approximately(branch(result, "R1").powerW, 0.025);
  approximately(branch(result, "R2").powerW, 0.025);
  approximately(branch(result, "V1").powerW, -0.05);
  approximately(result.diagnostics.powerBalanceW, 0);
});

test("Gleichstromquelle speist einen geerdeten Widerstand", () => {
  const result = solveDcOperatingPoint(
    circuit([
      currentSource("I1", "0", "sense", 0.002),
      resistor("R1", "sense", "0", 1000),
    ])
  );

  assert.equal(result.ok, true);
  approximately(nodeVoltage(result, "sense"), 2);
  approximately(branch(result, "R1").currentA, 0.002);
  approximately(branch(result, "I1").voltageV, -2);
  approximately(branch(result, "I1").powerW, -0.004);
  approximately(result.diagnostics.powerBalanceW, 0);
});

test("mehrere Spannungsquellen besitzen konsistente Quellstroeme", () => {
  const result = solveDcOperatingPoint(
    circuit([
      voltageSource("V1", "a", "0", 10),
      voltageSource("V2", "b", "0", 5),
      resistor("R1", "a", "b", 1000),
    ])
  );

  assert.equal(result.ok, true);
  approximately(branch(result, "R1").currentA, 0.005);
  approximately(branch(result, "V1").currentA, -0.005);
  approximately(branch(result, "V2").currentA, 0.005);
  approximately(result.diagnostics.powerBalanceW, 0);
});

test("Brueckennetzwerk wird als allgemeines lineares Netz geloest", () => {
  const result = solveDcOperatingPoint(
    circuit([
      voltageSource("V1", "vcc", "0", 12),
      resistor("R1", "vcc", "left", 1000),
      resistor("R2", "left", "0", 2000),
      resistor("R3", "vcc", "right", 3000),
      resistor("R4", "right", "0", 1000),
      resistor("R5", "left", "right", 4000),
    ])
  );

  assert.equal(result.ok, true);
  approximately(nodeVoltage(result, "left"), 7.384615384615385, 1e-11);
  approximately(nodeVoltage(result, "right"), 3.6923076923076925, 1e-11);
  approximately(result.diagnostics.powerBalanceW, 0, 1e-12);
});

test("Komponentenreihenfolge beeinflusst das Ergebnis nicht", () => {
  const components = [
    currentSource("I1", "0", "out", 0.001),
    voltageSource("V1", "vcc", "0", 3.3),
    resistor("R1", "vcc", "out", 2200),
    resistor("R2", "out", "0", 1000),
  ];

  const forward = solveDcOperatingPoint(circuit(components));
  const reverse = solveDcOperatingPoint(circuit([...components].reverse()));

  assert.equal(forward.ok, true);
  assert.deepEqual(reverse, forward);
});

test("Capabilities dokumentieren nur den tatsaechlichen Solverumfang", () => {
  const capabilities = getDcLearningSolverCapabilities();

  assert.deepEqual(capabilities.analyses, [DC_OPERATING_POINT_ANALYSIS]);
  assert.deepEqual(capabilities.componentTypes, [
    "dc-current-source",
    "dc-voltage-source",
    "resistor",
  ]);
  assert.deepEqual(capabilities.limits, DC_SOLVER_LIMITS);
});

test("ungueltige Schema- und Analyseversionen werden stabil abgelehnt", () => {
  const result = solveDcOperatingPoint(
    circuit([resistor("R1", "a", "0", 1000)], {
      schemaVersion: "2.0.0",
      analysis: "transient",
    })
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["UNSUPPORTED_SCHEMA_VERSION", "UNSUPPORTED_ANALYSIS"]
  );
});

test("doppelte Komponenten-IDs und ungueltige Parameter werden gesammelt", () => {
  const validation = validateDcCircuit(
    circuit([
      resistor("R1", "a", "0", 1000),
      resistor("R1", "a", "0", 0),
    ])
  );

  assert.equal(validation.ok, false);
  assert.deepEqual(
    validation.errors.map((error) => error.code),
    ["DUPLICATE_COMPONENT_ID", "INVALID_COMPONENT_PARAMETER"]
  );
});

test("nicht unterstuetzte und selbstverbundene Komponenten werden abgelehnt", () => {
  const unsupported = solveDcOperatingPoint(
    circuit([{ id: "C1", type: "capacitor", fromNode: "a", toNode: "0", capacitanceF: 1e-6 }])
  );
  const selfConnected = solveDcOperatingPoint(circuit([resistor("R1", "a", "a", 1000)]));

  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.errors[0].code, "UNSUPPORTED_COMPONENT_TYPE");
  assert.equal(selfConnected.ok, false);
  assert.equal(selfConnected.errors[0].code, "SELF_CONNECTED_COMPONENT");
});

test("fehlender Bezugsknoten wird erkannt", () => {
  const result = solveDcOperatingPoint(
    circuit([
      voltageSource("V1", "a", "b", 5),
      resistor("R1", "a", "b", 1000),
    ])
  );

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "GROUND_NODE_NOT_CONNECTED");
});

test("schwebende Teilnetze werden vor der Matrixloesung erkannt", () => {
  const result = solveDcOperatingPoint(
    circuit([
      resistor("R1", "grounded", "0", 1000),
      resistor("R2", "floating-a", "floating-b", 1000),
    ])
  );

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "FLOATING_NODE");
  assert.deepEqual(result.errors[0].nodeIds, ["floating-a", "floating-b"]);
});

test("Stromquelle allein stellt keinen DC-Pfad zum Bezugsknoten her", () => {
  const result = solveDcOperatingPoint(
    circuit([
      resistor("R1", "grounded", "0", 1000),
      currentSource("I1", "grounded", "floating", 0.001),
    ])
  );

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "FLOATING_NODE");
  assert.deepEqual(result.errors[0].nodeIds, ["floating"]);
});

test("widerspruechliche ideale Spannungsquellen werden erkannt", () => {
  const result = solveDcOperatingPoint(
    circuit([
      voltageSource("V1", "out", "0", 5),
      voltageSource("V2", "out", "0", 3),
    ])
  );

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "INCONSISTENT_CIRCUIT");
});

test("redundante ideale Spannungsquellen erzeugen ein singulaeres System", () => {
  const result = solveDcOperatingPoint(
    circuit([
      voltageSource("V1", "out", "0", 5),
      voltageSource("V2", "out", "0", 5),
    ])
  );

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "SINGULAR_CIRCUIT");
});

test("Komponentengrenze wird vor der Berechnung erzwungen", () => {
  const components = Array.from({ length: DC_SOLVER_LIMITS.maxComponents + 1 }, (_, index) =>
    resistor(`R${index}`, "a", "0", 1000 + index)
  );
  const result = solveDcOperatingPoint(circuit(components));

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "COMPONENT_LIMIT_EXCEEDED");
});

test("Knotengrenze wird vor der Berechnung erzwungen", () => {
  const components = Array.from({ length: DC_SOLVER_LIMITS.maxNodes }, (_, index) =>
    resistor(`R${index}`, `n${index}`, "0", 1000)
  );
  const result = solveDcOperatingPoint(circuit(components));

  assert.equal(result.ok, false);
  assert.equal(result.errors.at(-1).code, "NODE_LIMIT_EXCEEDED");
});

test("Grenzwerte akzeptieren endliche erlaubte Extremwerte", () => {
  const result = solveDcOperatingPoint(
    circuit([
      voltageSource("V1", "out", "0", DC_SOLVER_LIMITS.maxAbsVoltageV),
      resistor("R1", "out", "0", DC_SOLVER_LIMITS.maxResistanceOhm),
    ])
  );

  assert.equal(result.ok, true);
  approximately(nodeVoltage(result, "out"), DC_SOLVER_LIMITS.maxAbsVoltageV);
  approximately(branch(result, "R1").currentA, 1e-6);
});
