"use strict";

function registerKnowledgeRoutes({
  registry,
  requireSession,
  resolveSession,
  accountSubscription,
  knowledgeContentStore,
  readJsonBody,
  markChapterRead,
  sendJson,
}) {
  registry.register({
    method: "GET",
    pattern: /^\/api\/platform\/knowledge\/chapters\/([^/]+)$/,
    async handler({ req, res, match }) {
      const session = await resolveSession(req);
      const subscription = session ? accountSubscription(session) : { entitlements: [] };
      const payload = knowledgeContentStore.responseFor(decodeURIComponent(match[1]), {
        authenticated: Boolean(session),
        entitlements: subscription.entitlements,
      });
      if (!payload) {
        sendJson(res, 404, { error: "knowledge_chapter_not_found" });
        return;
      }
      sendJson(res, 200, payload);
    },
  });
  registry.register({
    method: "POST",
    pattern: /^\/api\/platform\/knowledge\/chapters\/([^/]+)\/quizzes\/([^/]+)\/answer$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const articleId = decodeURIComponent(match[1]);
      const subscription = accountSubscription(session);
      const content = knowledgeContentStore.responseFor(articleId, { authenticated: true, entitlements: subscription.entitlements });
      if (!content || content.access !== "full") {
        sendJson(res, 403, { error: "knowledge_entitlement_required" });
        return;
      }
      const body = await readJsonBody(req);
      const result = knowledgeContentStore.evaluateQuiz(articleId, decodeURIComponent(match[2]), body.option_id);
      if (!result) {
        sendJson(res, 400, { error: "invalid_knowledge_quiz_answer" });
        return;
      }
      sendJson(res, 200, result);
    },
  });
  registry.register({
    method: "POST",
    pattern: /^\/api\/platform\/knowledge\/chapters\/([^/]+)\/read$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (!session) return;
      await markChapterRead(res, session, decodeURIComponent(match[1]));
    },
  });
}

module.exports = { registerKnowledgeRoutes };
