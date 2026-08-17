const BUTTON_BOUNCE_ERRORS = Object.freeze([
  Object.freeze({
    code: "BUTTON_BOUNCE_TARGET_PRESSED_BOOLEAN_REQUIRED",
    message: "targetPressed muss ein Boolean sein.",
    description: "targetPressed must be a boolean.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_ELAPSED_US_INTEGER_REQUIRED",
    message: "elapsedUs muss eine ganze Zahl zwischen 0 und 1_000_000 sein.",
    description: "elapsedUs must be an integer from 0 to 1_000_000.",
  }),
  Object.freeze({
    code: "BUTTON_BOUNCE_PROFILE_NOT_SUPPORTED",
    message: "profile muss 'teaching-default' sein.",
    description: "profile must be 'teaching-default'.",
  }),
]);

const BUTTON_BOUNCE_IDEALIZED_WARNING = Object.freeze({
  code: "BUTTON_BOUNCE_IDEALIZED",
  message: "Buttonprellen ist ein idealisiertes Lernmodell.",
});

export const BUTTON_BOUNCE_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-idealized-button-bounce",
  modelVersion: "1.0.0",
  architecture: "idealized",
  inputQuantity: "target-pressed-time-elapsed",
  inputUnit: "binary-time-us",
  outputQuantity: "pressed-state",
  outputUnit: "binary",
  supportedProfiles: Object.freeze({
    teachingDefault: "teaching-default",
  }),
  errors: BUTTON_BOUNCE_ERRORS,
  warnings: Object.freeze([BUTTON_BOUNCE_IDEALIZED_WARNING]),
});

const DEFAULT_PROFILE = "teaching-default";

const BOUNCE_TIME_MIN = 0;
const BOUNCE_TIME_MAX = 1_000_000;

function isBoolean(value) {
  return typeof value === "boolean";
}

function validateInput(value, key) {
  if (key === "targetPressed") {
    if (!isBoolean(value)) {
      return {
        ok: false,
        error: BUTTON_BOUNCE_ERRORS[0],
      };
    }
  }

  if (key === "elapsedUs") {
    if (!Number.isInteger(value) || value < BOUNCE_TIME_MIN || value > BOUNCE_TIME_MAX) {
      return {
        ok: false,
        error: BUTTON_BOUNCE_ERRORS[1],
      };
    }
  }

  return { ok: true };
}

function validateProfile(profile) {
  if (profile !== DEFAULT_PROFILE) {
    return {
      ok: false,
      error: BUTTON_BOUNCE_ERRORS[2],
    };
  }

  return { ok: true };
}

function resolvePressedFromBounce(targetPressed, elapsedUs) {
  if (elapsedUs < 150) {
    return !targetPressed;
  }
  if (elapsedUs < 350) {
    return targetPressed;
  }
  if (elapsedUs < 700) {
    return !targetPressed;
  }
  if (elapsedUs < 1200) {
    return targetPressed;
  }
  if (elapsedUs < 1800) {
    return !targetPressed;
  }

  return targetPressed;
}

function failure(error) {
  return Object.freeze({
    ok: false,
    errors: Object.freeze([error]),
    warnings: Object.freeze([]),
  });
}

export function evaluateButtonBounce(options) {
  const targetPressed = options?.targetPressed;
  const elapsedUs = options?.elapsedUs;
  const profile = options?.profile ?? DEFAULT_PROFILE;
  const validatedTargetPressed = validateInput(targetPressed, "targetPressed");
  if (!validatedTargetPressed.ok) {
    return failure(validatedTargetPressed.error);
  }

  const validatedElapsedUs = validateInput(elapsedUs, "elapsedUs");
  if (!validatedElapsedUs.ok) {
    return failure(validatedElapsedUs.error);
  }

  const validatedProfile = validateProfile(profile);
  if (!validatedProfile.ok) {
    return failure(validatedProfile.error);
  }

  const pressed = resolvePressedFromBounce(targetPressed, elapsedUs);
  const stable = elapsedUs >= 1800;

  return Object.freeze({
    ok: true,
    result: Object.freeze({
      pressed,
      stable,
      timeUs: elapsedUs,
      profile: profile,
      modelId: BUTTON_BOUNCE_MODEL.modelId,
      modelVersion: BUTTON_BOUNCE_MODEL.modelVersion,
      warnings: Object.freeze([BUTTON_BOUNCE_IDEALIZED_WARNING]),
    }),
    warnings: Object.freeze([BUTTON_BOUNCE_IDEALIZED_WARNING]),
  });
}
