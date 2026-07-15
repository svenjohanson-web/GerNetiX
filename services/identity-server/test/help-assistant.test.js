const assert = require("node:assert/strict");
const test = require("node:test");
const { createHelpAssistant } = require("../src/dev/help-assistant");

test("help assistant uses only the local Ollama help route and returns article recommendations", async () => {
  const sent = [];
  const calls = [];
  const assistant = createHelpAssistant({
    aiContextJson: async (path) => {
      assert.match(path, /\/api\/ai-context\/help-articles\/search/);
      return { strategy: "semantic", items: [{ article_id: "help.pairing", title: "Board pairen", summary: "Pairing nach Registrierung", content: "Verbinde das Board per USB, registriere es und bestaetige das Pairing." }] };
    },
    llmConfigStore: { resolveRoute(task) { assert.equal(task, "help_chat"); return { provider: "ollama", ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "local-help-model" }; } },
    readJsonBody: async () => ({ messages: [{ role: "user", content: "How do I pair my ESP32?" }] }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ message: { content: "Connect the board by USB, register it and confirm pairing." } }) };
    },
  });

  await assistant.handleChat({}, {});

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/chat");
  assert.match(calls[0].options.body, /local-help-model/);
  assert.match(calls[0].options.body, /Board pairen/);
  assert.doesNotMatch(calls[0].options.body, /api\.openai\.com|Authorization/);
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.routing.provider, "ollama");
  assert.equal(sent[0].body.routing.costPolicy, "local_only");
  assert.equal(sent[0].body.openTopicId, "pair-device");
});

test("help assistant does not call a model without matching local help knowledge", async () => {
  const sent = [];
  const assistant = createHelpAssistant({
    aiContextJson: async () => ({ strategy: "semantic", items: [] }),
    llmConfigStore: { resolveRoute() { return { provider: "ollama", ollamaBaseUrl: "http://127.0.0.1:11434", ollamaModel: "local-help-model" }; } },
    readJsonBody: async () => ({ messages: [{ role: "user", content: "Wie ist das Wetter morgen?" }] }),
    sendJson: (_res, status, body) => sent.push({ status, body }),
    fetchImpl: async () => { throw new Error("Ollama must not be called"); },
  });

  await assistant.handleChat({}, {});

  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.retrieval.strategy, "no_matching_help_article");
  assert.match(sent[0].body.answer, /keine passende Information/);
});
