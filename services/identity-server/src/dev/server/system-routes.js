"use strict";

function registerSystemRoutes({
  registry, requireSession, readJsonBody, sendJson, sendDevJson, requireInternalAdmin,
  handleDevLessonPreviewMigration, identityPersistenceBackend, identityRuntimeLocation, identityRemoteDev,
  smtpConfigStore, smtpEmailService, createIdentityLinkInventory, publicDir,
  webPushService, securityAlertPushAccountIds, requireSessionProject, projectServerUserId,
  handleInternalDevicePushEvent, handleInternalDeviceRuntimeEvent, handleUserActionIngest,
  userActionDiagnostics, handleProjectRuntimeStream, telemetryJson,
  checkIdentityDbHealth = async () => ({ status: "unknown" }),
  checkIdentityDependencies = async () => ({ status: "unknown", total: 0, reachable: 0, unreachable: 0, items: [] }),
}) {
  registry.register({ method: "OPTIONS", path: "/api/dev/lesson-preview-migration", handler: ({ res }) => sendDevJson(res, 204, {}) });
  registry.register({
    method: "POST",
    path: "/api/dev/lesson-preview-migration",
    handler({ req, res }) {
      requireInternalAdmin(req, "identity.dev.migration");
      return handleDevLessonPreviewMigration(req, res);
    },
  });
  registry.register({
    method: "*",
    path: "/health",
    async handler({ res }) {
      const identityDb = await checkIdentityDbHealth().catch((error) => ({
        backend: "postgres",
        reachable: false,
        checked_at: new Date().toISOString(),
        error_code: error.code || "health_check_failed",
        error: error.message || String(error),
        message: "PostgreSQL-Healthcheck fehlgeschlagen.",
      }));
      const dependencies = await checkIdentityDependencies().catch((error) => ({
        status: "degraded",
        checked_at: new Date().toISOString(),
        total: 0,
        reachable: 0,
        unreachable: 1,
        items: [{ id: "dependency-health", name: "Dependency-Healthcheck", reachable: false, error_code: error.code || "health_check_failed", message: error.message || String(error) }],
      }));
      const status = identityDb.reachable === false ? "unhealthy" : dependencies.status === "degraded" ? "degraded" : "ok";
      sendJson(res, 200, {
        status, service: "identity-server", persistence_backend: identityPersistenceBackend,
        runtime_location: identityRuntimeLocation, remote_dev: identityRemoteDev,
        identity_db: identityDb,
        dependencies,
      });
    },
  });
  registry.register({
    method: "*",
    path: "/api/internal/email-config",
    async handler({ req, res }) {
      requireInternalAdmin(req, req.method === "GET" ? "identity.email.read" : "identity.email.write");
      if (req.method === "GET") { sendJson(res, 200, { config: smtpConfigStore.publicConfig() }); return; }
      if (req.method === "PUT") { sendJson(res, 200, { config: await smtpConfigStore.update(await readJsonBody(req)) }); return; }
      sendJson(res, 405, { error: "method_not_allowed" });
    },
  });
  registry.register({
    method: "GET",
    path: "/api/internal/link-integrity/inventory",
    handler({ req, res }) {
      requireInternalAdmin(req, "identity.link_integrity.read");
      sendJson(res, 200, createIdentityLinkInventory({ publicDir }));
    },
  });
  registry.register({
    method: "POST",
    path: "/api/internal/email-config/test",
    async handler({ req, res }) {
      requireInternalAdmin(req, "identity.email.test");
      await smtpEmailService.testConnection();
      sendJson(res, 200, { ok: true, config: smtpConfigStore.publicConfig() });
    },
  });
  registry.register({
    method: "POST",
    path: "/api/internal/security-alert",
    async handler({ req, res }) {
      requireInternalAdmin(req, "identity.alert.security");
      const alert = await readJsonBody(req);
      const config = smtpConfigStore.deliveryConfig();
      const recipient = config?.security_alert_recipient || config?.reply_to || config?.from_address;
      if (!recipient) { sendJson(res, 409, { error: "security_alert_recipient_missing" }); return; }
      await smtpEmailService.send(recipient, `GerNetiX Sicherheitsalarm: ${String(alert.severity || "warning").toUpperCase()}`, String(alert.message || "Sicherheitsereignis erkannt."));
      const push = await webPushService.notifyAccounts(securityAlertPushAccountIds, {
        title: "GerNetiX Sicherheitsalarm", body: String(alert.message || "Sicherheitsereignis erkannt."), url: "/app/dashboard/",
      });
      sendJson(res, 202, { accepted: true, recipient, push });
    },
  });
  registry.register({
    method: "POST",
    path: "/api/internal/operator-alert",
    async handler({ req, res }) {
      requireInternalAdmin(req, "identity.alert.operator");
      const alert = await readJsonBody(req);
      const config = smtpConfigStore.deliveryConfig();
      const recipient = config?.security_alert_recipient || config?.reply_to || config?.from_address;
      if (!recipient) { sendJson(res, 409, { error: "operator_alert_recipient_missing" }); return; }
      const message = String(alert.message || "Kritischer Plattformfehler erkannt.").slice(0, 500);
      await smtpEmailService.send(recipient, `GerNetiX Betreiberhinweis: ${String(alert.severity || "critical").toUpperCase()}`, message);
      const push = await webPushService.notifyAccounts(securityAlertPushAccountIds, {
        title: "GerNetiX Basissoftwarefehler", body: message, url: "/app/dashboard/",
      });
      sendJson(res, 202, { accepted: true, recipient, push });
    },
  });
  registry.register({
    method: "GET",
    path: "/api/push/public-key",
    handler: ({ res }) => sendJson(res, 200, { enabled: webPushService.enabled, public_key: webPushService.publicKey || "" }),
  });
  registry.register({
    method: "POST",
    pattern: /^\/api\/push\/projects\/([^/]+)\/(subscribe|test)$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const projectId = decodeURIComponent(match[1]);
      await requireSessionProject(session, projectId);
      if (match[2] === "subscribe") {
        if (!webPushService.enabled) { sendJson(res, 503, { error: "push_not_configured" }); return; }
        await webPushService.subscribeProject(projectServerUserId(session), projectId, await readJsonBody(req));
        sendJson(res, 201, { subscribed: true, project_id: projectId });
        return;
      }
      const push = await webPushService.notifyProject(projectServerUserId(session), projectId, {
        title: "GerNetiX Testnachricht", body: "Hallo Welt – dein privater Projekt-Push-Kanal ist aktiv.",
        url: `/app/ide/?project=${encodeURIComponent(projectId)}`,
      });
      sendJson(res, 202, { accepted: true, project_id: projectId, push });
    },
  });
  registry.register({ method: "POST", path: "/api/internal/push/device-event", handler: ({ req, res }) => handleInternalDevicePushEvent(req, res) });
  registry.register({ method: "POST", path: "/api/internal/runtime/device-event", handler: ({ req, res }) => handleInternalDeviceRuntimeEvent(req, res) });
  registry.register({ method: "POST", path: "/api/operations/user-actions", handler: ({ req, res }) => handleUserActionIngest(req, res) });
  registry.register({
    method: "GET",
    path: "/api/dev/local-action-diagnostics",
    handler({ res }) {
      if (!identityRemoteDev) { sendJson(res, 404, { error: "not_found" }); return; }
      sendJson(res, 200, userActionDiagnostics());
    },
  });
  registry.register({
    method: "GET",
    pattern: /^\/api\/platform\/projects\/([^/]+)\/runtime-stream$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (session) await handleProjectRuntimeStream(req, res, session, decodeURIComponent(match[1]));
    },
  });
  registry.register({
    method: "*",
    pattern: /^\/api\/platform\/telemetry\/projects\/([^/]+)\/(measurements|events|retention|data)$/,
    async handler({ req, res, match, url }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const projectId = decodeURIComponent(match[1]);
      const resource = match[2];
      await requireSessionProject(session, projectId);
      const accountId = projectServerUserId(session);
      const telemetryPath = `/api/telemetry/internal/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(projectId)}/${resource}${url.search || ""}`;
      if (req.method === "GET" && resource !== "data") { sendJson(res, 200, await telemetryJson(telemetryPath)); return; }
      if (req.method === "PUT" && resource === "retention") { sendJson(res, 200, await telemetryJson(telemetryPath, { method: "PUT", body: await readJsonBody(req) })); return; }
      if (req.method === "DELETE" && resource === "data") { sendJson(res, 200, await telemetryJson(telemetryPath, { method: "DELETE" })); return; }
      sendJson(res, 405, { error: "method_not_allowed" });
    },
  });
}

module.exports = { registerSystemRoutes };
