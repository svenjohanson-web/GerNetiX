"use strict";

function registerProjectRoutes(dependencies) {
  const {
    registry, requireSession, readJsonBody, sendJson, requireEntitlement, requireSessionProject,
    projectServerJson, projectServerUserId, developmentAssistant, helpAssistant, recordSystemEvent,
    developmentProjectTemplateCatalog, projectRepositoryRead,
  } = dependencies;

  async function withSession(req, res, action) {
    const session = await requireSession(req, res);
    if (session) await action(session);
  }
  function registerProjectPattern(method, pattern, action) {
    registry.register({
      method,
      pattern,
      handler: ({ req, res, match, url }) => withSession(req, res, (session) => action({ req, res, match, url, session })),
    });
  }

  registry.register({
    method: "*",
    path: "/api/user-ide/summary",
    handler: ({ req, res }) => withSession(req, res, (session) => dependencies.handleUserIdeSummary(res, session)),
  });
  registry.register({
    method: "POST",
    path: "/api/platform/template-feedback",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      const body = await readJsonBody(req);
      const templateId = String(body.templateId || body.template_id || "");
      const template = (developmentProjectTemplateCatalog?.() || []).find((item) => item.id === templateId && item.id !== "empty");
      if (!template) {
        sendJson(res, 404, { error: "project_template_not_found", message: "Dieses Projekttemplate ist nicht vorhanden." });
        return;
      }
      const feedback = await projectServerJson("/api/template-feedback", {
        method: "POST",
        body: {
          template_id: template.id,
          user_id: projectServerUserId(session),
          category: body.kind === "improvement" ? "template_improvement_suggestion" : "template_experience_rating",
          ratings: body.ratings,
          message: String(body.message || "").slice(0, 2000),
        },
      });
      sendJson(res, 201, { feedback });
    }),
  });
  registry.register({
    method: "POST",
    path: "/api/platform/project-feedback",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      const body = await readJsonBody(req);
      const project = await requireSessionProject(session, String(body.projectId || body.project_id || ""));
      const improvement = body.kind === "improvement";
      const message = String(body.message || "").trim().slice(0, 2000);
      if (improvement && !message) {
        sendJson(res, 400, { error: "missing_required_field", message: "Bitte beschreibe deinen Verbesserungsvorschlag." });
        return;
      }
      const feedback = await projectServerJson("/api/learning-feedback", {
        method: "POST",
        body: {
          project_id: project.project_server_id,
          user_id: projectServerUserId(session),
          category: improvement ? "project_improvement_suggestion" : "development_project_rating",
          ratings: body.ratings,
          message,
          contact_mode: "no_contact",
        },
      });
      sendJson(res, 201, { feedback });
    }),
  });
  registry.register({
    method: "POST",
    path: "/api/platform/development-projects",
    handler: ({ req, res }) => withSession(req, res, (session) => dependencies.handleDevelopmentProjectCreate(req, res, session)),
  });
  registerProjectPattern("POST", /^\/api\/platform\/development-projects\/([^/]+)\/architecture$/, ({ req, res, match, session }) => (
    dependencies.handleDevelopmentProjectArchitectureSave(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/platform\/learning-projects\/([^/]+)\/start$/, ({ res, match, session }) => (
    dependencies.handleLearningProjectStart(res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/platform\/learning-projects\/([^/]+)\/lessons\/([^/]+)\/start$/, ({ res, match, session }) => (
    dependencies.handleDevelopmentLessonStart(res, session, decodeURIComponent(match[1]), decodeURIComponent(match[2]))
  ));
  registerProjectPattern("POST", /^\/api\/platform\/learning-projects\/([^/]+)\/device$/, ({ req, res, match, session }) => (
    dependencies.handleLearningProjectDeviceAssign(req, res, session, decodeURIComponent(match[1]))
  ));
  registry.register({
    method: "POST",
    path: "/api/platform/learning-feedback",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      const body = await readJsonBody(req);
      const project = await requireSessionProject(session, String(body.projectId || body.project_id || ""));
      const feedback = await projectServerJson("/api/learning-feedback", {
        method: "POST",
        body: {
          project_id: project.project_server_id,
          user_id: projectServerUserId(session),
          learning_step_id: String(body.learningStepId || body.learning_step_id || "").slice(0, 160),
          category: "learning_experience_rating",
          ratings: body.ratings,
          message: String(body.message || "").slice(0, 2000),
          contact_mode: "no_contact",
        },
      });
      sendJson(res, 201, { feedback });
    }),
  });
  registerProjectPattern("DELETE", /^\/api\/platform\/projects\/([^/]+)$/, ({ res, match, session }) => (
    dependencies.handlePlatformProjectDelete(res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/platform\/development-projects\/([^/]+)\/dialog$/, ({ req, res, match, session }) => (
    dependencies.handleDevelopmentProjectDialogSave(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/platform\/development-projects\/([^/]+)\/hardware-configuration$/, ({ req, res, match, session }) => (
    dependencies.handleDevelopmentProjectHardwareSave(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/component-features$/, ({ req, res, match, session }) => (
    dependencies.handleProjectComponentFeatures(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/basissoftware-configuration$/, ({ req, res, match, session }) => (
    dependencies.handleProjectBasissoftwareConfiguration(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/communication-setup$/, ({ req, res, match, session }) => (
    dependencies.handleProjectCommunicationSetup(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/component-hardware-features$/, ({ req, res, match, session }) => (
    dependencies.handleProjectComponentHardwareFeatures(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/pwa-dashboard$/, ({ req, res, match, session }) => (
    dependencies.handleProjectPwaDashboard(req, res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/event-configuration$/, ({ req, res, match, session }) => (
    dependencies.handleProjectEventConfiguration(req, res, session, decodeURIComponent(match[1]))
  ));
  for (const method of ["GET", "POST", "DELETE"]) {
    registerProjectPattern(method, /^\/api\/user-ide\/projects\/([^/]+)\/debug-session$/, async ({ req, res, match, session }) => {
      const project = await requireSessionProject(session, decodeURIComponent(match[1]));
      const body = method === "POST" ? await readJsonBody(req) : undefined;
      const result = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/debug-session`, {
        method,
        ...(body ? { body } : {}),
      });
      sendJson(res, method === "POST" ? 201 : 200, result);
    });
  }
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/debug-session\/activity$/, async ({ res, match, session }) => {
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    const result = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/debug-session/activity`, {
      method: "POST",
      body: {},
    });
    sendJson(res, 200, result);
  });
  registerProjectPattern("POST", /^\/api\/user-ide\/projects\/([^/]+)\/basissoftware-incidents$/, async ({ req, res, match, session }) => {
    const projectId = decodeURIComponent(match[1]);
    const project = await requireSessionProject(session, projectId);
    const body = await readJsonBody(req);
    const incidents = Array.isArray(body.incidents) ? body.incidents.slice(0, 16) : [];
    const safeIncidents = incidents.map((incident) => ({
      type: ["task_stack_critical", "basissoftware_crash"].includes(incident?.type) ? incident.type : "invalid",
      task_name: String(incident?.task_name || "unknown").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 32),
      minimum_free_stack_bytes: Number.isFinite(Number(incident?.minimum_free_stack_bytes))
        ? Math.max(0, Math.round(Number(incident.minimum_free_stack_bytes))) : null,
      fault_code: String(incident?.fault_code || "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 48),
    })).filter((incident) => incident.type !== "invalid");
    if (!safeIncidents.length || !recordSystemEvent) {
      sendJson(res, 400, { error: "invalid_basissoftware_incident" });
      return;
    }
    const buildId = String(body.build_id || "").toLowerCase();
    if (buildId && !/^[a-f0-9]{64}$/.test(buildId)) {
      sendJson(res, 400, { error: "invalid_build_id" });
      return;
    }
    const componentId = String(body.component_id || "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
    const softwareUnitId = String(body.software_unit_id || "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
    const delivered = await recordSystemEvent({
      severity: "critical",
      source_service: "gernetix_basissoftware",
      target_service: "admin_tool",
      category: "basissoftware_runtime",
      event_type: "basissoftware_runtime_defect_detected",
      message: `Kritischer Basissoftware-Laufzeitfehler in ${componentId || "einem IoT-Device"} erkannt.`,
      impact: "Die geschützte Basissoftware kann nicht durch den Nutzer korrigiert werden und benötigt eine Betreiberprüfung.",
      account_id: projectServerUserId(session),
      route: `/app/debug/?project=${encodeURIComponent(projectId)}`,
      correlation_id: `${buildId || "no-build"}:${componentId || "device"}:${safeIncidents.map((item) => `${item.type}:${item.task_name}`).join(",")}`.slice(0, 240),
      details: {
        project_id: projectId,
        project_server_id: project.project_server_id,
        component_id: componentId,
        software_unit_id: softwareUnitId,
        build_id: buildId,
        basissoftware_version: String(body.basissoftware_version || "").slice(0, 48),
        incidents: safeIncidents,
        credentials_included: false,
        raw_logs_included: false,
      },
    });
    if (!delivered) {
      sendJson(res, 502, { error: "operator_notification_failed", message: "Die kritische Meldung konnte das Admin-System nicht erreichen." });
      return;
    }
    sendJson(res, 202, { reported: true, severity: "critical" });
  });

  registry.register({
    method: "POST",
    path: "/api/platform/development-assistant/chat",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      if (requireEntitlement(res, session, "ai_assistant")) await developmentAssistant.handleChat(req, res, session);
    }),
  });
  registry.register({
    method: "POST",
    path: "/api/platform/help-assistant/chat",
    handler: ({ req, res }) => withSession(req, res, () => helpAssistant.handleChat(req, res)),
  });

  for (const method of ["GET", "POST"]) {
    registerProjectPattern(method, /^\/api\/platform\/projects\/([^/]+)\/versions$/, async ({ req, res, match, session }) => {
      if (!requireEntitlement(res, session, "project_history")) return;
      const project = await requireSessionProject(session, decodeURIComponent(match[1]));
      const servicePath = `/api/projects/${encodeURIComponent(project.project_server_id)}/versions`;
      if (method === "GET") { sendJson(res, 200, await projectServerJson(servicePath)); return; }
      const body = await readJsonBody(req);
      sendJson(res, 201, await projectServerJson(servicePath, { method: "POST", body: { ...body, user_id: projectServerUserId(session) } }));
    });
  }
  registerProjectPattern("POST", /^\/api\/platform\/projects\/([^/]+)\/versions\/([^/]+)\/restore$/, async ({ req, res, match, session }) => {
    if (!requireEntitlement(res, session, "project_history")) return;
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    const body = await readJsonBody(req);
    sendJson(res, 201, await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/versions/${encodeURIComponent(match[2])}/restore`, {
      method: "POST", body: { ...body, user_id: projectServerUserId(session) },
    }));
  });
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/source-search$/, ({ res, match, url, session }) => (
    dependencies.handlePlatformSourceSearch(res, session, decodeURIComponent(match[1]), url.searchParams)
  ));
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/repository$/, async ({ res, match, session }) => {
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    sendJson(res, 200, await projectRepositoryRead.status(project));
  });
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/repository\/tree$/, async ({ res, match, url, session }) => {
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    sendJson(res, 200, await projectRepositoryRead.tree(project, url.searchParams.get("commit_sha") || ""));
  });
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/repository\/history$/, async ({ res, match, session }) => {
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    sendJson(res, 200, await projectRepositoryRead.history(project));
  });
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/repository\/commits\/([^/]+)\/diff$/, async ({ res, match, session }) => {
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    sendJson(res, 200, await projectRepositoryRead.diff(project, decodeURIComponent(match[2])));
  });
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/repository\/files\/(.+)$/, async ({ res, match, url, session }) => {
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    sendJson(res, 200, await projectRepositoryRead.file(
      project,
      decodeURIComponent(match[2]),
      url.searchParams.get("commit_sha") || "",
    ));
  });
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/sources$/, ({ res, match, session }) => (
    dependencies.handlePlatformSourceList(res, session, decodeURIComponent(match[1]))
  ));
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)\/sources\/(.+)$/, ({ res, match, session }) => (
    dependencies.handlePlatformSourceRead(res, session, decodeURIComponent(match[1]), decodeURIComponent(match[2]))
  ));
  registerProjectPattern("PUT", /^\/api\/platform\/projects\/([^/]+)\/sources\/(.+)$/, ({ req, res, match, session }) => (
    dependencies.handlePlatformSourceWrite(req, res, session, decodeURIComponent(match[1]), decodeURIComponent(match[2]))
  ));
  registry.register({
    method: "*",
    path: "/api/user-ide/projects",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      sendJson(res, 200, { items: await dependencies.loadUserIdeProjects(session) });
    }),
  });
}

module.exports = { registerProjectRoutes };
