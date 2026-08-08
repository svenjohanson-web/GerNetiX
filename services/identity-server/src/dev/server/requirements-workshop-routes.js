"use strict";

function registerRequirementsWorkshopRoutes({ registry, requireSession, requirementsWorkshopAssistant }) {
  registry.register({
    method: "POST",
    path: "/api/platform/requirements-workshop/feedback",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) await requirementsWorkshopAssistant.handleFeedback(req, res, session);
    },
  });
}

module.exports = { registerRequirementsWorkshopRoutes };
