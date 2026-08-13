"use strict";

function registerProtectedContentRoutes({
  registry,
  requireSession,
  readJsonBody,
  sendJson,
  helpContentStore,
  quizContentStore,
}) {
  registry.register({
    method: "GET",
    path: "/api/platform/help/content",
    async handler({ req, res }) {
      if (!await requireSession(req, res)) return;
      sendJson(res, 200, helpContentStore.responseForSession());
    },
  });
  registry.register({
    method: "GET",
    path: "/api/platform/quiz/catalog",
    async handler({ req, res, url }) {
      if (!await requireSession(req, res)) return;
      sendJson(res, 200, quizContentStore.catalogFor(url.searchParams.get("locale") || "de"));
    },
  });
  registry.register({
    method: "POST",
    path: "/api/platform/quiz/answer",
    async handler({ req, res }) {
      if (!await requireSession(req, res)) return;
      const body = await readJsonBody(req);
      const result = quizContentStore.evaluate({
        locale: body.locale || "de",
        categoryId: body.category_id,
        questionId: body.question_id,
        optionIndex: body.option_index,
      });
      if (!result) {
        sendJson(res, 400, { error: "invalid_quiz_answer" });
        return;
      }
      sendJson(res, 200, result);
    },
  });
}

module.exports = { registerProtectedContentRoutes };
