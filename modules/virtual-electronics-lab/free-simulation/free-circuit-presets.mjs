import {
  FREE_CIRCUIT_COMMAND_TYPES,
  createFreeCircuitCommandRuntime,
} from "./free-circuit-command-runtime.mjs";

export const FREE_DC_DIVIDER_PRESET_ID = "dc-divider";
export const FREE_EMPTY_PRESET_ID = "empty";
export const FREE_RC_CHARGE_PRESET_ID = "rc-charge";
export const FREE_RC_LOWPASS_PRESET_ID = "rc-lowpass";

export function createFreeEmptyMeasurementSetup() {
  return {
    schemaVersion: "1.0.0",
    id: "empty-workbench-measurements",
    points: [],
    voltageProbes: [],
  };
}

export function createFreeEmptyDocument() {
  return createFreeCircuitCommandRuntime().getSnapshot();
}

export function createFreeDcDividerMeasurementSetup() {
  return {
    schemaVersion: "1.0.0",
    id: "dc-divider-measurements",
    points: [
      { id: "mp-gnd", label: "Masse", nodeId: "gnd" },
      { id: "mp-mid", label: "Teilermitte", nodeId: "r1-n" },
    ],
    voltageProbes: [
      { id: "probe-1", label: "Tastkopf 1", positivePointId: "mp-mid", referencePointId: "mp-gnd" },
    ],
  };
}

export function createFreeDcDividerDocument() {
  const runtime = createFreeCircuitCommandRuntime();
  const add = (componentId, componentType) => runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent,
    componentId,
    componentType,
  });
  const connect = (fromComponent, fromPort, toComponent, toPort) => runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: fromComponent, portId: fromPort },
    to: { componentId: toComponent, portId: toPort },
  });

  add("gnd1", "gnd");
  add("v1", "dc-voltage-source");
  add("r1", "resistor");
  add("r2", "resistor");
  connect("v1", "n", "gnd1", "0");
  connect("v1", "p", "r1", "p");
  connect("r1", "n", "r2", "p");
  connect("r2", "n", "gnd1", "0");
  return runtime.getSnapshot();
}

export function createFreeRcChargeMeasurementSetup() {
  return {
    schemaVersion: "1.0.0",
    id: "rc-charge-measurements",
    points: [
      { id: "mp-gnd", label: "Masse", nodeId: "gnd" },
      { id: "mp-cap", label: "Kondensator", nodeId: "c1-p" },
    ],
    voltageProbes: [
      { id: "probe-1", label: "Tastkopf 1", positivePointId: "mp-cap", referencePointId: "mp-gnd" },
    ],
  };
}

export function createFreeRcChargeDocument() {
  const runtime = createFreeCircuitCommandRuntime();
  const add = (componentId, componentType) => runtime.dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent, componentId, componentType });
  const connect = (fromComponent, fromPort, toComponent, toPort) => runtime.dispatch({
    type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
    from: { componentId: fromComponent, portId: fromPort },
    to: { componentId: toComponent, portId: toPort },
  });
  add("gnd1", "gnd");
  add("v1", "dc-voltage-source");
  add("r1", "resistor");
  add("c1", "capacitor");
  connect("v1", "n", "gnd1", "0");
  connect("v1", "p", "r1", "p");
  connect("r1", "n", "c1", "p");
  connect("c1", "n", "gnd1", "0");
  return runtime.getSnapshot();
}

export function createFreeRcLowpassDocument() {
  return createFreeRcChargeDocument();
}

export function createFreeRcLowpassMeasurementSetup() {
  return createFreeRcChargeMeasurementSetup();
}
