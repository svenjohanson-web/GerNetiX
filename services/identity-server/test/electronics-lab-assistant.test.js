"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assistantProposalSchema,
  createAccountRateLimiter,
  createElectronicsLabAssistant,
} = require("../src/dev/electronics-lab-assistant");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const { registerElectronicsLabRoutes } = require("../src/dev/server/electronics-lab-routes");

const sourceFile = `void setup() { pinMode(4, INPUT_PULLUP); }\nvoid loop() { int buttonState = digitalRead(4); }`;

function requestBody(extra = {}) {
  return {
    scenario: "miswired",
    requestedAction: "propose-command-diff",
    message: "Der Pegel ändert sich nicht.",
    account_id: "forged-account",
    snapshot: {
      sourceFile,
      pressed: true,
      contactReferenceMode: "vcc",
      floatingSampleIndex: 0,
      measurement: {
        pullMode: "INPUT_PULLUP",
        logicLevel: "HIGH",
        normalizedValue: 1,
        buttonState: 1,
        warnings: [{ code: "BUTTON_CONTACT_NO_LEVEL_CHANGE", message: "internal detail" }],
      },
      error: [],
      secret: "must-not-reach-provider",
    },
    ...extra,
  };
}

function providerPayload(proposal) {
  return {
    output_text: JSON.stringify(proposal),
    usage: { input_tokens: 120, output_tokens: 45, total_tokens: 165 },
  };
}

test("electronics lab assistant uses minimized context, structured output and session account", async () => {
  const sent = [];
  const usageCalls = [];
  let providerRequest;
  const assistant = createElectronicsLabAssistant({
    aiUsageJson: async (path, options) => {
      usageCalls.push({ path, options });
      return path === "/api/ai-usage/preflight"
        ? { allowed: true, event_id: "usage-elab-1" }
        : { event_id: "usage-elab-1", status: "completed" };
    },
    llmConfigStore: { resolveRoute(task) {
      assert.equal(task, "electronics_lab_troubleshooting");
      return { provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5-nano", apiKey: "test-key", costPolicy: "external_costs_with_preflight" };
    } },
    projectServerUserId: () => "session-account-42",
    readJsonBody: async () => requestBody(),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async (url, options) => {
      providerRequest = { url, options, body: JSON.parse(options.body) };
      return { ok: true, json: async () => providerPayload({
        actionType: "propose-command-diff",
        content: "Kontaktbezug auf GND ändern.",
        requiresConfirmation: true,
        commands: [{ type: "SetContactReference", contactReferenceMode: "gnd", sourceFile: null }],
      }) };
    },
  });

  await assistant.handleRequest({}, {}, { user_id: "session-user" });

  assert.equal(providerRequest.url, "https://api.openai.test/v1/responses");
  assert.equal(providerRequest.body.store, false);
  assert.equal(providerRequest.body.text.format.type, "json_schema");
  assert.equal(providerRequest.body.text.format.strict, true);
  assert.match(providerRequest.body.safety_identifier, /^electronics-lab-[a-f0-9]{24}$/);
  assert.doesNotMatch(providerRequest.body.safety_identifier, /session-account/);
  const contextText = providerRequest.body.input[1].content[0].text;
  assert.doesNotMatch(contextText, /must-not-reach-provider|internal detail|forged-account/);
  assert.match(contextText, /BUTTON_CONTACT_NO_LEVEL_CHANGE/);
  assert.equal(usageCalls[0].options.body.account_id, "session-account-42");
  assert.equal(usageCalls[0].options.body.feature, "electronics_lab_troubleshooting");
  assert.equal(usageCalls[1].path, "/api/ai-usage/events/usage-elab-1/complete");
  assert.equal(sent[0].status, 200);
  assert.deepEqual(sent[0].body.proposal.commands, [{ type: "SetContactReference", contactReferenceMode: "gnd" }]);
});

test("credit rejection prevents provider calls", async () => {
  let providerCalls = 0;
  const sent = [];
  const assistant = createElectronicsLabAssistant({
    aiUsageJson: async () => ({ allowed: false, reason: "credits" }),
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-responses", apiModel: "gpt-5-nano" }) },
    projectServerUserId: () => "account",
    readJsonBody: async () => requestBody(),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => { providerCalls += 1; },
  });
  await assistant.handleRequest({}, {}, {});
  assert.equal(providerCalls, 0);
  assert.equal(sent[0].status, 402);
});

test("invalid provider proposal is rejected and usage event fails", async () => {
  const sent = [];
  const usageCalls = [];
  const assistant = createElectronicsLabAssistant({
    aiUsageJson: async (path, options) => {
      usageCalls.push({ path, options });
      return { allowed: true, event_id: "usage-invalid" };
    },
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5-nano", apiKey: "test" }) },
    projectServerUserId: () => "account",
    readJsonBody: async () => requestBody(),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => ({ ok: true, json: async () => providerPayload({
      actionType: "propose-command-diff",
      content: "Unzulässig",
      requiresConfirmation: false,
      commands: [],
    }) }),
  });
  await assistant.handleRequest({}, {}, {});
  assert.equal(sent[0].status, 503);
  assert.match(sent[0].body.message, /Vertrag/);
  assert.equal(usageCalls.some((entry) => entry.path.endsWith("/fail")), true);
});

test("invalid client context fails before routing, credits and provider", async () => {
  const sent = [];
  const assistant = createElectronicsLabAssistant({
    aiUsageJson: async () => { throw new Error("must not run"); },
    llmConfigStore: { resolveRoute: () => { throw new Error("must not run"); } },
    readJsonBody: async () => requestBody({ scenario: "unknown" }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => { throw new Error("must not run"); },
  });
  await assistant.handleRequest({}, {}, {});
  assert.equal(sent[0].status, 400);
});

test("route passes only the authenticated server session", async () => {
  const registry = createRouteRegistry();
  const session = { account: { user_id: "owner" } };
  let received;
  registerElectronicsLabRoutes({
    registry,
    requireSession: async () => session,
    electronicsLabAssistant: { async handleRequest(_req, _res, value) { received = value; } },
  });
  const matched = await registry.dispatch({
    req: { method: "POST" },
    res: {},
    url: new URL("http://localhost/api/platform/electronics-lab/assistant"),
  });
  assert.equal(matched, true);
  assert.equal(received, session);
});

test("strict schema requires every command field", () => {
  const command = assistantProposalSchema().properties.commands.items;
  assert.equal(command.additionalProperties, false);
  assert.deepEqual(command.required, ["type", "contactReferenceMode", "sourceFile"]);
});

test("account rate limit blocks before body, credits and provider without trusting browser identity", async () => {
  let bodyReads = 0;
  let usageCalls = 0;
  let providerCalls = 0;
  const sent = [];
  const audits = [];
  const assistant = createElectronicsLabAssistant({
    aiUsageJson: async () => { usageCalls += 1; },
    llmConfigStore: { resolveRoute: () => { throw new Error("must not run"); } },
    projectServerUserId: () => "trusted-session-account",
    readJsonBody: async () => { bodyReads += 1; return requestBody(); },
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => { providerCalls += 1; },
    rateLimit: 1,
    rateWindowMs: 60_000,
    now: () => 1_000,
    auditEvent: async (event) => audits.push(event),
  });

  await assistant.handleRequest({}, {}, { user_id: "trusted-session-account" });
  await assistant.handleRequest({}, {}, { user_id: "trusted-session-account", account_id: "forged-browser-account" });

  assert.equal(bodyReads, 1);
  assert.equal(usageCalls, 0);
  assert.equal(providerCalls, 0);
  assert.equal(sent[1].status, 429);
  assert.equal(sent[1].body.error, "electronics_lab_assistant_rate_limited");
  assert.match(sent[1].body.message, /manuelle Elektroniklabor bleibt verfügbar/);
  assert.equal(audits.at(-1).details.outcome, "rate_limited");
  assert.doesNotMatch(JSON.stringify(audits), /trusted-session-account|forged-browser-account|void setup|snapshot/);
});

test("kill switch blocks before parsing, credits and provider", async () => {
  let downstreamCalls = 0;
  const sent = [];
  const assistant = createElectronicsLabAssistant({
    aiUsageJson: async () => { downstreamCalls += 1; },
    llmConfigStore: { resolveRoute: () => { downstreamCalls += 1; } },
    readJsonBody: async () => { downstreamCalls += 1; },
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => { downstreamCalls += 1; },
    enabled: false,
  });

  await assistant.handleRequest({}, {}, { user_id: "account" });

  assert.equal(downstreamCalls, 0);
  assert.equal(sent[0].status, 503);
  assert.equal(sent[0].body.error, "electronics_lab_assistant_disabled");
  assert.match(sent[0].body.message, /manuelle Elektroniklabor bleibt verfügbar/);
});

test("account limiter resets deterministically after its window", () => {
  let currentTime = 10_000;
  const limiter = createAccountRateLimiter({ limit: 1, windowMs: 2_000, now: () => currentTime });
  assert.equal(limiter.consume("account").allowed, true);
  assert.equal(limiter.consume("account").allowed, false);
  currentTime = 12_000;
  assert.equal(limiter.consume("account").allowed, true);
});

test("audit transport failure cannot change a successful assistant response", async () => {
  const sent = [];
  const assistant = createElectronicsLabAssistant({
    aiUsageJson: async (path) => path === "/api/ai-usage/preflight" ? { allowed: true, event_id: "usage-audit" } : {},
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5-nano", apiKey: "test" }) },
    projectServerUserId: () => "account",
    readJsonBody: async () => requestBody({ requestedAction: "explain-observation" }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => ({ ok: true, json: async () => providerPayload({ actionType: "explain-observation", content: "Kurz erklärt.", requiresConfirmation: false, commands: [] }) }),
    auditEvent: () => { throw new Error("audit unavailable"); },
  });

  await assistant.handleRequest({}, {}, {});
  assert.equal(sent[0].status, 200);
});
