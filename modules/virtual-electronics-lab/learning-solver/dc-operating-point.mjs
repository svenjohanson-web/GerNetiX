export const DC_SOLVER_SCHEMA_VERSION = "1.0.0";
export const DC_SOLVER_MODEL_VERSION = "1.0.0";
export const DC_OPERATING_POINT_ANALYSIS = "dc-operating-point";

export const DC_COMPONENT_TYPES = Object.freeze({
  RESISTOR: "resistor",
  VOLTAGE_SOURCE: "dc-voltage-source",
  CURRENT_SOURCE: "dc-current-source",
});

export const DC_SOLVER_LIMITS = Object.freeze({
  maxComponents: 64,
  maxNodes: 32,
  maxIdentifierLength: 64,
  minResistanceOhm: 1e-6,
  maxResistanceOhm: 1e12,
  maxAbsVoltageV: 1e6,
  maxAbsCurrentA: 1e3,
});

const SUPPORTED_COMPONENT_TYPES = new Set(Object.values(DC_COMPONENT_TYPES));
const RELATIVE_PIVOT_TOLERANCE = 1e-12;
const RELATIVE_CONSISTENCY_TOLERANCE = 1e-10;
const MAX_NORMALIZED_RESIDUAL = 1e-9;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function makeError(code, message, details = {}) {
  return { code, message, ...details };
}

function isValidIdentifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= DC_SOLVER_LIMITS.maxIdentifierLength &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function compareIdentifiers(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function componentNodeFields(type) {
  if (type === DC_COMPONENT_TYPES.RESISTOR) {
    return ["fromNode", "toNode"];
  }
  return ["positiveNode", "negativeNode"];
}

function validateParameter(component, componentIndex, errors) {
  const details = { componentId: component.id, componentIndex };

  if (component.type === DC_COMPONENT_TYPES.RESISTOR) {
    const value = component.resistanceOhm;
    if (
      !Number.isFinite(value) ||
      value < DC_SOLVER_LIMITS.minResistanceOhm ||
      value > DC_SOLVER_LIMITS.maxResistanceOhm
    ) {
      errors.push(
        makeError(
          "INVALID_COMPONENT_PARAMETER",
          `Widerstand ${component.id} liegt ausserhalb der Solvergrenzen.`,
          { ...details, field: "resistanceOhm" }
        )
      );
    }
    return;
  }

  if (component.type === DC_COMPONENT_TYPES.VOLTAGE_SOURCE) {
    const value = component.voltageV;
    if (!Number.isFinite(value) || Math.abs(value) > DC_SOLVER_LIMITS.maxAbsVoltageV) {
      errors.push(
        makeError(
          "INVALID_COMPONENT_PARAMETER",
          `Spannung von ${component.id} liegt ausserhalb der Solvergrenzen.`,
          { ...details, field: "voltageV" }
        )
      );
    }
    return;
  }

  if (component.type === DC_COMPONENT_TYPES.CURRENT_SOURCE) {
    const value = component.currentA;
    if (!Number.isFinite(value) || Math.abs(value) > DC_SOLVER_LIMITS.maxAbsCurrentA) {
      errors.push(
        makeError(
          "INVALID_COMPONENT_PARAMETER",
          `Strom von ${component.id} liegt ausserhalb der Solvergrenzen.`,
          { ...details, field: "currentA" }
        )
      );
    }
  }
}

function normalizeComponent(component) {
  if (component.type === DC_COMPONENT_TYPES.RESISTOR) {
    return {
      id: component.id,
      type: component.type,
      fromNode: component.fromNode,
      toNode: component.toNode,
      resistanceOhm: component.resistanceOhm,
    };
  }

  if (component.type === DC_COMPONENT_TYPES.VOLTAGE_SOURCE) {
    return {
      id: component.id,
      type: component.type,
      positiveNode: component.positiveNode,
      negativeNode: component.negativeNode,
      voltageV: component.voltageV,
    };
  }

  return {
    id: component.id,
    type: component.type,
    positiveNode: component.positiveNode,
    negativeNode: component.negativeNode,
    currentA: component.currentA,
  };
}

export function validateDcCircuit(circuit) {
  const errors = [];

  if (!isRecord(circuit)) {
    return {
      ok: false,
      errors: [makeError("INVALID_CIRCUIT", "Die Schaltung muss ein Objekt sein.")],
    };
  }

  if (circuit.schemaVersion !== DC_SOLVER_SCHEMA_VERSION) {
    errors.push(
      makeError(
        "UNSUPPORTED_SCHEMA_VERSION",
        `Unterstuetzt wird schemaVersion ${DC_SOLVER_SCHEMA_VERSION}.`,
        { schemaVersion: circuit.schemaVersion ?? null }
      )
    );
  }

  if (circuit.analysis !== DC_OPERATING_POINT_ANALYSIS) {
    errors.push(
      makeError(
        "UNSUPPORTED_ANALYSIS",
        `Unterstuetzt wird nur ${DC_OPERATING_POINT_ANALYSIS}.`,
        { analysis: circuit.analysis ?? null }
      )
    );
  }

  if (!isValidIdentifier(circuit.groundNode)) {
    errors.push(
      makeError("INVALID_NODE_ID", "groundNode ist keine gueltige Knoten-ID.", {
        field: "groundNode",
      })
    );
  }

  if (!Array.isArray(circuit.components) || circuit.components.length === 0) {
    errors.push(
      makeError("INVALID_CIRCUIT", "Die Schaltung benoetigt mindestens eine Komponente.", {
        field: "components",
      })
    );
    return { ok: false, errors };
  }

  if (circuit.components.length > DC_SOLVER_LIMITS.maxComponents) {
    errors.push(
      makeError(
        "COMPONENT_LIMIT_EXCEEDED",
        `Maximal ${DC_SOLVER_LIMITS.maxComponents} Komponenten sind erlaubt.`,
        { componentCount: circuit.components.length }
      )
    );
  }

  const seenComponentIds = new Set();
  const nodeIds = new Set();
  if (isValidIdentifier(circuit.groundNode)) {
    nodeIds.add(circuit.groundNode);
  }
  const normalizedComponents = [];

  circuit.components.forEach((component, componentIndex) => {
    if (!isRecord(component)) {
      errors.push(
        makeError("INVALID_CIRCUIT", "Jede Komponente muss ein Objekt sein.", {
          componentIndex,
        })
      );
      return;
    }

    if (!isValidIdentifier(component.id)) {
      errors.push(
        makeError("INVALID_COMPONENT_ID", "Die Komponenten-ID ist ungueltig.", {
          componentIndex,
        })
      );
    } else if (seenComponentIds.has(component.id)) {
      errors.push(
        makeError("DUPLICATE_COMPONENT_ID", `Komponenten-ID ${component.id} ist doppelt.`, {
          componentId: component.id,
          componentIndex,
        })
      );
    } else {
      seenComponentIds.add(component.id);
    }

    if (!SUPPORTED_COMPONENT_TYPES.has(component.type)) {
      errors.push(
        makeError(
          "UNSUPPORTED_COMPONENT_TYPE",
          `Komponententyp ${String(component.type)} wird nicht unterstuetzt.`,
          { componentId: component.id, componentIndex, componentType: component.type ?? null }
        )
      );
      return;
    }

    const nodeFields = componentNodeFields(component.type);
    const validNodes = [];
    nodeFields.forEach((field) => {
      if (!isValidIdentifier(component[field])) {
        errors.push(
          makeError("INVALID_NODE_ID", `Knoten-ID in ${field} ist ungueltig.`, {
            componentId: component.id,
            componentIndex,
            field,
          })
        );
      } else {
        validNodes.push(component[field]);
        nodeIds.add(component[field]);
      }
    });

    if (validNodes.length === 2 && validNodes[0] === validNodes[1]) {
      errors.push(
        makeError(
          "SELF_CONNECTED_COMPONENT",
          `Komponente ${component.id} ist an beiden Anschluessen mit demselben Knoten verbunden.`,
          { componentId: component.id, componentIndex, nodeId: validNodes[0] }
        )
      );
    }

    validateParameter(component, componentIndex, errors);
    normalizedComponents.push(normalizeComponent(component));
  });

  if (nodeIds.size > DC_SOLVER_LIMITS.maxNodes) {
    errors.push(
      makeError(
        "NODE_LIMIT_EXCEEDED",
        `Maximal ${DC_SOLVER_LIMITS.maxNodes} Knoten sind erlaubt.`,
        { nodeCount: nodeIds.size }
      )
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  normalizedComponents.sort((left, right) => compareIdentifiers(left.id, right.id));
  const sortedNodeIds = [...nodeIds].sort(compareIdentifiers);

  return {
    ok: true,
    circuit: {
      schemaVersion: DC_SOLVER_SCHEMA_VERSION,
      analysis: DC_OPERATING_POINT_ANALYSIS,
      groundNode: circuit.groundNode,
      components: normalizedComponents,
      nodeIds: sortedNodeIds,
    },
  };
}

function orientedNodes(component) {
  if (component.type === DC_COMPONENT_TYPES.RESISTOR) {
    return [component.fromNode, component.toNode];
  }
  return [component.positiveNode, component.negativeNode];
}

function findTopologyError(circuit) {
  const groundUsed = circuit.components.some((component) =>
    orientedNodes(component).includes(circuit.groundNode)
  );

  if (!groundUsed) {
    return makeError(
      "GROUND_NODE_NOT_CONNECTED",
      `Bezugsknoten ${circuit.groundNode} ist mit keiner Komponente verbunden.`,
      { groundNode: circuit.groundNode }
    );
  }

  const adjacency = new Map(circuit.nodeIds.map((nodeId) => [nodeId, new Set()]));
  circuit.components.forEach((component) => {
    if (component.type === DC_COMPONENT_TYPES.CURRENT_SOURCE) return;
    const [fromNode, toNode] = orientedNodes(component);
    adjacency.get(fromNode).add(toNode);
    adjacency.get(toNode).add(fromNode);
  });

  const reachable = new Set([circuit.groundNode]);
  const pending = [circuit.groundNode];
  while (pending.length > 0) {
    const nodeId = pending.shift();
    for (const neighbor of adjacency.get(nodeId)) {
      if (reachable.has(neighbor)) continue;
      reachable.add(neighbor);
      pending.push(neighbor);
    }
  }

  const floatingNodeIds = circuit.nodeIds.filter((nodeId) => !reachable.has(nodeId));
  if (floatingNodeIds.length > 0) {
    return makeError(
      "FLOATING_NODE",
      "Mindestens ein Knoten besitzt keinen linearen Gleichstrompfad zum Bezugsknoten.",
      { nodeIds: floatingNodeIds }
    );
  }

  return null;
}

function createZeroMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function stampConductance(matrix, nodeIndex, groundNode, fromNode, toNode, conductanceS) {
  const from = fromNode === groundNode ? null : nodeIndex.get(fromNode);
  const to = toNode === groundNode ? null : nodeIndex.get(toNode);

  if (from !== null) matrix[from][from] += conductanceS;
  if (to !== null) matrix[to][to] += conductanceS;
  if (from !== null && to !== null) {
    matrix[from][to] -= conductanceS;
    matrix[to][from] -= conductanceS;
  }
}

function stampCurrent(rhs, nodeIndex, groundNode, positiveNode, negativeNode, currentA) {
  if (positiveNode !== groundNode) rhs[nodeIndex.get(positiveNode)] -= currentA;
  if (negativeNode !== groundNode) rhs[nodeIndex.get(negativeNode)] += currentA;
}

function stampVoltageSource(
  matrix,
  rhs,
  nodeIndex,
  groundNode,
  sourceIndex,
  positiveNode,
  negativeNode,
  voltageV
) {
  if (positiveNode !== groundNode) {
    const positive = nodeIndex.get(positiveNode);
    matrix[positive][sourceIndex] += 1;
    matrix[sourceIndex][positive] += 1;
  }
  if (negativeNode !== groundNode) {
    const negative = nodeIndex.get(negativeNode);
    matrix[negative][sourceIndex] -= 1;
    matrix[sourceIndex][negative] -= 1;
  }
  rhs[sourceIndex] += voltageV;
}

function rowScale(row, startColumn = 0) {
  let scale = 0;
  for (let column = startColumn; column < row.length; column += 1) {
    scale = Math.max(scale, Math.abs(row[column]));
  }
  return scale;
}

export function solveDeterministicLinearSystem(originalMatrix, originalRhs) {
  const size = originalMatrix.length;
  const matrix = originalMatrix.map((row) => [...row]);
  const rhs = [...originalRhs];
  const initialRowScales = matrix.map((row) => rowScale(row));
  const initialRhsScales = rhs.map((value) => Math.abs(value));
  const pivots = [];
  let pivotRow = 0;

  for (let column = 0; column < size && pivotRow < size; column += 1) {
    let bestRow = -1;
    let bestScore = 0;

    for (let candidate = pivotRow; candidate < size; candidate += 1) {
      const scale = rowScale(matrix[candidate], column);
      if (scale === 0) continue;
      const score = Math.abs(matrix[candidate][column]) / scale;
      if (score > bestScore) {
        bestScore = score;
        bestRow = candidate;
      }
    }

    if (bestRow < 0 || bestScore <= RELATIVE_PIVOT_TOLERANCE) continue;

    if (bestRow !== pivotRow) {
      [matrix[pivotRow], matrix[bestRow]] = [matrix[bestRow], matrix[pivotRow]];
      [rhs[pivotRow], rhs[bestRow]] = [rhs[bestRow], rhs[pivotRow]];
      [initialRowScales[pivotRow], initialRowScales[bestRow]] = [
        initialRowScales[bestRow],
        initialRowScales[pivotRow],
      ];
      [initialRhsScales[pivotRow], initialRhsScales[bestRow]] = [
        initialRhsScales[bestRow],
        initialRhsScales[pivotRow],
      ];
    }

    const pivot = matrix[pivotRow][column];
    for (let row = pivotRow + 1; row < size; row += 1) {
      const factor = matrix[row][column] / pivot;
      if (factor === 0) continue;
      matrix[row][column] = 0;
      for (let nextColumn = column + 1; nextColumn < size; nextColumn += 1) {
        matrix[row][nextColumn] -= factor * matrix[pivotRow][nextColumn];
      }
      rhs[row] -= factor * rhs[pivotRow];
    }

    pivots.push({ row: pivotRow, column });
    pivotRow += 1;
  }

  for (let row = 0; row < size; row += 1) {
    const coefficientMagnitude = rowScale(matrix[row]);
    const coefficientTolerance =
      RELATIVE_CONSISTENCY_TOLERANCE * Math.max(initialRowScales[row], Number.MIN_VALUE);
    if (coefficientMagnitude > coefficientTolerance) continue;

    const rhsTolerance =
      RELATIVE_CONSISTENCY_TOLERANCE * Math.max(initialRhsScales[row], 1);
    if (Math.abs(rhs[row]) > rhsTolerance) {
      return {
        ok: false,
        code: "INCONSISTENT_CIRCUIT",
        message: "Die idealen Quellenbedingungen widersprechen sich.",
      };
    }
  }

  if (pivots.length < size) {
    return {
      ok: false,
      code: "SINGULAR_CIRCUIT",
      message: "Das Gleichungssystem besitzt keine eindeutige Loesung.",
    };
  }

  const solution = Array(size).fill(0);
  for (let index = pivots.length - 1; index >= 0; index -= 1) {
    const { row, column } = pivots[index];
    let remainder = rhs[row];
    for (let nextColumn = column + 1; nextColumn < size; nextColumn += 1) {
      remainder -= matrix[row][nextColumn] * solution[nextColumn];
    }
    solution[column] = remainder / matrix[row][column];
  }

  if (solution.some((value) => !Number.isFinite(value))) {
    return {
      ok: false,
      code: "NUMERICAL_FAILURE",
      message: "Die lineare Berechnung erzeugte keinen endlichen Wert.",
    };
  }

  let maxNormalizedResidual = 0;
  for (let row = 0; row < size; row += 1) {
    let calculated = 0;
    let scale = Math.abs(originalRhs[row]);
    for (let column = 0; column < size; column += 1) {
      const contribution = originalMatrix[row][column] * solution[column];
      calculated += contribution;
      scale += Math.abs(contribution);
    }
    const normalizedResidual = Math.abs(calculated - originalRhs[row]) / Math.max(scale, 1e-30);
    maxNormalizedResidual = Math.max(maxNormalizedResidual, normalizedResidual);
  }

  if (!Number.isFinite(maxNormalizedResidual) || maxNormalizedResidual > MAX_NORMALIZED_RESIDUAL) {
    return {
      ok: false,
      code: "NUMERICAL_FAILURE",
      message: "Die lineare Berechnung ueberschreitet die Residuumgrenze.",
      maxNormalizedResidual,
    };
  }

  return { ok: true, solution, maxNormalizedResidual };
}

function buildMnaSystem(circuit) {
  const nonGroundNodes = circuit.nodeIds.filter((nodeId) => nodeId !== circuit.groundNode);
  const nodeIndex = new Map(nonGroundNodes.map((nodeId, index) => [nodeId, index]));
  const voltageSources = circuit.components.filter(
    (component) => component.type === DC_COMPONENT_TYPES.VOLTAGE_SOURCE
  );
  const voltageSourceIndex = new Map(
    voltageSources.map((component, index) => [component.id, nonGroundNodes.length + index])
  );
  const dimension = nonGroundNodes.length + voltageSources.length;
  const matrix = createZeroMatrix(dimension);
  const rhs = Array(dimension).fill(0);

  circuit.components.forEach((component) => {
    if (component.type === DC_COMPONENT_TYPES.RESISTOR) {
      stampConductance(
        matrix,
        nodeIndex,
        circuit.groundNode,
        component.fromNode,
        component.toNode,
        1 / component.resistanceOhm
      );
      return;
    }

    if (component.type === DC_COMPONENT_TYPES.CURRENT_SOURCE) {
      stampCurrent(
        rhs,
        nodeIndex,
        circuit.groundNode,
        component.positiveNode,
        component.negativeNode,
        component.currentA
      );
      return;
    }

    stampVoltageSource(
      matrix,
      rhs,
      nodeIndex,
      circuit.groundNode,
      voltageSourceIndex.get(component.id),
      component.positiveNode,
      component.negativeNode,
      component.voltageV
    );
  });

  return { matrix, rhs, nonGroundNodes, nodeIndex, voltageSourceIndex };
}

function createBranchResult(component, voltageByNode, voltageSourceIndex, solution) {
  const [fromNode, toNode] = orientedNodes(component);
  const voltageV = voltageByNode.get(fromNode) - voltageByNode.get(toNode);
  let currentA;

  if (component.type === DC_COMPONENT_TYPES.RESISTOR) {
    currentA = voltageV / component.resistanceOhm;
  } else if (component.type === DC_COMPONENT_TYPES.CURRENT_SOURCE) {
    currentA = component.currentA;
  } else {
    currentA = solution[voltageSourceIndex.get(component.id)];
  }

  return {
    componentId: component.id,
    componentType: component.type,
    fromNode,
    toNode,
    voltageV: normalizeZero(voltageV),
    currentA: normalizeZero(currentA),
    powerW: normalizeZero(voltageV * currentA),
  };
}

export function getDcLearningSolverCapabilities() {
  return {
    schemaVersion: DC_SOLVER_SCHEMA_VERSION,
    modelVersion: DC_SOLVER_MODEL_VERSION,
    analyses: [DC_OPERATING_POINT_ANALYSIS],
    componentTypes: [...SUPPORTED_COMPONENT_TYPES].sort(compareIdentifiers),
    limits: { ...DC_SOLVER_LIMITS },
  };
}

export function solveDcOperatingPoint(circuit) {
  const validation = validateDcCircuit(circuit);
  if (!validation.ok) {
    return {
      ok: false,
      schemaVersion: DC_SOLVER_SCHEMA_VERSION,
      analysis: DC_OPERATING_POINT_ANALYSIS,
      errors: validation.errors,
    };
  }

  const normalizedCircuit = validation.circuit;
  const topologyError = findTopologyError(normalizedCircuit);
  if (topologyError) {
    return {
      ok: false,
      schemaVersion: DC_SOLVER_SCHEMA_VERSION,
      analysis: DC_OPERATING_POINT_ANALYSIS,
      errors: [topologyError],
    };
  }

  const system = buildMnaSystem(normalizedCircuit);
  const solved = solveDeterministicLinearSystem(system.matrix, system.rhs);
  if (!solved.ok) {
    return {
      ok: false,
      schemaVersion: DC_SOLVER_SCHEMA_VERSION,
      analysis: DC_OPERATING_POINT_ANALYSIS,
      errors: [
        makeError(solved.code, solved.message, {
          ...(solved.maxNormalizedResidual === undefined
            ? {}
            : { maxNormalizedResidual: solved.maxNormalizedResidual }),
        }),
      ],
    };
  }

  const voltageByNode = new Map([[normalizedCircuit.groundNode, 0]]);
  system.nonGroundNodes.forEach((nodeId, index) => {
    voltageByNode.set(nodeId, normalizeZero(solved.solution[index]));
  });

  const nodeVoltages = [
    { nodeId: normalizedCircuit.groundNode, voltageV: 0 },
    ...system.nonGroundNodes.map((nodeId) => ({
      nodeId,
      voltageV: voltageByNode.get(nodeId),
    })),
  ];

  const branches = normalizedCircuit.components.map((component) =>
    createBranchResult(component, voltageByNode, system.voltageSourceIndex, solved.solution)
  );
  const powerBalanceW = branches.reduce((sum, branch) => sum + branch.powerW, 0);

  return {
    ok: true,
    schemaVersion: DC_SOLVER_SCHEMA_VERSION,
    analysis: DC_OPERATING_POINT_ANALYSIS,
    groundNode: normalizedCircuit.groundNode,
    nodeVoltages,
    branches,
    diagnostics: {
      solver: "deterministic-linear-mna",
      modelVersion: DC_SOLVER_MODEL_VERSION,
      componentCount: normalizedCircuit.components.length,
      nodeCount: normalizedCircuit.nodeIds.length,
      matrixDimension: system.matrix.length,
      maxNormalizedResidual: normalizeZero(solved.maxNormalizedResidual),
      powerBalanceW: normalizeZero(powerBalanceW),
    },
  };
}
