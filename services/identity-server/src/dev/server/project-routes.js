"use strict";

function registerProjectRoutes(dependencies) {
  const {
    registry, requireSession, readJsonBody, sendJson, requireEntitlement, requireSessionProject,
    projectServerJson, projectServerUserId, developmentAssistant, helpAssistant,
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
