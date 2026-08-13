"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createHelpContentStore } = require("../src/help/help-content-store");
const { createQuizContentStore } = require("../src/quiz/quiz-content-store");
const { registerProtectedContentRoutes } = require("../src/dev/server/protected-content-routes");
const { createRouteRegistry } = require("../src/dev/server/route-registry");

function createHarness({ authenticated }) {
  const registry = createRouteRegistry();
  const responses = [];
  registerProtectedContentRoutes({
    registry,
    requireSession: async (_req, res) => {
      if (authenticated) return { account: { id: "account-1" } };
      responses.push({ status: 401, body: { error: "session_required" }, res });
      return null;
    },
    readJsonBody: async (req) => req.body || {},
    sendJson: (_res, status, body) => responses.push({ status, body }),
    helpContentStore: createHelpContentStore(),
    quizContentStore: createQuizContentStore(),
  });
  return { registry, responses };
}

test("anonymous callers receive neither help articles nor quiz questions", async () => {
  const { registry, responses } = createHarness({ authenticated: false });
  for (const pathname of ["/api/platform/help/content", "/api/platform/quiz/catalog?locale=de"]) {
    await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL(`http://localhost${pathname}`) });
  }
  assert.deepEqual(responses.map((entry) => entry.status), [401, 401]);
  assert.doesNotMatch(JSON.stringify(responses), /Neues Board in Betrieb nehmen|embedded-volatile-memory/);
});

test("authenticated quiz catalog omits solutions and evaluates one answer server-side", async () => {
  const { registry, responses } = createHarness({ authenticated: true });
  await registry.dispatch({
    req: { method: "GET" }, res: {},
    url: new URL("http://localhost/api/platform/quiz/catalog?locale=de"),
  });
  const catalog = responses[0].body;
  const question = catalog.categories[0].questions[0];
  assert.equal(question.correctIndex, undefined);
  assert.equal(question.explanation, undefined);
  assert.doesNotMatch(JSON.stringify(catalog), /correctIndex|explanation/);

  await registry.dispatch({
    req: { method: "POST", body: { locale: "de", category_id: "embedded", question_id: question.id, option_index: 0 } },
    res: {}, url: new URL("http://localhost/api/platform/quiz/answer"),
  });
  assert.equal(responses[1].status, 200);
  assert.equal(typeof responses[1].body.correct, "boolean");
  assert.ok(responses[1].body.explanation.length > 30);
});

test("public browser files contain loaders but no authored help or quiz solution corpus", () => {
  const publicApp = path.join(__dirname, "..", "public", "app");
  const helpLoader = fs.readFileSync(path.join(publicApp, "help-content.js"), "utf8");
  const quizLoader = fs.readFileSync(path.join(publicApp, "quiz-data.js"), "utf8");
  assert.match(helpLoader, /\/api\/platform\/help\/content/);
  assert.match(quizLoader, /\/api\/platform\/quiz\/catalog/);
  assert.doesNotMatch(helpLoader, /Neues Board in Betrieb nehmen|const articleAccess/);
  assert.doesNotMatch(quizLoader, /correctIndex\s*:|explanation\s*:/);
});
