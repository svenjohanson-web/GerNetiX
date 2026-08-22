const BUTTON_CONTACT_ERRORS = Object.freeze([
  Object.freeze({
    code: "BUTTON_PRESSED_BOOLEAN_REQUIRED",
    message: "pressed must be a boolean.",
    description: "pressed must be a boolean.",
  }),
  Object.freeze({
    code: "BUTTON_PULL_MODE_NOT_SUPPORTED",
    message: "pullMode must be 'pull-up' or 'pull-down'.",
    description: "pullMode must be 'pull-up' or 'pull-down'.",
  }),
  Object.freeze({
    code: "BUTTON_CONTACT_REFERENCE_NOT_SUPPORTED",
    message: "contactReference must be 'gnd' or 'vcc'.",
    description: "contactReference must be 'gnd' or 'vcc'.",
  }),
]);

const BUTTON_CONTACT_WARNINGS = Object.freeze([
  Object.freeze({
    code: "BUTTON_CONTACT_NO_LEVEL_CHANGE",
    description:
      "Pressed button contact does not change the logic level. The contactReference matches the pull target.",
  }),
]);

const EMPTY_BUTTON_CONTACT_WARNINGS = Object.freeze([]);
const BUTTON_CONTACT_NO_LEVEL_CHANGE_WARNING = Object.freeze({
  code: "BUTTON_CONTACT_NO_LEVEL_CHANGE",
  message: "Pressed button contact does not change logic level.",
});

export const BUTTON_CONTACT_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-idealized-button-contact",
  modelVersion: "1.1.0",
  architecture: "idealized",
  inputQuantity: "button-state",
  inputUnit: "binary",
  outputQuantity: "logic-level",
  outputUnit: "boolean",
  allowedPullModes: Object.freeze(["pull-up", "pull-down"]),
  allowedContactReferences: Object.freeze(["gnd", "vcc"]),
  supportedPullModes: Object.freeze({
    pullUp: "pull-up",
    pullDown: "pull-down",
  }),
  supportedContactReferences: Object.freeze({
    gnd: "gnd",
    vcc: "vcc",
  }),
  errors: BUTTON_CONTACT_ERRORS,
  warnings: BUTTON_CONTACT_WARNINGS,
});

const HIGH = "HIGH";
const LOW = "LOW";

function isBoolean(value) {
  return typeof value === "boolean";
}

function validatePressedAndMode(pressed, pullMode, contactReference) {
  if (!isBoolean(pressed)) {
    return {
      ok: false,
      error: BUTTON_CONTACT_ERRORS[0],
    };
  }

  if (pullMode !== "pull-up" && pullMode !== "pull-down") {
    return {
      ok: false,
      error: BUTTON_CONTACT_ERRORS[1],
    };
  }

  if (
    contactReference !== undefined &&
    contactReference !== "gnd" &&
    contactReference !== "vcc"
  ) {
    return {
      ok: false,
      error: BUTTON_CONTACT_ERRORS[2],
    };
  }

  return { ok: true };
}

function resolveOpenLevel(pullMode) {
  if (pullMode === "pull-up") {
    return HIGH;
  }

  return LOW;
}

function resolveClosedLevel(contactReference) {
  return contactReference === "vcc" ? HIGH : LOW;
}

function resolveNoLevelChangeWarning(pullMode, resolvedContactReference) {
  const openLevel = resolveOpenLevel(pullMode);
  const closedLevel = resolveClosedLevel(resolvedContactReference);
  return openLevel === closedLevel;
}

function resolveContactReference(pullMode, contactReference) {
  if (contactReference === undefined) {
    return pullMode === "pull-up" ? "gnd" : "vcc";
  }

  return contactReference;
}

export function evaluateButtonContact({ pressed, pullMode, contactReference }) {
  const validated = validatePressedAndMode(pressed, pullMode, contactReference);
  if (!validated.ok) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([validated.error]),
    });
  }

  const resolvedContactReference = resolveContactReference(pullMode, contactReference);
  const openLevel = resolveOpenLevel(pullMode);
  const closedLevel = resolveClosedLevel(resolvedContactReference);
  const logicLevel = pressed ? closedLevel : openLevel;
  const hasNoLevelChange = pressed && resolveNoLevelChangeWarning(pullMode, resolvedContactReference);
  const warnings = hasNoLevelChange
    ? Object.freeze([BUTTON_CONTACT_NO_LEVEL_CHANGE_WARNING])
    : EMPTY_BUTTON_CONTACT_WARNINGS;

  return Object.freeze({
    ok: true,
    result: Object.freeze({
      logicLevel,
      normalizedValue: logicLevel === HIGH ? 1 : 0,
      contactReference: resolvedContactReference,
      modelId: BUTTON_CONTACT_MODEL.modelId,
      modelVersion: BUTTON_CONTACT_MODEL.modelVersion,
      warnings: warnings,
    }),
    warnings,
  });
}
