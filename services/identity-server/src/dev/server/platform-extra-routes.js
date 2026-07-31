"use strict";

function registerPlatformExtraRoutes({
  registry, requireSession, sendJson, loadHardwareShopSummary, loadAiUsageSummary, handleHardwareShopOrder,
}) {
  registry.register({
    method: "*",
    path: "/api/user-ide/hardware-shop",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) sendJson(res, 200, await loadHardwareShopSummary(session));
    },
  });
  registry.register({
    method: "*",
    path: "/api/user-ide/ai-usage",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) sendJson(res, 200, await loadAiUsageSummary(session));
    },
  });
  registry.register({
    method: "POST",
    path: "/api/user-ide/hardware-shop/orders",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) await handleHardwareShopOrder(req, res, session);
    },
  });
}

module.exports = { registerPlatformExtraRoutes };
