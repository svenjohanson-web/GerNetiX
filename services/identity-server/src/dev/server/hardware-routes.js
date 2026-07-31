"use strict";

function registerHardwareRoutes({
  registry,
  requireSession,
  readJsonBody,
  sendJson,
  loadAvailableProcessorBoards,
  projectServerUserId,
  loadAccountBoardConfigurations,
  deviceManagementJson,
  hardwareCatalogJson,
  loadSensors,
  recordSystemEvent,
}) {
  registry.register({
    method: "GET",
    path: "/api/platform/hardware/processor-boards",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      try {
        sendJson(res, 200, { items: await loadAvailableProcessorBoards(session) });
      } catch {
        sendJson(res, 502, { error: "hardware_catalog_unreachable", dependency: "hardware_catalog", message: "Hardware-Katalog nicht erreichbar." });
      }
    },
  });

  for (const method of ["GET", "POST"]) {
    registry.register({
      method,
      path: "/api/platform/account-board-configurations",
      async handler({ req, res }) {
        const session = await requireSession(req, res);
        if (!session) return;
        if (method === "GET") {
          sendJson(res, 200, { items: await loadAccountBoardConfigurations(session) });
          return;
        }
        const accountId = projectServerUserId(session);
        sendJson(res, 201, await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/board-configurations`, {
          method: "POST", body: await readJsonBody(req),
        }));
      },
    });
    registry.register({
      method,
      pattern: /^\/api\/platform\/account-board-configurations\/([^/]+)\/versions$/,
      async handler({ req, res, match }) {
        const session = await requireSession(req, res);
        if (!session) return;
        const servicePath = `/api/device-management/accounts/${encodeURIComponent(projectServerUserId(session))}/board-configurations/${encodeURIComponent(decodeURIComponent(match[1]))}/versions`;
        const payload = method === "GET"
          ? await deviceManagementJson(servicePath)
          : await deviceManagementJson(servicePath, { method: "POST", body: await readJsonBody(req) });
        sendJson(res, method === "GET" ? 200 : 201, payload);
      },
    });
  }

  registry.register({
    method: "GET",
    path: "/api/platform/hardware/board-feature-options",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      try {
        sendJson(res, 200, await hardwareCatalogJson("/api/hardware-catalog/board-feature-options"));
      } catch {
        sendJson(res, 502, {
          error: "hardware_catalog_unreachable",
          dependency: "hardware_catalog",
          message: "Die Boardausstattung konnte nicht aus dem Hardware Catalog geladen werden.",
        });
      }
    },
  });
  registry.register({
    method: "GET",
    path: "/api/platform/hardware/sensors",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      try {
        const items = await loadSensors();
        sendJson(res, 200, { items, catalog_status: items.length ? "available" : "empty" });
      } catch (error) {
        recordSystemEvent({
          severity: "error",
          source_service: "identity_server",
          target_service: "hardware_catalog",
          category: "dependency",
          event_type: "dependency_unreachable",
          message: "Sensorarten konnten nicht aus dem Hardware Catalog geladen werden.",
          impact: "Die Sensor-Hardware-Zuordnung ist blockiert.",
          account_id: projectServerUserId(session),
          route: "/api/hardware-catalog/sensors",
          details: { error: error.message || String(error) },
        });
        sendJson(res, 502, {
          error: "hardware_catalog_unreachable",
          dependency: "hardware_catalog",
          message: "Der zugehoerige Service Hardware Catalog ist nicht erreichbar.",
        });
      }
    },
  });
}

module.exports = { registerHardwareRoutes };
