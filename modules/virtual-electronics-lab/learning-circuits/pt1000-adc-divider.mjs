import {
  PT1000_MODEL,
  evaluatePt1000,
} from "../environment-models/pt1000.mjs";
import {
  DC_OPERATING_POINT_ANALYSIS,
  DC_SOLVER_SCHEMA_VERSION,
  DC_SOLVER_MODEL_VERSION,
  DC_COMPONENT_TYPES,
  solveDcOperatingPoint,
} from "../learning-solver/dc-operating-point.mjs";
import {
  ADC_QUANTIZER_MODEL,
  quantizeAdcSample,
} from "../peripherals/adc-quantizer.mjs";

const GROUND_NODE = "0";
const SUPPLY_NODE = "vcc";
const SENSE_NODE = "sense";

export const PT1000_ADC_DIVIDER_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-pt1000-adc-divider",
  modelVersion: "1.0.0",
  architecture: "idealized",
  inputQuantity: "temperature",
  inputUnit: "degC",
  outputQuantity: "adc-code",
  outputUnit: "code",
  dependencies: Object.freeze({
    pt1000ModelId: PT1000_MODEL.modelId,
    dcSolverModelVersion: DC_SOLVER_MODEL_VERSION,
    adcQuantizerModelId: ADC_QUANTIZER_MODEL.modelId,
    adcQuantizerModelVersion: ADC_QUANTIZER_MODEL.modelVersion,
  }),
});

function resolveDividerCircuit(temperatureC, supplyVoltageV, fixedResistanceOhm) {
  const pt1000 = evaluatePt1000(temperatureC);
  if (!pt1000.ok) {
    return { ok: false, errorSource: "pt1000", errors: pt1000.errors };
  }

  const circuit = {
    schemaVersion: DC_SOLVER_SCHEMA_VERSION,
    analysis: DC_OPERATING_POINT_ANALYSIS,
    groundNode: GROUND_NODE,
    components: [
      {
        id: "VCC",
        type: DC_COMPONENT_TYPES.VOLTAGE_SOURCE,
        positiveNode: SUPPLY_NODE,
        negativeNode: GROUND_NODE,
        voltageV: supplyVoltageV,
      },
      {
        id: "R_FIXED",
        type: DC_COMPONENT_TYPES.RESISTOR,
        fromNode: SUPPLY_NODE,
        toNode: SENSE_NODE,
        resistanceOhm: fixedResistanceOhm,
      },
      {
        id: "R_PT1000",
        type: DC_COMPONENT_TYPES.RESISTOR,
        fromNode: SENSE_NODE,
        toNode: GROUND_NODE,
        resistanceOhm: pt1000.result.resistanceOhm,
      },
    ],
  };

  return {
    ok: true,
    pt1000: pt1000.result,
    circuit,
  };
}

export function evaluatePt1000AdcDivider({
  temperatureC,
  supplyVoltageV = 3.3,
  fixedResistanceOhm = 1000,
  resolutionBits = 12,
}) {
  const divider = resolveDividerCircuit(temperatureC, supplyVoltageV, fixedResistanceOhm);
  if (!divider.ok) {
    return {
      ok: false,
      errorSource: divider.errorSource,
      errors: divider.errors,
      modelId: PT1000_ADC_DIVIDER_MODEL.modelId,
      modelVersion: PT1000_ADC_DIVIDER_MODEL.modelVersion,
    };
  }

  const solved = solveDcOperatingPoint(divider.circuit);
  if (!solved.ok) {
    return {
      ok: false,
      errorSource: "dc-solver",
      errors: solved.errors,
      modelId: PT1000_ADC_DIVIDER_MODEL.modelId,
      modelVersion: PT1000_ADC_DIVIDER_MODEL.modelVersion,
    };
  }

  const senseVoltageV = solved.nodeVoltages.find((entry) => entry.nodeId === SENSE_NODE).voltageV;
  const dividerCurrentA = solved.branches.find((branch) => branch.componentId === "R_FIXED").currentA;

  const quantized = quantizeAdcSample({
    inputVoltageV: senseVoltageV,
    referenceVoltageV: supplyVoltageV,
    resolutionBits,
  });
  if (!quantized.ok) {
    return {
      ok: false,
      errorSource: "adc-quantizer",
      errors: quantized.errors,
      modelId: PT1000_ADC_DIVIDER_MODEL.modelId,
      modelVersion: PT1000_ADC_DIVIDER_MODEL.modelVersion,
    };
  }

  return {
    ok: true,
    result: Object.freeze({
      temperatureC,
      modelId: PT1000_ADC_DIVIDER_MODEL.modelId,
      modelVersion: PT1000_ADC_DIVIDER_MODEL.modelVersion,
      supplyVoltageV,
      fixedResistanceOhm,
      resolutionBits,
      sensorResistanceOhm: divider.pt1000.resistanceOhm,
      senseVoltageV,
      dividerCurrentA,
      adcCode: quantized.result.code,
      adcQuantizedVoltageV: quantized.result.quantizedVoltageV,
      pt1000ModelId: PT1000_MODEL.modelId,
      pt1000ModelVersion: PT1000_MODEL.modelVersion,
      dcSolverModelVersion: DC_SOLVER_MODEL_VERSION,
      adcQuantizerModelId: ADC_QUANTIZER_MODEL.modelId,
      adcQuantizerModelVersion: ADC_QUANTIZER_MODEL.modelVersion,
    }),
    warnings: quantized.warnings,
  };
}
