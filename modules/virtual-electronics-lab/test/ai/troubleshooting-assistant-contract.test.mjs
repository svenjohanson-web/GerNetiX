import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  TROUBLESHOOTING_ASSISTANT_CONTRACT,
  createTroubleshootingAssistantContext,
  validateTroubleshootingAssistantProposal,
} from "../../ai/troubleshooting-assistant-contract.mjs";

const snapshot = {
  sourceFile: "void setup(){ pinMode(4, INPUT); } void loop(){ digitalRead(4); }",
  pressed: false,
  contactReferenceMode: "auto",
  floatingSampleIndex: 1,
  secret: "must-not-cross-boundary",
  measurement: {
    pullMode: "INPUT",
    logicLevel: "HIGH",
    normalizedValue: 1,
    buttonState: 1,
    warnings: [{ code: "DIGITAL_INPUT_FLOATING_IDEALIZED", message: "not copied" }],
    internal: "not copied",
  },
  error: null,
};

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const entry of Object.values(value)) assertDeepFrozen(entry);
}

test("minimiert den Snapshot auf den freigegebenen Fehlersuchkontext", () => {
  const result = createTroubleshootingAssistantContext({ scenario: "missing-pull", snapshot });
  assert.equal(result.ok, true);
  assert.equal(result.context.scenario, "missing-pull");
  assert.deepEqual(result.context.observation.warningCodes, ["DIGITAL_INPUT_FLOATING_IDEALIZED"]);
  assert.equal("secret" in result.context, false);
  assert.equal("internal" in result.context.observation, false);
  assertDeepFrozen(result);
});

test("akzeptiert nur bekannte Fehlersuchfälle", () => {
  const result = createTroubleshootingAssistantContext({ scenario: "freie-anweisung", snapshot });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_AI_TROUBLESHOOTING_CONTEXT_REQUIRED");
});

test("akzeptiert Erklärung und Messvorschlag ohne Commands", () => {
  for (const actionType of ["explain-observation", "suggest-measurement"]) {
    const result = validateTroubleshootingAssistantProposal({ actionType, content: "Pegel erneut messen." });
    assert.deepEqual(result.proposal, { actionType, content: "Pegel erneut messen." });
    assertDeepFrozen(result);
  }
});

test("akzeptiert nur bestätigungspflichtige, erlaubte Reparatur-Commands", () => {
  const result = validateTroubleshootingAssistantProposal({
    actionType: "propose-command-diff",
    content: "Internen Pull-up ergänzen.",
    requiresConfirmation: true,
    commands: [{ type: "UpdateSourceFile", sourceFile: "pinMode(4, INPUT_PULLUP);" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.proposal.requiresConfirmation, true);
  assertDeepFrozen(result);

  assert.equal(validateTroubleshootingAssistantProposal({
    actionType: "propose-command-diff",
    content: "Direkt starten.",
    requiresConfirmation: true,
    commands: [{ type: "StartSimulation" }],
  }).errors[0].code, "ELAB_AI_TROUBLESHOOTING_COMMAND_NOT_SUPPORTED");
});

test("lehnt unbekannte Aktionen und Reparaturen ohne Bestätigung stabil ab", () => {
  assert.equal(validateTroubleshootingAssistantProposal({ actionType: "execute", content: "Los" }).errors[0].code,
    "ELAB_AI_TROUBLESHOOTING_ACTION_NOT_SUPPORTED");
  assert.equal(validateTroubleshootingAssistantProposal({
    actionType: "propose-command-diff",
    content: "Kontakt ändern.",
    commands: [{ type: "SetContactReference", contactReferenceMode: "gnd" }],
  }).errors[0].code, "ELAB_AI_TROUBLESHOOTING_CONFIRMATION_REQUIRED");
});

test("Eingaben bleiben unverändert und Vertrag enthält keine Laufzeitkopplung", () => {
  const before = structuredClone(snapshot);
  createTroubleshootingAssistantContext({ scenario: "missing-pull", snapshot });
  assert.deepEqual(snapshot, before);
  assert.deepEqual(TROUBLESHOOTING_ASSISTANT_CONTRACT.repairCommandTypes,
    ["SetContactReference", "UpdateSourceFile"]);

  const source = fs.readFileSync(fileURLToPath(new URL("../../ai/troubleshooting-assistant-contract.mjs", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|process\.env|api[_-]?key|credit|tariff/i);
});
