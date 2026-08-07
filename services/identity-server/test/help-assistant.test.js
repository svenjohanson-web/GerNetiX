const assert = require("node:assert/strict");
const test = require("node:test");
const { createHelpAssistant } = require("../src/dev/help-assistant");

test("help assistant uses the cost-controlled OpenAI help route and returns article recommendations", async () => {
  const sent = [];
  const calls = [];
  const assistant = createHelpAssistant({
    aiContextJson: async (path) => {
      assert.match(path, /\/api\/ai-context\/help-articles\/search/);
      return { strategy: "semantic", items: [{ article_id: "help.pairing", title: "Board pairen", summary: "Pairing nach Registrierung", content: "Verbinde das Board per USB, registriere es und bestaetige das Pairing." }] };
    },
    aiUsageJson: async (path, options) => {
      if (path === "/api/ai-usage/preflight") return { allowed: true, event_id: "usage-help-1" };
      assert.equal(path, "/api/ai-usage/events/usage-help-1/complete");
      assert.deepEqual(options.body, { input_tokens: 120, output_tokens: 20 });
      return { event_id: "usage-help-1", status: "completed" };
    },
    projectServerUserId: () => "acct-test",
    llmConfigStore: { resolveRoute(task) { assert.equal(task, "help_chat"); return { provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5-nano", apiKey: "test-key", costPolicy: "external_costs_with_preflight" }; } },
    readJsonBody: async () => ({ messages: [{ role: "user", content: "How do I pair my ESP32?" }] }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ output_text: "Connect the board by USB, register it and confirm pairing.", usage: { input_tokens: 120, output_tokens: 20, total_tokens: 140 } }) };
    },
  });

  await assistant.handleChat({}, {});

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.test/v1/responses");
  assert.match(calls[0].options.body, /gpt-5-nano/);
  assert.match(calls[0].options.body, /Board pairen/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-key");
  assert.equal(JSON.parse(calls[0].options.body).store, false);
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.routing.provider, "openai-responses");
  assert.equal(sent[0].body.routing.costPolicy, "external_costs_with_preflight");
  assert.equal(sent[0].body.openTopicId, "pair-device");
});

test("help assistant does not call OpenAI or reserve credits without matching help knowledge", async () => {
  const sent = [];
  const assistant = createHelpAssistant({
    aiContextJson: async () => ({ strategy: "semantic", items: [] }),
    aiUsageJson: async () => { throw new Error("AI Usage must not be called"); },
    llmConfigStore: { resolveRoute() { return { provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5-nano", apiKey: "test-key" }; } },
    readJsonBody: async () => ({ messages: [{ role: "user", content: "Wie ist das Wetter morgen?" }] }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => { throw new Error("OpenAI must not be called"); },
  });

  await assistant.handleChat({}, {});

  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.retrieval.strategy, "no_matching_help_article");
  assert.match(sent[0].body.answer, /keine passende Information/);
  assert.equal(sent[0].body.routing.costPolicy, "no_llm_call");
});
