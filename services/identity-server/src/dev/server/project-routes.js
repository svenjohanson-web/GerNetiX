"use strict";

const { readUserActionContext } = require("../../services/user-action-events");

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
  registerProjectPattern("GET", /^\/api\/platform\/projects\/([^/]+)$/, ({ res, match, session }) => (
    dependencies.handlePlatformProjectRead(res, session, decodeURIComponent(match[1]))
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
  for (const method of ["GET", "PUT"]) {
    registerProjectPattern(method, /^\/api\/platform\/projects\/([^/]+)\/project-app$/, async ({ req, res, match, session }) => {
      const project = await requireSessionProject(session, decodeURIComponent(match[1]));
      const accountId = projectServerUserId(session);
      const servicePath = `/api/projects/${encodeURIComponent(project.project_server_id)}/project-app`;
      if (method === "GET") {
        const query = new URLSearchParams({ account_id: accountId });
        const snapshot = await projectServerJson(`${servicePath}?${query}`);
        const [accountDevices, processorBoards] = await Promise.all([
          dependencies.loadUserIdeDevices(session).catch(() => []),
          dependencies.loadProcessorBoards?.().catch(() => []),
        ]);
        const assignedDeviceIds = Array.isArray(snapshot.assigned_device_ids)
          ? snapshot.assigned_device_ids
          : project.linked_device_ids || (project.linked_device_id ? [project.linked_device_id] : []);
        const ownedDeviceIds = new Set(accountDevices.map((device) => device.device_id));
        const safeAssignedDeviceIds = assignedDeviceIds.filter((deviceId) => ownedDeviceIds.has(deviceId));
        const hardwareReports = new Map(accountDevices.map((device) => [
          device.device_id,
          projectAppDeviceCompatibility({ project, manifest: snapshot.manifest, device, processorBoards }),
        ]));
        const bindings = await resolveProjectAppBindings({
          manifest: snapshot.manifest,
          project,
          session,
          accountDevices,
          assignedDeviceIds: safeAssignedDeviceIds,
          loadUserIdeDevices: dependencies.loadUserIdeDevices,
          loadAiUsageSummary: dependencies.loadAiUsageSummary,
          loadProjectTelemetry: (binding) => loadProjectAppTelemetry({
            binding,
            project,
            accountId,
            telemetryJson: dependencies.telemetryJson,
          }),
        });
        sendJson(res, 200, {
          ...snapshot,
          assigned_device_ids: safeAssignedDeviceIds,
          assigned_devices: accountDevices.filter((device) => safeAssignedDeviceIds.includes(device.device_id))
            .map((device) => projectAppDeviceSummary(device, hardwareReports.get(device.device_id))),
          available_devices: accountDevices.map((device) => projectAppDeviceSummary(device, hardwareReports.get(device.device_id))),
          bindings,
        });
        return;
      }
      const body = await readJsonBody(req);
      const actionContext = readUserActionContext(req, "project.settings.save");
      sendJson(res, 200, await projectServerJson(servicePath, {
        method: "PUT",
        ...(actionContext ? { headers: actionContext.headers } : {}),
        body: {
          account_id: accountId,
          manifest_version: body.manifest_version,
          expected_revision: body.expected_revision,
          values: body.values,
        },
      }));
    });
  }
  registerProjectPattern("PUT", /^\/api\/platform\/projects\/([^/]+)\/project-app\/devices$/, async ({ req, res, match, session }) => {
    const project = await requireSessionProject(session, decodeURIComponent(match[1]));
    const accountId = projectServerUserId(session);
    const body = await readJsonBody(req);
    const requestedIds = Array.isArray(body.device_ids) ? body.device_ids.map((item) => String(item || "").trim()) : null;
    if (!requestedIds || requestedIds.length > 16 || new Set(requestedIds).size !== requestedIds.length) {
      sendJson(res, 400, { error: "invalid_project_app_devices", message: "Waehle hoechstens 16 eindeutige Geraete aus." });
      return;
    }
    const [accountDevices, processorBoards] = await Promise.all([
      dependencies.loadUserIdeDevices(session).catch(() => []),
      dependencies.loadProcessorBoards?.(),
    ]);
    const ownedDevicesById = new Map(accountDevices.map((device) => [device.device_id, device]));
    if (requestedIds.some((deviceId) => !ownedDevicesById.has(deviceId))) {
      sendJson(res, 403, { error: "project_app_device_not_owned", message: "Mindestens ein ausgewaehltes Geraet gehoert nicht zu diesem Account." });
      return;
    }
    const snapshot = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/project-app?${new URLSearchParams({ account_id: accountId })}`);
    const reports = new Map(accountDevices.map((device) => [
      device.device_id,
      projectAppDeviceCompatibility({ project, manifest: snapshot.manifest, device, processorBoards }),
    ]));
    const incompatibleIds = requestedIds.filter((deviceId) => !reports.get(deviceId)?.compatible);
    if (incompatibleIds.length) {
      const missingRequirements = [...new Set(incompatibleIds.flatMap((deviceId) => reports.get(deviceId)?.missing_requirements || []))];
      sendJson(res, 409, {
        error: "project_app_device_incompatible",
        message: `Die ausgewaehlte Hardware erfuellt die Mindestanforderungen dieser Anwendung nicht: ${missingRequirements.join(", ")}.`,
        missing_requirements: missingRequirements,
      });
      return;
    }
    const saved = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/project-app/devices`, {
      method: "PUT",
      body: { account_id: accountId, device_ids: requestedIds },
    });
    sendJson(res, 200, {
      ...saved,
      assigned_devices: requestedIds.map((deviceId) => projectAppDeviceSummary(ownedDevicesById.get(deviceId), reports.get(deviceId))),
      available_devices: accountDevices.map((device) => projectAppDeviceSummary(device, reports.get(device.device_id))),
    });
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
    path: "/api/platform/development-assistant/code-proposals/apply",
    handler: ({ req, res }) => withSession(req, res, async (session) => {
      if (requireEntitlement(res, session, "ai_assistant")) await developmentAssistant.handleApplyCodeProposal(req, res, session);
    }),
  });
  registry.register({
    method: "POST",
    path: "/api/platform/help-assistant/chat",
    handler: ({ req, res }) => withSession(req, res, (session) => helpAssistant.handleChat(req, res, session)),
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

async function resolveProjectAppBindings({ manifest, project, session, accountDevices, assignedDeviceIds, loadUserIdeDevices, loadAiUsageSummary, loadProjectTelemetry }) {
  const bindings = Array.isArray(manifest?.bindings) ? manifest.bindings : [];
  const needsDevice = bindings.some((binding) => binding.type === "device_status");
  const needsAiUsage = bindings.some((binding) => binding.type === "ai_usage");
  const telemetryBindings = bindings.filter((binding) => binding.type === "telemetry");
  const [devices, aiUsage, telemetryValues] = await Promise.all([
    Array.isArray(accountDevices) ? accountDevices : needsDevice && loadUserIdeDevices ? loadUserIdeDevices(session).catch(() => []) : [],
    needsAiUsage && loadAiUsageSummary ? loadAiUsageSummary(session).catch(() => null) : null,
    resolveTelemetryBindings(telemetryBindings, loadProjectTelemetry),
  ]);
  const primaryDeviceId = assignedDeviceIds?.[0] || project.linked_device_ids?.[0] || project.linked_device_id;
  const device = devices.find((item) => item.device_id === primaryDeviceId) || null;
  const accountUsage = aiUsage?.available === false ? null : aiUsage?.account_usage || null;
  const result = {};
  for (const binding of bindings) {
    if (binding.type === "setting") continue;
    if (binding.type === "telemetry" && telemetryValues.has(binding.id)) result[binding.id] = telemetryValues.get(binding.id);
    if (binding.type === "device_status") result[binding.id] = projectAppDeviceValue(device, binding.field);
    if (binding.type === "ai_usage") result[binding.id] = projectAppAiUsageValue(accountUsage, binding.field);
    if (binding.type === "project") result[binding.id] = projectAppProjectValue(project, binding.field);
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
}

function projectAppDeviceSummary(device = {}, compatibility = { compatible: true, missing_requirements: [] }) {
  return {
    device_id: String(device.device_id || ""),
    display_name: String(device.display_name || device.device_id || "Geraet"),
    hardware_profile_id: String(device.hardware_profile_id || ""),
    connectivity_status: String(device.connectivity_status || "unknown"),
    firmware_version: String(device.firmware_version || ""),
    last_seen_at: String(device.last_seen_at || ""),
    battery_percent: Number.isFinite(Number(device.battery_percent)) ? Number(device.battery_percent) : null,
    compatible: compatibility.compatible !== false,
    missing_requirements: compatibility.missing_requirements || [],
  };
}

function projectAppDeviceCompatibility({ project = {}, manifest = {}, device = {}, processorBoards = [] } = {}) {
  const targetProfile = String(project.hardware_profile_id || "");
  const deviceProfile = String(device.hardware_profile_id || "");
  const requirements = manifest.hardware_requirements;
  if (!requirements) {
    const compatible = !targetProfile || !deviceProfile || targetProfile === deviceProfile;
    return { compatible, missing_requirements: compatible ? [] : ["passendes Boardprofil"] };
  }
  const board = processorBoards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
    .filter(Boolean).some((id) => String(id) === deviceProfile));
  const missing = [];
  const supportedProfiles = requirements.supported_hardware_profile_ids || [];
  if (supportedProfiles.length && !supportedProfiles.includes(deviceProfile)) missing.push("unterstuetztes Nexi-Boardprofil");
  if (!board) missing.push("verifizierbares Hardwareprofil");
  if (requirements.processor_variant && normalizeHardwareValue(board?.mcu_variant) !== normalizeHardwareValue(requirements.processor_variant)) {
    missing.push(requirements.processor_variant);
  }
  const boardFeatures = {
    ...(board?.default_instance_configuration?.board_features || {}),
    ...(device.instance_configuration?.board_features || {}),
  };
  const capabilities = new Set([...(board?.capability_ids || []), ...(device.technical_capability_ids || [])]
    .map(canonicalCapabilityId));
  for (const requirement of requirements.features || []) {
    const feature = boardFeatures[requirement.board_feature] || {};
    const featureCount = Number(feature.count ?? feature.channels ?? 0);
    const satisfied = capabilities.has(canonicalCapabilityId(requirement.capability_id))
      && feature.enabled !== false
      && (!requirement.require_included || feature.included === true)
      && (!requirement.require_driver || Boolean(String(feature.driver || "").trim()))
      && (!requirement.min_count || featureCount >= requirement.min_count);
    if (!satisfied) missing.push(requirement.label);
  }
  return { compatible: missing.length === 0, missing_requirements: [...new Set(missing)] };
}

function canonicalCapabilityId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.startsWith("capability.") ? normalized : `capability.${normalized}`;
}

function normalizeHardwareValue(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveTelemetryBindings(bindings, loadProjectTelemetry) {
  const values = new Map();
  if (!loadProjectTelemetry) return values;
  await Promise.all(bindings.map(async (binding) => {
    try {
      const response = await loadProjectTelemetry(binding);
      const items = Array.isArray(response?.items) ? response.items : [];
      values.set(binding.id, items.slice(0, 24).reverse().map((item) => ({
        value: item.value,
        unit: item.unit || "",
        measured_at: item.measured_at,
      })));
    } catch {
      // A missing telemetry dependency leaves only this binding unavailable.
    }
  }));
  return values;
}

async function loadProjectAppTelemetry({ binding, project, accountId, telemetryJson }) {
  if (!telemetryJson) return null;
  const query = new URLSearchParams({ metric: binding.metric_id, limit: "24" });
  if (binding.device_scope === "assigned_device") {
    if (!project.linked_device_id) return { items: [] };
    query.set("device_id", project.linked_device_id);
  }
  const projectId = project.project_server_id || project.project_id;
  const path = `/api/telemetry/internal/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(projectId)}/measurements?${query}`;
  return telemetryJson(path);
}

function projectAppDeviceValue(device, field) {
  if (!device) return undefined;
  return {
    connection_state: device.connectivity_status,
    last_seen_at: device.last_seen_at,
    firmware_version: device.firmware_version,
    battery_percent: device.battery_percent,
  }[field];
}

function projectAppAiUsageValue(accountUsage, field) {
  if (!accountUsage) return undefined;
  return {
    daily_requests: accountUsage.daily_requests,
    monthly_requests: accountUsage.monthly_requests,
    daily_cost: accountUsage.daily_cost,
    monthly_cost: accountUsage.monthly_cost,
    remaining_budget: accountUsage.available_credits,
  }[field];
}

function projectAppProjectValue(project, field) {
  return {
    title: project.title,
    status: project.status,
    updated_at: project.updated_at,
  }[field];
}

module.exports = { registerProjectRoutes, resolveProjectAppBindings, loadProjectAppTelemetry, projectAppDeviceCompatibility };
