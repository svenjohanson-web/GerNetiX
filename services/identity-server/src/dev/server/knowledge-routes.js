"use strict";

function registerKnowledgeRoutes({ registry, requireSession, markChapterRead }) {
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
