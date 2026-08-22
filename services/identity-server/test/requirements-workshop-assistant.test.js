"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRequirementsWorkshopAssistant } = require("../src/dev/requirements-workshop-assistant");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const { registerRequirementsWorkshopRoutes } = require("../src/dev/server/requirements-workshop-routes");

const feedback = {
  summary: "Eine Firmenkarte soll einen Raumzugang ermöglichen; Verfahren und Qualitätsziele sind noch offen.",
  understood: ["Mitarbeitende nutzen eine Firmenkarte."],
  assumptions: [{ title: "Kartentechnik", text: "RFID oder NFC wäre anzunehmen.", impact: "Leser und Sicherheitsniveau hängen davon ab." }],
  unclear: ["Was bedeutet schnell?"],
  knowledge_gaps: [{ topic: "Authentisierung", explanation: "Kartentyp und Vertrauensanker fehlen.", options: ["RFID", "PKI-Smartcard", "Passkey"] }],
  functional_requirements: ["Das System prüft die vorgelegte Firmenkarte."],
  non_functional_requirements: ["Die Prüfzeit muss messbar festgelegt werden."],
  constraints: [],
  business_rules: ["Nur berechtigte Mitarbeitende erhalten Zutritt."],
  acceptance_criteria: ["Eine gesperrte Karte öffnet die Tür nicht."],
  follow_up_questions: ["Welche Kartentechnik wird eingesetzt?"],
  quality_score: 58,
};

test("requirements workshop returns a structured understanding mirror with usage accounting", async () => {
  const sent = [];
  const usageCalls = [];
  let providerRequest;
  const assistant = createRequirementsWorkshopAssistant({
    aiUsageJson: async (path, options) => {
      usageCalls.push({ path, options });
      if (path === "/api/ai-usage/preflight") return { allowed: true, event_id: "usage-req-1" };
      return { event_id: "usage-req-1", status: "completed" };
    },
    llmConfigStore: { resolveRoute(task) {
      assert.equal(task, "requirements_workshop");
      return { provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5-nano", apiKey: "test-key", costPolicy: "external_costs_with_preflight" };
    } },
    projectServerUserId: () => "acct-secret-42",
    accountSubscription: () => ({ entitlements: ["ai_assistant"] }),
    readJsonBody: async () => ({ proposal: "Mitarbeitende öffnen den Raum schnell und sicher mit ihrer Firmenkarte.", account_id: "forged" }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async (url, options) => {
      providerRequest = { url, options, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ output_text: JSON.stringify(feedback), usage: { input_tokens: 300, output_tokens: 160, total_tokens: 460 } }) };
    },
  });

  await assistant.handleFeedback({}, {}, { user_id: "session-user" });

  assert.equal(providerRequest.url, "https://api.openai.test/v1/responses");
  assert.equal(providerRequest.body.store, false);
  assert.equal(providerRequest.body.text.format.type, "json_schema");
  assert.equal(providerRequest.body.text.format.strict, true);
  assert.match(providerRequest.body.safety_identifier, /^requirements-[a-f0-9]{24}$/);
  assert.doesNotMatch(providerRequest.body.safety_identifier, /acct-secret/);
  assert.match(providerRequest.options.headers.Authorization, /test-key/);
  assert.equal(usageCalls[0].options.body.account_id, "acct-secret-42");
  assert.equal(usageCalls[0].options.body.feature, "requirements_workshop_feedback");
  assert.deepEqual(usageCalls[0].options.internalAuth, {
    scopes: ["ai.usage.consume"],
    delegation: { account_id: "acct-secret-42", project_ids: [], entitlements: ["ai_assistant"] },
  });
  assert.equal(usageCalls[1].path, "/api/ai-usage/events/usage-req-1/complete");
  assert.deepEqual(usageCalls[1].options.body, { input_tokens: 300, output_tokens: 160 });
  assert.deepEqual(usageCalls[1].options.internalAuth, usageCalls[0].options.internalAuth);
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.feedback.follow_up_questions.length, 1);
  assert.equal(sent[0].body.routing.routeTask, "requirements_workshop");
});

test("requirements workshop rejects usage before calling the provider", async () => {
  let providerCalls = 0;
  const sent = [];
  const assistant = createRequirementsWorkshopAssistant({
    aiUsageJson: async () => ({ allowed: false, reason: "limit" }),
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-responses", apiModel: "gpt-5-nano" }) },
    projectServerUserId: () => "acct-test",
    readJsonBody: async () => ({ proposal: "Das System soll sicher sein." }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => { providerCalls += 1; },
  });

  await assistant.handleFeedback({}, {}, {});

  assert.equal(providerCalls, 0);
  assert.equal(sent[0].status, 402);
  assert.equal(sent[0].body.error, "ai_usage_rejected");
});

test("requirements workshop requires a proposal", async () => {
  const sent = [];
  const assistant = createRequirementsWorkshopAssistant({
    aiUsageJson: async () => { throw new Error("must not run"); },
    llmConfigStore: { resolveRoute: () => { throw new Error("must not run"); } },
    readJsonBody: async () => ({ proposal: "  " }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
  });
  await assistant.handleFeedback({}, {}, {});
  assert.equal(sent[0].status, 400);
});

test("requirements workshop API passes only the server session to the assistant", async () => {
  const registry = createRouteRegistry();
  const identitySession = { account: { user_id: "acct-owner" } };
  let receivedSession;
  registerRequirementsWorkshopRoutes({
    registry,
    requireSession: async () => identitySession,
    requirementsWorkshopAssistant: { async handleFeedback(_req, _res, session) { receivedSession = session; } },
  });

  const matched = await registry.dispatch({
    req: { method: "POST" },
    res: {},
    url: new URL("http://localhost/api/platform/requirements-workshop/feedback"),
  });

  assert.equal(matched, true);
  assert.equal(receivedSession, identitySession);
});
