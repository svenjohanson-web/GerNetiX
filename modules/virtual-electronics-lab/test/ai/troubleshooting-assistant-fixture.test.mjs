import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createFixtureTroubleshootingAssistantClient,
  requestFixtureTroubleshootingAssistance,
} from "../../ai/troubleshooting-assistant-fixture.mjs";

const BASIC_SOURCE = `void setup() { pinMode(4, INPUT); }\nvoid loop() { int buttonState = digitalRead(4); }`;
const DEBOUNCE_SOURCE = `const unsigned long debounceUs = 300;\nvoid setup() { pinMode(4, INPUT_PULLUP); }`;

function snapshot(sourceFile = BASIC_SOURCE) {
  return {
    sourceFile,
    pressed: false,
    contactReferenceMode: "vcc",
    floatingSampleIndex: 0,
    measurement: {
      pullMode: "INPUT",
      logicLevel: "HIGH",
      normalizedValue: 1,
      buttonState: 1,
      warnings: [],
    },
    error: [],
  };
}

test("fixture explains observations without commands", () => {
  const result = requestFixtureTroubleshootingAssistance({
    scenario: "miswired",
    snapshot: snapshot(),
    requestedAction: "explain-observation",
  });
  assert.equal(result.ok, true);
  assert.equal(result.proposal.actionType, "explain-observation");
  assert.equal("commands" in result.proposal, false);
});

test("fixture suggests a measurement without changing state", () => {
  const input = snapshot();
  const before = structuredClone(input);
  const result = requestFixtureTroubleshootingAssistance({
    scenario: "missing-pull",
    snapshot: input,
    requestedAction: "suggest-measurement",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(input, before);
  assert.equal("commands" in result.proposal, false);
});

test("fixture returns confirmation-bound allowlisted repair commands", () => {
  const wiring = requestFixtureTroubleshootingAssistance({
    scenario: "miswired",
    snapshot: snapshot(),
    requestedAction: "propose-command-diff",
  });
  const pull = requestFixtureTroubleshootingAssistance({
    scenario: "missing-pull",
    snapshot: snapshot(),
    requestedAction: "propose-command-diff",
  });
  const bounce = requestFixtureTroubleshootingAssistance({
    scenario: "bounce",
    snapshot: snapshot(DEBOUNCE_SOURCE),
    requestedAction: "propose-command-diff",
  });

  assert.deepEqual(wiring.proposal.commands, [{ type: "SetContactReference", contactReferenceMode: "gnd" }]);
  assert.match(pull.proposal.commands[0].sourceFile, /INPUT_PULLUP/);
  assert.match(bounce.proposal.commands[0].sourceFile, /debounceUs = 700/);
  for (const result of [wiring, pull, bounce]) {
    assert.equal(result.ok, true);
    assert.equal(result.proposal.requiresConfirmation, true);
  }
});

test("invalid action and context fail closed", () => {
  assert.equal(requestFixtureTroubleshootingAssistance({ requestedAction: "repair-now" }).ok, false);
  assert.equal(requestFixtureTroubleshootingAssistance({
    scenario: "bounce",
    snapshot: {},
    requestedAction: "explain-observation",
  }).ok, false);
});

test("async client exposes the local preview explicitly", async () => {
  const client = createFixtureTroubleshootingAssistantClient();
  assert.equal(client.mode, "local-contract-preview");
  assert.match(client.label, /keine Live-KI\/Credits/);
  const result = await client.request({
    scenario: "miswired",
    snapshot: snapshot(),
    requestedAction: "explain-observation",
  });
  assert.equal(result.ok, true);
});

test("fixture source has no network, storage, timer, eval or random runtime", () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL("../../ai/troubleshooting-assistant-fixture.mjs", import.meta.url)),
    "utf8",
  );
  for (const forbidden of ["fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "setTimeout", "eval(", "Math.random"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
