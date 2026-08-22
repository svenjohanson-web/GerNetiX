import {
  createTroubleshootingAssistantContext,
  validateTroubleshootingAssistantProposal,
} from "./troubleshooting-assistant-contract.mjs";

export const TROUBLESHOOTING_ASSISTANT_FIXTURE = Object.freeze({
  mode: "local-contract-preview",
  label: "Vertragsvorschau – keine Live-KI/Credits",
});

const ACTIONS = new Set([
  "explain-observation",
  "suggest-measurement",
  "propose-command-diff",
]);

function replaceInputMode(sourceFile) {
  return sourceFile.replace(/pinMode\(4,\s*INPUT\s*\)/, "pinMode(4, INPUT_PULLUP)");
}

function replaceDebounceWindow(sourceFile) {
  return sourceFile.replace(
    /const\s+unsigned\s+long\s+debounceUs\s*=\s*\d+\s*;/,
    "const unsigned long debounceUs = 700;",
  );
}

function fixtureProposal(context, requestedAction) {
  const { scenario, sourceFile, observation } = context;
  if (requestedAction === "explain-observation") {
    const level = observation?.logicLevel || "noch nicht gemessen";
    return {
      actionType: requestedAction,
      content: `Der beobachtete GPIO-Pegel ist ${level}. Vergleiche Rohzustand, Pull-Konfiguration und erwarteten Tasterzustand, bevor du die Schaltung änderst.`,
    };
  }
  if (requestedAction === "suggest-measurement") {
    return {
      actionType: requestedAction,
      content: scenario === "bounce"
        ? "Nimm eine Druckspur auf und setze den gemeinsamen Cursor nacheinander auf jede Rohflanke. Vergleiche dabei den entprellten Programmwert."
        : "Miss den offenen und den gedrückten Zustand an GPIO 4 und vergleiche beide Pegel mit der Pull-Konfiguration.",
    };
  }

  if (scenario === "miswired") {
    return {
      actionType: requestedAction,
      content: "Kontaktbezug von 3,3 V auf GND ändern.",
      requiresConfirmation: true,
      commands: [{ type: "SetContactReference", contactReferenceMode: "gnd" }],
    };
  }
  const nextSource = scenario === "missing-pull"
    ? replaceInputMode(sourceFile)
    : replaceDebounceWindow(sourceFile);
  return {
    actionType: requestedAction,
    content: scenario === "missing-pull"
      ? "Internen Pull-up im Quellcode aktivieren."
      : "Entprellzeit im Quellcode auf den Referenzwert des Lehrprofils ändern.",
    requiresConfirmation: true,
    commands: [{ type: "UpdateSourceFile", sourceFile: nextSource }],
  };
}

export function requestFixtureTroubleshootingAssistance(options) {
  if (!ACTIONS.has(options?.requestedAction)) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([Object.freeze({
        code: "ELAB_AI_TROUBLESHOOTING_ACTION_NOT_SUPPORTED",
        message: "Die angeforderte Assistentenaktion ist nicht erlaubt.",
      })]),
    });
  }
  const contextResult = createTroubleshootingAssistantContext(options);
  if (!contextResult.ok) return contextResult;
  const proposalResult = validateTroubleshootingAssistantProposal(
    fixtureProposal(contextResult.context, options.requestedAction),
  );
  if (!proposalResult.ok) return proposalResult;
  return Object.freeze({
    ok: true,
    mode: TROUBLESHOOTING_ASSISTANT_FIXTURE.mode,
    proposal: proposalResult.proposal,
  });
}

export function createFixtureTroubleshootingAssistantClient() {
  return Object.freeze({
    mode: TROUBLESHOOTING_ASSISTANT_FIXTURE.mode,
    label: TROUBLESHOOTING_ASSISTANT_FIXTURE.label,
    request: async (options) => requestFixtureTroubleshootingAssistance(options),
  });
}
