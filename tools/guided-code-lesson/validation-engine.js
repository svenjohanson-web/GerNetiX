"use strict";

function getValidationState(stepItem) {
  if (stepItem.completion?.type === "decisionRequired") {
    const result = resolveCompletionResult(stepItem);
    return {
      canContinue: Boolean(result),
      message: result
        ? `Abschlussbedingung erfüllt: ${stepItem.completion.label}.`
        : `Weiter geht es, sobald die Abschlussbedingung erfüllt ist: ${stepItem.completion.label}.`,
    };
  }

  if (stepItem.validation?.type === "knownBoardPinOrIntegerRange") {
    return validateKnownBoardPinOrIntegerRange(stepItem.validation);
  }

  if (stepItem.validation?.type === "integerRange") {
    return validateIntegerRange(stepItem.validation);
  }

  if (stepItem.validation?.type === "profileTextContainsAll") {
    return validateProfileTextContainsAll(stepItem.validation);
  }

  if (stepItem.validation?.type === "plantUmlStateInBlock") {
    return validatePlantUmlStateInBlock(stepItem.validation);
  }

  if (stepItem.validation?.type === "plantUmlAdditionalStateInBlock") {
    return validatePlantUmlAdditionalStateInBlock(stepItem.validation);
  }

  if (stepItem.validation?.type === "plantUmlTransitionToAdditionalState") {
    return validatePlantUmlTransitionToAdditionalState(stepItem.validation);
  }

  if (!stepItem.expectedContains) {
    return {
      canContinue: true,
      message: stepItem.completion?.label ? `Abschlussbedingung: ${stepItem.completion.label}.` : "",
    };
  }

  const code = codeLines.join("\n");
  const found = code.includes(stepItem.expectedContains);

  return {
    canContinue: found,
    message: found
      ? `Validierung erfüllt: ${stepItem.expectedContains}`
      : `Weiter geht es, sobald der Code ${stepItem.expectedContains} enthält.`,
  };
}

function validateProfileTextContainsAll(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  const missing = (rule.contains || []).filter((item) => !text.includes(item));

  return {
    canContinue: missing.length === 0,
    message: missing.length === 0
      ? `Validierung erfüllt: ${rule.label}.`
      : `Weiter geht es, sobald die PlantUML-Quelle enthält: ${missing[0]}.`,
  };
}

function validatePlantUmlStateInBlock(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  const lines = text.split(/\r?\n/);
  const blockStartIndex = lines.findIndex((line) => isPlantUmlBlockStart(line, rule.block));
  const expectedLine = rule.line;

  if (blockStartIndex < 0) {
    return {
      canContinue: false,
      message: `Der Block ${rule.block} wurde nicht gefunden.`,
    };
  }

  for (let index = blockStartIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "}") break;
    if (line === expectedLine) {
      return {
        canContinue: true,
        message: `Syntax geprüft: ${rule.label} steht im Block ${rule.block}.`,
      };
    }
  }

  return {
    canContinue: false,
    message: `Füge im Block ${rule.block} die Zeile hinzu: ${expectedLine}.`,
  };
}

function validatePlantUmlAdditionalStateInBlock(rule) {
  const states = getPlantUmlStatesInBlock(rule);
  const existingAliases = new Set(rule.existingAliases || []);
  const addedStates = states.filter((state) => !existingAliases.has(state.alias));
  const minStates = rule.minStates || 1;

  if (addedStates.length >= minStates) {
    return {
      canContinue: true,
      message: `Syntax geprüft: ${addedStates.map((state) => state.label).join(", ")} wurden als neue States im Block ${rule.block} erkannt.`,
    };
  }

  return {
    canContinue: false,
    message: `Füge im Block ${rule.block} mindestens ${minStates} neue States nach dem Schema state "Name" as alias hinzu.`,
  };
}

function validatePlantUmlTransitionToAdditionalState(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  const states = getPlantUmlStatesInBlock(rule);
  const existingAliases = new Set(rule.existingAliases || []);
  const minStates = rule.minStates || 1;
  const addedAliases = new Set(states
    .filter((state) => !existingAliases.has(state.alias))
    .map((state) => state.alias));

  if (addedAliases.size < minStates) {
    return {
      canContinue: false,
      message: `Ergänze zuerst mindestens ${minStates} selbst gewählte neue States.`,
    };
  }

  const rejectedConditions = new Set((rule.rejectConditions || []).map((item) => item.toLowerCase()));
  const transition = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+-->\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
      const condition = match?.[3]?.trim() || "";
      return match
        && addedAliases.has(match[1])
        && addedAliases.has(match[2])
        && condition.length > 0
        && !rejectedConditions.has(condition.toLowerCase());
    });

  if (transition) {
    return {
      canContinue: true,
      message: `Syntax geprüft: Transition zwischen deinen neuen States erkannt: ${transition}.`,
    };
  }

  return {
    canContinue: false,
    message: "Ergänze eine vollständige Transition mit echter Bedingung oder Aktion, zum Beispiel nicht_durstig --> durstig : Durst >= 50.",
  };
}

function getPlantUmlStatesInBlock(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  return getPlantUmlStatesInBlockFromText(text, rule.block);
}

function getPlantUmlStatesInBlockFromText(text, block) {
  const lines = text.split(/\r?\n/);
  const blockStartIndex = lines.findIndex((line) => isPlantUmlBlockStart(line, block));

  if (blockStartIndex < 0) return [];

  const states = [];
  for (let index = blockStartIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "}") break;

    const match = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/);
    if (match) {
      states.push({ label: match[1], alias: match[2] });
    }
  }

  return states;
}

function isPlantUmlBlockStart(line, block) {
  const trimmed = line.trim();
  return trimmed.startsWith(block) && trimmed.endsWith("{");
}

function validateKnownBoardPinOrIntegerRange(rule) {
  const boardKey = lesson.learnerProfile?.[rule.profileField];
  const expectedPin = boardKey ? rule.knownBoardPins?.[boardKey] : undefined;
  const parsed = parseIntegerAssignment(rule);

  if (!parsed.found) {
    return {
      canContinue: false,
      message: `${rule.label} muss als ganze Zahl zugewiesen werden, zum Beispiel ${rule.label} = ${expectedPin ?? rule.min};`,
    };
  }

  if (expectedPin !== undefined) {
    return validateKnownBoardPin(rule, parsed.value, boardKey, expectedPin);
  }

  return validateIntegerRangeValue(rule, parsed.value);
}

function validateKnownBoardPin(rule, value, boardKey, expectedPin) {
  const profile = lesson.boardProfiles?.[boardKey];
  const boardTitle = profile?.title || boardKey;
  const isExpected = value === expectedPin;

  return {
    canContinue: isExpected,
    message: isExpected
      ? `Validierung erfüllt: Für ${boardTitle} ist ${rule.label} = ${expectedPin} hinterlegt.`
      : `Dein Profil kennt ${boardTitle}. Dafür muss ${rule.label} auf ${expectedPin} stehen. Aktueller Wert: ${value}.`,
  };
}

function validateIntegerRange(rule) {
  const parsed = parseIntegerAssignment(rule);

  if (!parsed.found) {
    return {
      canContinue: false,
      message: `${rule.label} muss als ganze Zahl zugewiesen werden, zum Beispiel ${rule.label} = ${rule.min};`,
    };
  }

  return validateIntegerRangeValue(rule, parsed.value);
}

function validateIntegerRangeValue(rule, value) {
  const inRange = Number.isInteger(value) && value >= rule.min && value <= rule.max;

  return {
    canContinue: inRange,
    message: inRange
      ? `Validierung erfüllt: ${rule.label} liegt im Bereich ${rule.min}..${rule.max}.`
      : `${rule.label} muss zwischen ${rule.min} und ${rule.max} liegen. Aktueller Wert: ${value}.`,
  };
}

function parseIntegerAssignment(rule) {
  const line = codeLines[rule.line - 1] || "";
  const match = line.match(/=\s*(-?\d+)\s*;/);

  return {
    found: Boolean(match),
    value: match ? Number(match[1]) : null,
  };
}

function renderBoardProfileLabel() {
  const boardKey = lesson.learnerProfile?.boardKey || "unknown";
  const profile = lesson.boardProfiles?.[boardKey];
  return `Board-Profil: ${profile?.title || boardKey}`;
}
