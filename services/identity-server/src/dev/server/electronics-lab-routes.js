"use strict";

function registerElectronicsLabRoutes({ registry, requireSession, electronicsLabAssistant }) {
  registry.register({
    method: "POST",
    path: "/api/platform/electronics-lab/assistant",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) await electronicsLabAssistant.handleRequest(req, res, session);
    },
  });
}

module.exports = { registerElectronicsLabRoutes };
