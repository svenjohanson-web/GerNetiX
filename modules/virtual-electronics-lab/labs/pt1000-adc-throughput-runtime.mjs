import {
  evaluatePt1000AdcDivider,
} from "../learning-circuits/pt1000-adc-divider.mjs";
import {
  ADC_PROGRAM_RUNTIME_MODEL,
  ADC_PROGRAM_START_CODE,
  executeAdcProgram,
} from "../virtual-mcu/adc-program-runtime.mjs";

export const COMMAND_TYPES = {
  UpdateSourceFile: "UpdateSourceFile",
  SetTemperature: "SetTemperature",
  StartSimulation: "StartSimulation",
  ResetSimulation: "ResetSimulation",
};

const COMMAND_SYNTAX_ERROR = "PT1000_RUNTIME_COMMAND_INVALID";
const COMMAND_NOT_SUPPORTED = "PT1000_RUNTIME_COMMAND_NOT_SUPPORTED";
const INCONSISTENT_ERROR = "ADC_MEASUREMENT_CHAIN_INCONSISTENT";

const DEFAULT_STATE = Object.freeze({
  temperatureC: 0,
  supplyVoltageV: 3.3,
  referenceVoltageV: 3.3,
  fixedResistanceOhm: 1000,
  resolutionBits: 12,
  sourceFile: ADC_PROGRAM_START_CODE,
});

const LAB_PROJECT_METADATA = Object.freeze({
  id: "elab-par-006-pt1000-adc-throughput",
  kind: "virtual-electronics-lab-project",
  title: "PT1000-ADC-Programmdurchstich",
});

function normalizeSource(source) {
  return String(source ?? "").replace(/\r\n/g, "\n");
}

function toLineColumn(source, position) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }

  for (let index = starts.length - 1; index >= 0; index -= 1) {
    if (starts[index] <= position) {
      return {
        line: index + 1,
        column: position - starts[index] + 1,
      };
    }
  }

  return { line: 1, column: position + 1 };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

function clone(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => clone(entry));
  }
  if (value && typeof value === "object") {
    const next = {};
    for (const key of Object.keys(value)) {
      next[key] = clone(value[key]);
    }
    return next;
  }
  return value;
}

function cloneSnapshot(snapshot) {
  return deepFreeze(clone(snapshot));
}

function cloneErrors(errors) {
  if (!Array.isArray(errors)) {
    return null;
  }
  return Object.freeze(clone(errors));
}

function commandError(code, message, sourceForPosition = ADC_PROGRAM_START_CODE) {
  const location = toLineColumn(sourceForPosition, 0);
  return {
    ok: false,
    errorSource: "pt1000-runtime",
    errors: [{
      code,
      message,
      line: location.line,
      column: location.column,
    }],
  };
}

function dedupeWarnings(warnings) {
  if (!Array.isArray(warnings)) return Object.freeze([]);

  const seen = new Set();
  const normalized = [];

  for (const warning of warnings) {
    if (!warning || typeof warning !== "object") {
      continue;
    }
    const key = `${warning.code || ""}|${warning.message || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(clone(warning));
  }

  return Object.freeze(normalized);
}

function createLabProject(state) {
  const divider = evaluatePt1000AdcDivider({
    temperatureC: state.temperatureC,
    supplyVoltageV: state.supplyVoltageV,
    fixedResistanceOhm: state.fixedResistanceOhm,
    resolutionBits: state.resolutionBits,
  });

  const modelVersions = divider.ok
    ? {
      pt1000AdcDivider: divider.result.modelVersion,
      pt1000: divider.result.pt1000ModelVersion,
      dcSolver: divider.result.dcSolverModelVersion,
      adcQuantizer: divider.result.adcQuantizerModelVersion,
      adcProgramRuntime: ADC_PROGRAM_RUNTIME_MODEL.modelVersion,
    }
    : {
      pt1000AdcDivider: null,
      pt1000: null,
      dcSolver: null,
      adcQuantizer: null,
      adcProgramRuntime: ADC_PROGRAM_RUNTIME_MODEL.modelVersion,
    };

  const project = {
    schemaVersion: "1.0.0",
    metadata: {
      ...clone(LAB_PROJECT_METADATA),
    },
    environment: {
      ambientTemperatureC: state.temperatureC,
      supplyVoltageV: state.supplyVoltageV,
      referenceVoltageV: state.referenceVoltageV,
      fixedResistanceOhm: state.fixedResistanceOhm,
      resolutionBits: state.resolutionBits,
      controllerSourceHash: null,
    },
    controller: {
      sourceFile: state.sourceFile,
    },
    modelVersions: {
      ...modelVersions,
    },
  };

  project.environment.controllerSourceHash = createSourceHash(state.sourceFile);
  return deepFreeze(project);
}

function createSourceHash(sourceFile) {
  let hash = 0x811c9dc5;
  const source = normalizeSource(sourceFile);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function combineWarningsFromDividerAndProgram(dividerResult, programResult) {
  return dedupeWarnings([
    ...dividerResult.warnings,
    ...programResult.warnings,
  ]);
}

function runThroughput({
  sourceFile,
  temperatureC,
  supplyVoltageV,
  referenceVoltageV,
  fixedResistanceOhm,
  resolutionBits,
}) {
  const divider = evaluatePt1000AdcDivider({
    temperatureC,
    supplyVoltageV,
    fixedResistanceOhm,
    resolutionBits,
  });
  if (!divider.ok) {
    return {
      ok: false,
      errorSource: divider.errorSource,
      errors: divider.errors,
      warnings: Object.freeze([]),
    };
  }

  const program = executeAdcProgram({
    sourceFile,
    analogInputs: { A0: divider.result.senseVoltageV },
    referenceVoltageV,
    resolutionBits,
  });
  if (!program.ok) {
    return {
      ok: false,
      errorSource: program.errorSource,
      errors: program.errors,
      warnings: dedupeWarnings(program.warnings || []),
      result: null,
    };
  }

  if (program.result.adc.code !== divider.result.adcCode) {
    return {
      ok: false,
      errorSource: "pt1000-adc-throughput-runtime",
      errors: [{
        code: INCONSISTENT_ERROR,
        message: "ADC-Messkette und Programmlaufzeit liefern unterschiedliche Codes.",
        line: 1,
        column: 1,
      }],
      warnings: combineWarningsFromDividerAndProgram(divider, program),
      result: null,
    };
  }

  return {
    ok: true,
    result: Object.freeze({
      temperatureC: divider.result.temperatureC,
      sensorResistanceOhm: divider.result.sensorResistanceOhm,
      senseVoltageV: divider.result.senseVoltageV,
      dividerCurrentA: divider.result.dividerCurrentA,
      adcCode: program.result.adc.code,
      adcQuantizedVoltageV: program.result.adc.quantizedVoltageV,
      adcValue: program.result.variables.adcValue,
      sourceHash: program.result.sourceHash,
      modelVersions: Object.freeze({
        pt1000AdcDivider: divider.result.modelVersion,
        pt1000: divider.result.pt1000ModelVersion,
        dcSolver: divider.result.dcSolverModelVersion,
        adcQuantizer: divider.result.adcQuantizerModelVersion,
        adcProgramRuntime: program.result.modelVersions.runtime,
        adcQuantizerRuntime: program.result.modelVersions.adcQuantizer,
      }),
      warnings: combineWarningsFromDividerAndProgram(divider, program),
    }),
  };
}

export function createPt1000ThroughputRuntime({
  sourceFile = DEFAULT_STATE.sourceFile,
  temperatureC = DEFAULT_STATE.temperatureC,
  supplyVoltageV = DEFAULT_STATE.supplyVoltageV,
  referenceVoltageV = DEFAULT_STATE.referenceVoltageV,
  fixedResistanceOhm = DEFAULT_STATE.fixedResistanceOhm,
  resolutionBits = DEFAULT_STATE.resolutionBits,
} = {}) {
  let normalizedSource = normalizeSource(sourceFile);
  let state = {
    sourceFile: normalizedSource,
    temperatureC,
    supplyVoltageV,
    referenceVoltageV,
    fixedResistanceOhm,
    resolutionBits,
    measurement: null,
    error: null,
    errorSource: null,
    labProject: null,
  };

  const initialProject = createLabProject({
    temperatureC,
    supplyVoltageV,
    referenceVoltageV,
    fixedResistanceOhm,
    resolutionBits,
    sourceFile: normalizedSource,
  });
  state = {
    ...state,
    labProject: initialProject,
  };

  const resetState = { ...DEFAULT_STATE, sourceFile: normalizeSource(ADC_PROGRAM_START_CODE) };

  function setRuntimeError(errorSource, errors) {
    state = {
      ...state,
      measurement: null,
      error: cloneErrors(errors),
      errorSource,
    };
  }

  function clearRuntimeError() {
    state = {
      ...state,
      measurement: null,
      error: null,
      errorSource: null,
    };
  }

  function setSource(nextSource, updateError = true) {
    const normalized = normalizeSource(nextSource);
    state = {
      ...state,
      sourceFile: normalized,
      labProject: createLabProject({
        temperatureC: state.temperatureC,
        supplyVoltageV: state.supplyVoltageV,
        referenceVoltageV: state.referenceVoltageV,
        fixedResistanceOhm: state.fixedResistanceOhm,
        resolutionBits: state.resolutionBits,
        sourceFile: normalized,
      }),
      ...(updateError
        ? {
          measurement: null,
          error: null,
          errorSource: null,
        }
        : {}),
    };
    return state;
  }

  function validateTemperature(nextTemperature) {
    const divider = evaluatePt1000AdcDivider({
      temperatureC: nextTemperature,
      supplyVoltageV: state.supplyVoltageV,
      fixedResistanceOhm: state.fixedResistanceOhm,
      resolutionBits: state.resolutionBits,
    });
    return divider;
  }

  function dispatch(command) {
    if (!command || typeof command.type !== "string") {
      return commandError(COMMAND_SYNTAX_ERROR, "Ungültiges Command-Objekt.", ADC_PROGRAM_START_CODE);
    }

    if (command.type === COMMAND_TYPES.UpdateSourceFile) {
      if (typeof command.sourceFile !== "string") {
        return commandError(COMMAND_SYNTAX_ERROR, "UpdateSourceFile erwartet sourceFile als String.", command.sourceFile);
      }
      setSource(command.sourceFile);
      return { ok: true, sourceFile: state.sourceFile, measurement: state.measurement, error: state.error };
    }

    if (command.type === COMMAND_TYPES.SetTemperature) {
      if (!Number.isFinite(command.temperatureC)) {
        return commandError(COMMAND_SYNTAX_ERROR, "SetTemperature benötigt eine finite Temperatur.");
      }

      const divider = validateTemperature(command.temperatureC);
      if (!divider.ok) {
        const errors = cloneErrors(divider.errors);
        state = {
          ...state,
          measurement: null,
          error: errors,
          errorSource: divider.errorSource,
        };
        return {
          ok: false,
          errorSource: state.errorSource,
          errors: cloneErrors(state.error),
        };
      }

      setSource(state.sourceFile, false);
      state = {
        ...state,
        temperatureC: command.temperatureC,
        measurement: null,
        error: null,
        errorSource: null,
        labProject: createLabProject({
          temperatureC: command.temperatureC,
          supplyVoltageV: state.supplyVoltageV,
          referenceVoltageV: state.referenceVoltageV,
          fixedResistanceOhm: state.fixedResistanceOhm,
          resolutionBits: state.resolutionBits,
          sourceFile: state.sourceFile,
        }),
      };
      return { ok: true, temperatureC: state.temperatureC };
    }

    if (command.type === COMMAND_TYPES.StartSimulation) {
      const result = runThroughput(state);
      if (!result.ok) {
        setRuntimeError(result.errorSource, result.errors);
        return {
          ok: false,
          errors: cloneErrors(result.errors),
          errorSource: state.errorSource,
          measurement: null,
          sourceFile: state.sourceFile,
        };
      }

      state = {
        ...state,
        measurement: clone(result.result),
        error: null,
        errorSource: null,
        labProject: {
          ...state.labProject,
          modelVersions: {
            ...(state.labProject?.modelVersions || {}),
            ...result.result.modelVersions,
          },
        },
      };
      return {
        ok: true,
        measurement: clone(state.measurement),
        sourceFile: state.sourceFile,
      };
    }

    if (command.type === COMMAND_TYPES.ResetSimulation) {
      normalizedSource = resetState.sourceFile;
      state = {
        ...state,
        sourceFile: normalizedSource,
        temperatureC: resetState.temperatureC,
        supplyVoltageV: resetState.supplyVoltageV,
        referenceVoltageV: resetState.referenceVoltageV,
        fixedResistanceOhm: resetState.fixedResistanceOhm,
        resolutionBits: resetState.resolutionBits,
        labProject: createLabProject({
          ...resetState,
          sourceFile: normalizedSource,
        }),
      };
      clearRuntimeError();
      return {
        ok: true,
        sourceFile: state.sourceFile,
        temperatureC: state.temperatureC,
      };
    }

    return {
      ok: false,
      errorSource: "pt1000-runtime",
      errors: [{
        code: COMMAND_NOT_SUPPORTED,
        message: `Unbekannter Command ${command.type}.`,
        line: 1,
        column: 1,
      }],
    };
  }

  function getSnapshot() {
    const copy = cloneSnapshot({
      sourceFile: state.sourceFile,
      temperatureC: state.temperatureC,
      measurement: state.measurement ? clone(state.measurement) : null,
      error: state.error ? clone(state.error) : null,
      errorSource: state.errorSource,
      labProject: clone(state.labProject),
    });
    return copy;
  }

  return {
    dispatch,
    getSnapshot,
  };
}
