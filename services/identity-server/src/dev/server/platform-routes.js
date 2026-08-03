"use strict";

function registerPlatformRoutes({
  registry,
  requireSession,
  readJsonBody,
  sendJson,
  handleSummary,
  handleBootstrap,
  updateWorkspaceState,
  updateLearningProgress,
  updateResourceSelection,
}) {
  async function withSession(req, res, action) {
    const session = await requireSession(req, res);
    if (!session) return;
    await action(session);
  }

  registry.register({
    method: "*",
    path: "/api/platform/summary",
    handler: ({ req, res }) => withSession(req, res, (session) => handleSummary(res, session)),
  });
  registry.register({
    method: "*",
    path: "/api/platform/bootstrap",
    handler: ({ req, res }) => withSession(req, res, (session) => handleBootstrap(res, session)),
  });
  registry.register({
    method: "POST",
    path: "/api/platform/workspace-state",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      sendJson(res, 200, updateWorkspaceState(session, await readJsonBody(req)));
    }),
  });
  registry.register({
    method: "POST",
    path: "/api/platform/learning-progress",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      sendJson(res, 200, await updateLearningProgress(session, await readJsonBody(req)));
    }),
  });
  registry.register({
    method: "PUT",
    path: "/api/platform/billing/project-selection",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      sendJson(res, 200, await updateResourceSelection(session, await readJsonBody(req)));
    }),
  });
}

module.exports = { registerPlatformRoutes };
