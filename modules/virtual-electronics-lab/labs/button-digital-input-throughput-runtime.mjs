import {
  BUTTON_CONTACT_MODEL,
  evaluateButtonContact,
} from "../input-models/button-contact.mjs";
import {
  FLOATING_DIGITAL_INPUT_MODEL,
  evaluateFloatingDigitalInput,
} from "../input-models/floating-digital-input.mjs";
import {
  DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL,
  DIGITAL_INPUT_PROGRAM_START_CODE,
  executeDigitalInputProgram,
} from "../virtual-mcu/digital-input-program-runtime.mjs";

export const COMMAND_TYPES = Object.freeze({
  SetButtonPressed: "SetButtonPressed",
  SetContactReference: "SetContactReference",
  UpdateSourceFile: "UpdateSourceFile",
  AdvanceFloatingSample: "AdvanceFloatingSample",
  StartSimulation: "StartSimulation",
  ResetSimulation: "ResetSimulation",
});

const COMMAND_SYNTAX_ERROR = "BUTTON_DIGITAL_RUNTIME_COMMAND_INVALID";
const COMMAND_NOT_SUPPORTED = "BUTTON_DIGITAL_RUNTIME_COMMAND_NOT_SUPPORTED";
const CHAIN_INCONSISTENT_ERROR = "BUTTON_DIGITAL_CHAIN_INCONSISTENT";
const BUTTON_PIN = 4;
const DEFAULT_SOURCE = DIGITAL_INPUT_PROGRAM_START_CODE;
const DEFAULT_PRESSED = false;
const DEFAULT_CONTACT_REFERENCE_MODE = "auto";
const DEFAULT_FLOATING_SAMPLE_INDEX = 0;
const FLOATING_SAMPLE_INDEX_MODULO = 64;
const CONTACT_REFERENCE_MODES = Object.freeze({
  auto: "auto",
  gnd: "gnd",
  vcc: "vcc",
});

const LAB_PROJECT_METADATA = Object.freeze({
  id: "elab-seq-005-button-digital-input-throughput",
  kind: "virtual-electronics-lab-project",
  title: "Button → Digital Input Throughput",
});

const DEFAULT_STATE = Object.freeze({
  pressed: DEFAULT_PRESSED,
  sourceFile: DEFAULT_SOURCE,
  contactReferenceMode: DEFAULT_CONTACT_REFERENCE_MODE,
  floatingSampleIndex: DEFAULT_FLOATING_SAMPLE_INDEX,
});

function normalizeSource(value) {
  return String(value ?? "").replace(/\r\n/g, "\n");
}

function toLineColumn(source, position) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
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

function clone(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => clone(entry));
  }

  if (value && typeof value === "object") {
    const copy = {};
    for (const key of Object.keys(value)) {
      copy[key] = clone(value[key]);
    }
    return copy;
  }

  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }

  return value;
}

function cloneSnapshot(value) {
  return deepFreeze(clone(value));
}

function freezeMeasurement(value) {
  return deepFreeze(clone(value));
}

function cloneErrors(errors) {
  if (!Array.isArray(errors)) {
    return null;
  }
  return freezeMeasurement(errors);
}

function commandError(code, message, sourceForPosition = DEFAULT_SOURCE) {
  const location = toLineColumn(sourceForPosition, 0);
  return {
    ok: false,
    errorSource: "button-digital-input-throughput-runtime",
    errors: [{
      code,
      message,
      line: location.line,
      column: location.column,
    }],
  };
}

function dedupeWarnings(warnings) {
  if (!Array.isArray(warnings)) {
    return Object.freeze([]);
  }

  const seen = new Set();
  const deduped = [];

  for (const warning of warnings) {
    if (!warning || typeof warning !== "object") {
      continue;
    }

    const key = `${warning.code || ""}|${warning.message || ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(deepFreeze(clone(warning)));
  }

  return Object.freeze(deduped);
}

function pullModeFromProgram(programPullMode) {
  if (programPullMode === "INPUT_PULLUP") {
    return "pull-up";
  }
  if (programPullMode === "INPUT_PULLDOWN") {
    return "pull-down";
  }
  return null;
}

function isContactReferenceMode(value) {
  return value === CONTACT_REFERENCE_MODES.auto
    || value === CONTACT_REFERENCE_MODES.gnd
    || value === CONTACT_REFERENCE_MODES.vcc;
}

function normalizeContactReferenceMode(value) {
  return isContactReferenceMode(value) ? value : DEFAULT_CONTACT_REFERENCE_MODE;
}

function createLabProject({
  pressed,
  sourceFile,
  contactReferenceMode = DEFAULT_CONTACT_REFERENCE_MODE,
  floatingSampleIndex = DEFAULT_FLOATING_SAMPLE_INDEX,
}) {
  return deepFreeze({
    schemaVersion: "1.1.0",
    metadata: {
      ...clone(LAB_PROJECT_METADATA),
    },
    button: {
      pressed,
      pin: BUTTON_PIN,
      contactReferenceMode,
      floatingSampleIndex,
    },
    controller: {
      sourceFile: normalizeSource(sourceFile),
    },
    modelVersions: {
      buttonContact: BUTTON_CONTACT_MODEL.modelVersion,
      digitalInputProgramRuntime: DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelVersion,
      floatingDigitalInput: FLOATING_DIGITAL_INPUT_MODEL.modelVersion,
    },
  });
}

function resolveContactReference(contactReferenceMode) {
  if (contactReferenceMode === CONTACT_REFERENCE_MODES.gnd) {
    return "gnd";
  }
  if (contactReferenceMode === CONTACT_REFERENCE_MODES.vcc) {
    return "vcc";
  }
  return undefined;
}

function resolveInputContactReference(contactReferenceMode) {
  if (contactReferenceMode === CONTACT_REFERENCE_MODES.vcc) {
    return CONTACT_REFERENCE_MODES.vcc;
  }

  return CONTACT_REFERENCE_MODES.gnd;
}

function resolveInputPressedLevel(contactReferenceMode) {
  return resolveInputContactReference(contactReferenceMode) === CONTACT_REFERENCE_MODES.vcc
    ? "HIGH"
    : "LOW";
}

function nextFloatingSampleIndex(currentIndex) {
  return (currentIndex + 1) % FLOATING_SAMPLE_INDEX_MODULO;
}

function runThroughput({
  sourceFile,
  pressed,
  contactReferenceMode = DEFAULT_CONTACT_REFERENCE_MODE,
  floatingSampleIndex = DEFAULT_FLOATING_SAMPLE_INDEX,
}) {
  const probeResult = executeDigitalInputProgram({
    sourceFile,
    digitalInputs: { [BUTTON_PIN]: "HIGH" },
  });

  if (!probeResult.ok) {
    return {
      ok: false,
      errorSource: probeResult.errorSource,
      errors: cloneErrors(probeResult.errors),
      warnings: dedupeWarnings(probeResult.warnings || []),
    };
  }

  const programPullMode = probeResult.result && probeResult.result.pullMode;

  if (programPullMode === "INPUT") {
    let floating = null;
    let openSampleIndex = null;
    let floatingWarnings = Object.freeze([]);
    if (!pressed) {
      floating = evaluateFloatingDigitalInput({
        sampleIndex: floatingSampleIndex,
      });

      if (!floating.ok) {
        return {
          ok: false,
          errorSource: "floating-digital-input-model",
          errors: cloneErrors(floating.errors),
          warnings: dedupeWarnings(probeResult.warnings || []),
        };
      }

      floatingWarnings = floating.warnings || [];
      openSampleIndex = floating.result.sampleIndex;
    }

    const resolvedContactReference = resolveInputContactReference(contactReferenceMode);
    const digitalInput = pressed ? resolveInputPressedLevel(resolvedContactReference) : floating.result.logicLevel;
    const runResult = executeDigitalInputProgram({
      sourceFile,
      digitalInputs: { [BUTTON_PIN]: digitalInput },
    });

    if (!runResult.ok) {
      return {
        ok: false,
        errorSource: runResult.errorSource,
        errors: cloneErrors(runResult.errors),
        warnings: dedupeWarnings([
          ...(probeResult.warnings || []),
          ...floatingWarnings,
          ...(runResult.warnings || []),
        ]),
      };
    }

    return {
      ok: true,
      result: Object.freeze({
        floatingSampleIndex,
        pressed,
        contactReferenceMode,
        contactReference: resolvedContactReference,
        pullMode: runResult.result.pullMode,
        logicLevel: runResult.result.logicLevel,
        normalizedValue: runResult.result.normalizedValue,
        buttonContactPullMode: null,
        buttonState: runResult.result.variables.buttonState,
        pin: BUTTON_PIN,
        sourceHash: runResult.result.sourceHash,
        sampleIndex: openSampleIndex,
        modelVersions: Object.freeze({
          buttonContact: BUTTON_CONTACT_MODEL.modelVersion,
          digitalInputProgramRuntime: DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelVersion,
          floatingDigitalInput: FLOATING_DIGITAL_INPUT_MODEL.modelVersion,
        }),
        warnings: dedupeWarnings([
          ...(probeResult.warnings || []),
          ...floatingWarnings,
          ...(runResult.warnings || []),
        ]),
      }),
      warnings: dedupeWarnings([
        ...(probeResult.warnings || []),
        ...floatingWarnings,
        ...(runResult.warnings || []),
      ]),
    };
  }

  const buttonPullMode = pullModeFromProgram(programPullMode);
  if (!buttonPullMode) {
    return {
      ok: false,
      errorSource: "button-digital-input-throughput-runtime",
      errors: [{
        code: CHAIN_INCONSISTENT_ERROR,
        message: `Unerwarteter pullMode ${String(programPullMode)} in Programmlaufzeit.`,
        line: 1,
        column: 1,
      }],
      warnings: Object.freeze([]),
    };
  }

  const contactReference = resolveContactReference(contactReferenceMode);
  const buttonResult = evaluateButtonContact({
    pressed,
    pullMode: buttonPullMode,
    ...(contactReference === undefined ? {} : { contactReference }),
  });
  if (!buttonResult.ok) {
    return {
      ok: false,
      errorSource: "button-contact",
      errors: cloneErrors(buttonResult.errors),
      warnings: dedupeWarnings(buttonResult.warnings || []),
    };
  }

  const runResult = executeDigitalInputProgram({
    sourceFile,
    digitalInputs: { [BUTTON_PIN]: buttonResult.result.logicLevel },
  });

  if (!runResult.ok) {
    return {
      ok: false,
      errorSource: runResult.errorSource,
      errors: cloneErrors(runResult.errors),
      warnings: dedupeWarnings(runResult.warnings || []),
    };
  }

  if (runResult.result.normalizedValue !== buttonResult.result.normalizedValue) {
    return {
      ok: false,
      errorSource: "button-digital-input-throughput-runtime",
      errors: [{
        code: CHAIN_INCONSISTENT_ERROR,
        message: "Auswertung Buttonmodell und Programmlaufzeit widerspricht sich.",
        line: 1,
        column: 1,
      }],
      warnings: dedupeWarnings([
        ...(probeResult.warnings || []),
        ...(buttonResult.warnings || []),
        ...(runResult.warnings || []),
      ]),
    };
  }

  if (programPullMode !== runResult.result.pullMode) {
    return {
      ok: false,
      errorSource: "button-digital-input-throughput-runtime",
      errors: [{
        code: CHAIN_INCONSISTENT_ERROR,
        message: "Programmlaufzeit liefert widersprüchliche pullMode-Angaben.",
        line: 1,
        column: 1,
      }],
      warnings: dedupeWarnings([
        ...(probeResult.warnings || []),
        ...(buttonResult.warnings || []),
        ...(runResult.warnings || []),
      ]),
    };
  }

  return {
    ok: true,
    result: Object.freeze({
      floatingSampleIndex,
      pressed,
      contactReferenceMode,
      pullMode: runResult.result.pullMode,
      buttonContactPullMode: buttonPullMode,
      logicLevel: buttonResult.result.logicLevel,
      normalizedValue: buttonResult.result.normalizedValue,
      contactReference: buttonResult.result.contactReference,
      buttonState: runResult.result.variables.buttonState,
      pin: BUTTON_PIN,
      sourceHash: runResult.result.sourceHash,
      modelVersions: Object.freeze({
        buttonContact: BUTTON_CONTACT_MODEL.modelVersion,
        digitalInputProgramRuntime: DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelVersion,
      }),
      warnings: dedupeWarnings([
        ...(probeResult.warnings || []),
        ...(buttonResult.warnings || []),
        ...(runResult.warnings || []),
      ]),
    }),
    warnings: dedupeWarnings([
      ...(probeResult.warnings || []),
      ...(buttonResult.warnings || []),
      ...(runResult.warnings || []),
    ]),
  };
}

export function createButtonDigitalInputThroughputRuntime({
  pressed = DEFAULT_STATE.pressed,
  sourceFile = DEFAULT_STATE.sourceFile,
  contactReferenceMode = DEFAULT_STATE.contactReferenceMode,
} = {}) {
  const normalizedPressed = pressed === true;
  const normalizedContactReferenceMode = normalizeContactReferenceMode(contactReferenceMode);
  let normalizedSource = normalizeSource(sourceFile);
  let state = {
    pressed: normalizedPressed,
    contactReferenceMode: normalizedContactReferenceMode,
    sourceFile: normalizedSource,
    floatingSampleIndex: DEFAULT_FLOATING_SAMPLE_INDEX,
    measurement: null,
    error: null,
    errorSource: null,
    labProject: createLabProject({
      pressed: normalizedPressed,
      contactReferenceMode: normalizedContactReferenceMode,
      sourceFile: normalizedSource,
      floatingSampleIndex: DEFAULT_FLOATING_SAMPLE_INDEX,
    }),
  };

  const resetState = { ...DEFAULT_STATE, sourceFile: normalizeSource(DEFAULT_SOURCE) };

  function setSource(nextSource, clearErrors = true) {
    const nextNormalizedSource = normalizeSource(nextSource);
    state = {
      ...state,
      sourceFile: nextNormalizedSource,
      labProject: createLabProject({
        pressed: state.pressed,
        sourceFile: nextNormalizedSource,
        contactReferenceMode: state.contactReferenceMode,
        floatingSampleIndex: state.floatingSampleIndex,
      }),
      ...(clearErrors
        ? {
          measurement: null,
          error: null,
          errorSource: null,
        }
        : {}),
    };

    return state;
  }

  function setPressed(nextPressed, clearErrors = true) {
    state = {
      ...state,
      pressed: nextPressed,
      labProject: createLabProject({
        pressed: nextPressed,
        sourceFile: state.sourceFile,
        contactReferenceMode: state.contactReferenceMode,
        floatingSampleIndex: state.floatingSampleIndex,
      }),
      ...(clearErrors
        ? {
          measurement: null,
          error: null,
          errorSource: null,
        }
        : {}),
    };
    return state;
  }

  function setContactReference(nextContactReferenceMode, clearErrors = true) {
    state = {
      ...state,
      contactReferenceMode: nextContactReferenceMode,
      labProject: createLabProject({
        pressed: state.pressed,
        sourceFile: state.sourceFile,
        contactReferenceMode: nextContactReferenceMode,
        floatingSampleIndex: state.floatingSampleIndex,
      }),
      ...(clearErrors
        ? {
          measurement: null,
          error: null,
          errorSource: null,
        }
        : {}),
    };
    return state;
  }

  function clearRuntimeError() {
    state = {
      ...state,
      measurement: null,
      error: null,
      errorSource: null,
    };
  }

  function dispatch(command) {
    if (!command || typeof command.type !== "string") {
      return commandError(COMMAND_SYNTAX_ERROR, "Ungültiges Command-Objekt.");
    }

    if (command.type === COMMAND_TYPES.SetButtonPressed) {
      if (typeof command.pressed !== "boolean") {
        return commandError(COMMAND_SYNTAX_ERROR, "SetButtonPressed erwartet einen Boolean.");
      }

      setPressed(command.pressed);
      return { ok: true, pressed: state.pressed };
    }

    if (command.type === COMMAND_TYPES.SetContactReference) {
      if (!isContactReferenceMode(command.contactReferenceMode)) {
        return commandError(COMMAND_SYNTAX_ERROR, "SetContactReference erwartet auto, gnd oder vcc.");
      }

      setContactReference(command.contactReferenceMode);
      return { ok: true, contactReferenceMode: state.contactReferenceMode };
    }

    if (command.type === COMMAND_TYPES.UpdateSourceFile) {
      if (typeof command.sourceFile !== "string") {
        return commandError(COMMAND_SYNTAX_ERROR, "UpdateSourceFile erwartet sourceFile als String.");
      }

      setSource(command.sourceFile);
      return { ok: true, sourceFile: state.sourceFile };
    }

    if (command.type === COMMAND_TYPES.StartSimulation) {
      const result = runThroughput({
        sourceFile: state.sourceFile,
        pressed: state.pressed,
        contactReferenceMode: state.contactReferenceMode,
        floatingSampleIndex: state.floatingSampleIndex,
      });

      if (!result.ok) {
        const errors = cloneErrors(result.errors);
        state = {
          ...state,
          measurement: null,
          error: errors,
          errorSource: result.errorSource,
          labProject: createLabProject({
            pressed: state.pressed,
            sourceFile: state.sourceFile,
            contactReferenceMode: state.contactReferenceMode,
            floatingSampleIndex: state.floatingSampleIndex,
          }),
        };
        return {
          ok: false,
          errors,
          errorSource: state.errorSource,
          measurement: null,
          sourceFile: state.sourceFile,
        };
      }

      const measurement = freezeMeasurement(result.result);
      state = {
        ...state,
        measurement,
        error: null,
        errorSource: null,
        labProject: {
          ...state.labProject,
          modelVersions: {
            ...state.labProject.modelVersions,
            ...(result.result.modelVersions || {}),
          },
        },
      };

      const warnings = freezeMeasurement(result.warnings || []);

      return {
        ok: true,
        measurement: freezeMeasurement(state.measurement),
        warnings,
        sourceFile: state.sourceFile,
      };
    }

    if (command.type === COMMAND_TYPES.AdvanceFloatingSample) {
      const nextIndex = nextFloatingSampleIndex(state.floatingSampleIndex);
      state = {
        ...state,
        floatingSampleIndex: nextIndex,
        measurement: null,
        error: null,
        errorSource: null,
        labProject: createLabProject({
          pressed: state.pressed,
          sourceFile: state.sourceFile,
          contactReferenceMode: state.contactReferenceMode,
          floatingSampleIndex: nextIndex,
        }),
      };

      return {
        ok: true,
        floatingSampleIndex: state.floatingSampleIndex,
      };
    }

    if (command.type === COMMAND_TYPES.ResetSimulation) {
      normalizedSource = resetState.sourceFile;
      state = {
        ...state,
        pressed: resetState.pressed,
        contactReferenceMode: resetState.contactReferenceMode,
        sourceFile: normalizedSource,
        floatingSampleIndex: resetState.floatingSampleIndex,
        labProject: createLabProject({
          pressed: resetState.pressed,
          sourceFile: normalizedSource,
          contactReferenceMode: resetState.contactReferenceMode,
          floatingSampleIndex: resetState.floatingSampleIndex,
        }),
      };
      clearRuntimeError();
      return {
        ok: true,
        pressed: state.pressed,
        sourceFile: state.sourceFile,
      };
    }

    return {
      ok: false,
      errorSource: "button-digital-input-throughput-runtime",
      errors: [{
        code: COMMAND_NOT_SUPPORTED,
        message: `Unbekannter Command ${command.type}.`,
        line: 1,
        column: 1,
      }],
    };
  }

  function getSnapshot() {
    return cloneSnapshot({
      pressed: state.pressed,
      contactReferenceMode: state.contactReferenceMode,
      floatingSampleIndex: state.floatingSampleIndex,
      sourceFile: state.sourceFile,
      measurement: state.measurement ? clone(state.measurement) : null,
      error: state.error ? clone(state.error) : null,
      errorSource: state.errorSource,
      labProject: state.labProject ? clone(state.labProject) : null,
    });
  }

  return {
    dispatch,
    getSnapshot,
  };
}
