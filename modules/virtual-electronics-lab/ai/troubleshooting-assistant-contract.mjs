export const TROUBLESHOOTING_ASSISTANT_CONTRACT = Object.freeze({
  schemaVersion: "1.0.0",
  actionTypes: Object.freeze([
    "explain-observation",
    "suggest-measurement",
    "propose-command-diff",
  ]),
  scenarios: Object.freeze(["miswired", "missing-pull", "bounce"]),
  repairCommandTypes: Object.freeze(["SetContactReference", "UpdateSourceFile"]),
});

const ERRORS = Object.freeze({
  CONTEXT_REQUIRED: Object.freeze({
    code: "ELAB_AI_TROUBLESHOOTING_CONTEXT_REQUIRED",
    message: "Ein gültiger Labor-Snapshot und ein Fehlersuchfall sind erforderlich.",
  }),
  PROPOSAL_REQUIRED: Object.freeze({
    code: "ELAB_AI_TROUBLESHOOTING_PROPOSAL_REQUIRED",
    message: "Ein strukturierter KI-Vorschlag ist erforderlich.",
  }),
  ACTION_NOT_SUPPORTED: Object.freeze({
    code: "ELAB_AI_TROUBLESHOOTING_ACTION_NOT_SUPPORTED",
    message: "Die vorgeschlagene Aktion ist nicht erlaubt.",
  }),
  CONTENT_INVALID: Object.freeze({
    code: "ELAB_AI_TROUBLESHOOTING_CONTENT_INVALID",
    message: "Der Vorschlag benötigt einen kurzen Inhalt.",
  }),
  CONFIRMATION_REQUIRED: Object.freeze({
    code: "ELAB_AI_TROUBLESHOOTING_CONFIRMATION_REQUIRED",
    message: "Ein Command-Diff muss ausdrücklich als bestätigungspflichtig markiert sein.",
  }),
  COMMAND_NOT_SUPPORTED: Object.freeze({
    code: "ELAB_AI_TROUBLESHOOTING_COMMAND_NOT_SUPPORTED",
    message: "Der vorgeschlagene Reparatur-Command ist nicht erlaubt.",
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function fail(error) {
  return deepFreeze({ ok: false, errors: [error] });
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function warningCodes(measurement) {
  return Array.isArray(measurement?.warnings)
    ? measurement.warnings.map((entry) => cleanText(entry?.code, 96)).filter(Boolean).slice(0, 8)
    : [];
}

function errorCodes(snapshot) {
  return Array.isArray(snapshot?.error)
    ? snapshot.error.map((entry) => cleanText(entry?.code, 96)).filter(Boolean).slice(0, 8)
    : [];
}

export function createTroubleshootingAssistantContext(options) {
  const scenario = cleanText(options?.scenario, 64);
  const snapshot = options?.snapshot;
  const sourceFile = cleanText(snapshot?.sourceFile, 4096);
  if (!TROUBLESHOOTING_ASSISTANT_CONTRACT.scenarios.includes(scenario)
    || !snapshot || typeof snapshot !== "object" || !sourceFile) {
    return fail(ERRORS.CONTEXT_REQUIRED);
  }

  const measurement = snapshot.measurement;
  return deepFreeze({
    ok: true,
    context: {
      schemaVersion: TROUBLESHOOTING_ASSISTANT_CONTRACT.schemaVersion,
      labId: "button-digital-input-throughput",
      scenario,
      sourceFile,
      input: {
        pressed: Boolean(snapshot.pressed),
        contactReferenceMode: cleanText(snapshot.contactReferenceMode, 16) || "auto",
        floatingSampleIndex: Number.isInteger(snapshot.floatingSampleIndex)
          ? snapshot.floatingSampleIndex
          : 0,
      },
      observation: measurement
        ? {
            pullMode: cleanText(measurement.pullMode, 32),
            logicLevel: cleanText(measurement.logicLevel, 16),
            normalizedValue: measurement.normalizedValue === 1 ? 1 : 0,
            buttonState: measurement.buttonState === 1 ? 1 : 0,
            warningCodes: warningCodes(measurement),
          }
        : null,
      errorCodes: errorCodes(snapshot),
    },
  });
}

function normalizeCommand(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) return null;
  if (command.type === "SetContactReference") {
    if (command.contactReferenceMode !== "gnd" && command.contactReferenceMode !== "vcc") return null;
    return { type: command.type, contactReferenceMode: command.contactReferenceMode };
  }
  if (command.type === "UpdateSourceFile") {
    const sourceFile = cleanText(command.sourceFile, 4096);
    return sourceFile ? { type: command.type, sourceFile } : null;
  }
  return null;
}

export function validateTroubleshootingAssistantProposal(proposal) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return fail(ERRORS.PROPOSAL_REQUIRED);
  }
  if (!TROUBLESHOOTING_ASSISTANT_CONTRACT.actionTypes.includes(proposal.actionType)) {
    return fail(ERRORS.ACTION_NOT_SUPPORTED);
  }
  const content = cleanText(proposal.content, 800);
  if (!content) return fail(ERRORS.CONTENT_INVALID);

  if (proposal.actionType !== "propose-command-diff") {
    return deepFreeze({
      ok: true,
      proposal: { actionType: proposal.actionType, content },
    });
  }

  if (proposal.requiresConfirmation !== true) return fail(ERRORS.CONFIRMATION_REQUIRED);
  if (!Array.isArray(proposal.commands) || proposal.commands.length < 1 || proposal.commands.length > 3) {
    return fail(ERRORS.COMMAND_NOT_SUPPORTED);
  }
  const commands = proposal.commands.map(normalizeCommand);
  if (commands.some((command) => command === null)) return fail(ERRORS.COMMAND_NOT_SUPPORTED);

  return deepFreeze({
    ok: true,
    proposal: {
      actionType: proposal.actionType,
      content,
      requiresConfirmation: true,
      commands,
    },
  });
}
