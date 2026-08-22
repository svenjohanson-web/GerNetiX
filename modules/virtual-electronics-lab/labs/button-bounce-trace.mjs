import {
  BUTTON_BOUNCE_MODEL,
  evaluateButtonBounce,
} from "../input-models/button-bounce.mjs";
import { BUTTON_CONTACT_MODEL, evaluateButtonContact } from "../input-models/button-contact.mjs";

const BUTTON_BOUNCE_TRACE_ERRORS = Object.freeze([
  Object.freeze({
    code: "BUTTON_BOUNCE_TARGET_PRESSED_BOOLEAN_REQUIRED",
    message: "targetPressed muss ein Boolean sein.",
    description: "targetPressed must be a boolean.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_TRACE_PROFILE_NOT_SUPPORTED",
    message: "profile muss 'teaching-default' sein.",
    description: "profile must be 'teaching-default'.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_TRACE_PULL_MODE_NOT_SUPPORTED",
    message: "pullMode muss 'pull-up' oder 'pull-down' sein.",
    description: "pullMode must be 'pull-up' or 'pull-down'.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_TRACE_CONTACT_REFERENCE_NOT_SUPPORTED",
    message: "contactReference muss 'gnd' oder 'vcc' oder undefined sein.",
    description: "contactReference must be 'gnd', 'vcc' or undefined.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_TRACE_SAMPLE_INTERVAL_NOT_SUPPORTED",
    message: "sampleIntervalUs muss eine ganze Zahl zwischen 10 und 100_000 sein.",
    description: "sampleIntervalUs must be an integer between 10 and 100_000.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_TRACE_DURATION_NOT_SUPPORTED",
    message: "durationUs muss eine ganze Zahl zwischen 0 und 1_000_000 sein.",
    description: "durationUs must be an integer between 0 and 1_000_000.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_TRACE_SAMPLE_LIMIT_EXCEEDED",
    message: "Die gewünschte Auflösung erzeugt mehr als 501 Samples.",
    description: "requested sampling would create more than 501 samples.",
  }),
]);

const BUTTON_BOUNCE_TRACE_EXCEEDED_ERROR = BUTTON_BOUNCE_TRACE_ERRORS[6];

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_PROFILE = "teaching-default";
const DEFAULT_TIMEBASE = Object.freeze({
  timeUs: "microseconds",
});
const DEFAULT_VALUES = Object.freeze({
  pressed: "binary",
  logicLevel: "boolean",
  normalizedValue: "ratio",
});
const SAMPLE_INTERVAL_MIN = 10;
const SAMPLE_INTERVAL_MAX = 100_000;
const DURATION_MIN = 0;
const DURATION_MAX = 1_000_000;
const MAX_SAMPLES = 501;

function isBoolean(value) {
  return typeof value === "boolean";
}

function validateTargetPressed(targetPressed) {
  if (!isBoolean(targetPressed)) {
    return {
      ok: false,
      error: BUTTON_BOUNCE_TRACE_ERRORS[0],
    };
  }

  return { ok: true };
}

function validateProfile(profile) {
  if (profile !== DEFAULT_PROFILE) {
    return {
      ok: false,
      error: BUTTON_BOUNCE_TRACE_ERRORS[1],
    };
  }

  return { ok: true };
}

function validatePullMode(pullMode) {
  if (pullMode !== "pull-up" && pullMode !== "pull-down") {
    return {
      ok: false,
      error: BUTTON_BOUNCE_TRACE_ERRORS[2],
    };
  }

  return { ok: true };
}

function validateContactReference(contactReference) {
  if (contactReference === undefined) {
    return { ok: true };
  }

  if (contactReference !== "gnd" && contactReference !== "vcc") {
    return {
      ok: false,
      error: BUTTON_BOUNCE_TRACE_ERRORS[3],
    };
  }

  return { ok: true };
}

function validateSampleIntervalUs(sampleIntervalUs) {
  if (!Number.isInteger(sampleIntervalUs) ||
    sampleIntervalUs < SAMPLE_INTERVAL_MIN ||
    sampleIntervalUs > SAMPLE_INTERVAL_MAX) {
    return {
      ok: false,
      error: BUTTON_BOUNCE_TRACE_ERRORS[4],
    };
  }

  return { ok: true };
}

function validateDurationUs(durationUs) {
  if (!Number.isInteger(durationUs) ||
    durationUs < DURATION_MIN ||
    durationUs > DURATION_MAX) {
    return {
      ok: false,
      error: BUTTON_BOUNCE_TRACE_ERRORS[5],
    };
  }

  return { ok: true };
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
    deduped.push(warning);
  }

  return Object.freeze(deduped);
}

function clone(value) {
  if (Array.isArray(value)) {
    return value.map(clone);
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

function failure(error, warnings = []) {
  return deepFreeze({
    ok: false,
    errors: [clone(error)],
    warnings: clone(warnings),
  });
}

export function createButtonBounceTrace(options) {
  const targetPressed = options?.targetPressed;
  const pullMode = options?.pullMode;
  const contactReference = options?.contactReference;
  const sampleIntervalUs = options?.sampleIntervalUs;
  const durationUs = options?.durationUs;
  const profile = options?.profile ?? DEFAULT_PROFILE;
  const normalizedSampleIntervalUs = sampleIntervalUs;
  const normalizedDurationUs = durationUs;
  const normalizedTargetPressed = targetPressed;

  const validTargetPressed = validateTargetPressed(normalizedTargetPressed);
  if (!validTargetPressed.ok) {
    return failure(validTargetPressed.error);
  }

  const validProfile = validateProfile(profile);
  if (!validProfile.ok) {
    return failure(validProfile.error);
  }

  const validPullMode = validatePullMode(pullMode);
  if (!validPullMode.ok) {
    return failure(validPullMode.error);
  }

  const validContactReference = validateContactReference(contactReference);
  if (!validContactReference.ok) {
    return failure(validContactReference.error);
  }

  const validSampleIntervalUs = validateSampleIntervalUs(normalizedSampleIntervalUs);
  if (!validSampleIntervalUs.ok) {
    return failure(validSampleIntervalUs.error);
  }

  const validDurationUs = validateDurationUs(normalizedDurationUs);
  if (!validDurationUs.ok) {
    return failure(validDurationUs.error);
  }

  const sampleCount = Math.floor(normalizedDurationUs / normalizedSampleIntervalUs) + 1;
  if (sampleCount > MAX_SAMPLES) {
    return failure(BUTTON_BOUNCE_TRACE_EXCEEDED_ERROR);
  }

  const trace = [];
  const allWarnings = [];

  for (let timeUs = 0; timeUs <= normalizedDurationUs; timeUs += normalizedSampleIntervalUs) {
    const bounce = evaluateButtonBounce({
      targetPressed: normalizedTargetPressed,
      elapsedUs: timeUs,
      profile,
    });

    if (!bounce.ok) {
      return failure(bounce.errors[0], allWarnings);
    }

    const buttonContact = evaluateButtonContact({
      pressed: bounce.result.pressed,
      pullMode,
      ...(contactReference === undefined ? {} : { contactReference }),
    });
    if (!buttonContact.ok) {
      return failure(buttonContact.errors[0],
        dedupeWarnings([...allWarnings, ...(bounce.warnings || []), ...(buttonContact.warnings || [])]));
    }

    allWarnings.push(...(bounce.warnings || []));
    allWarnings.push(...(buttonContact.warnings || []));
    trace.push(Object.freeze({
      timeUs,
      pressed: bounce.result.pressed,
      logicLevel: buttonContact.result.logicLevel,
      normalizedValue: buttonContact.result.normalizedValue,
    }));
  }

  const warnings = dedupeWarnings(allWarnings);
  const measurement = deepFreeze(clone({
    trace,
    schemaVersion: SCHEMA_VERSION,
    modelVersions: {
      buttonBounce: BUTTON_BOUNCE_MODEL.modelVersion,
      buttonContact: BUTTON_CONTACT_MODEL.modelVersion,
    },
    units: Object.freeze({
      ...DEFAULT_TIMEBASE,
      ...DEFAULT_VALUES,
    }),
    targetPressed: normalizedTargetPressed,
    pullMode,
    contactReference:
      typeof contactReference === "undefined" ? buttonContactFromDefault(pullMode) : contactReference,
    sampleIntervalUs: normalizedSampleIntervalUs,
    durationUs: normalizedDurationUs,
    profile,
    warnings,
  }));

  return deepFreeze({
    ok: true,
    result: measurement,
    warnings,
  });
}

function buttonContactFromDefault(pullMode) {
  if (pullMode === "pull-up") {
    return "gnd";
  }

  return "vcc";
}
