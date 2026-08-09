"use strict";

function createPlatformService({ loadUserIdeProjects, loadUserIdeDevices, loadProjectBuilds, sendJson, createAccountSummary, loadHardwareShopSummary, loadAiUsageSummary, loadUserIdeProjectSummaries, recordSystemEvent, projectServerUserId, deviceManagementBaseUrl, learningProgress, getWorkspaceState, developmentAssistant, developmentProjectTemplateCatalog, hasEntitlements, developmentProjectTemplatePreviews, toPlatformProjectSummary, loadBillingSummary, accountSubscription, auth, unreadKnowledgeChapterReleases, knowledgeChapterHistory, findKnowledgeChapterRelease, canReadKnowledgeChapter, communityJson }) {
async function handleUserIdeSummary(res, session) {
  const projects = await loadUserIdeProjects(session);
  const devices = await loadUserIdeDevices(session);
  const builds = await loadProjectBuilds(projects, session);
  sendJson(res, 200, {
    account: await createAccountSummary(session),
    projects,
    devices,
    builds,
    hardware_shop: await loadHardwareShopSummary(session),
    ai_usage: await loadAiUsageSummary(session),
  });
}

const platformSummarySections = new Set(["projects", "devices", "builds", "ai", "community", "account", "knowledge", "billing", "subscription", "progress", "development"]);
const platformBootstrapSections = new Set(["projects", "development"]);

function requestedPlatformSummarySections(value) {
  if (value === null || value === undefined || value === "") return new Set(platformSummarySections);
  return new Set(String(value).split(",").map((item) => item.trim()).filter((item) => platformSummarySections.has(item)));
}

function requestedPlatformBootstrapSections(value) {
  if (value === null || value === undefined || value === "") return new Set(platformBootstrapSections);
  return new Set(String(value).split(",").map((item) => item.trim()).filter((item) => platformBootstrapSections.has(item)));
}

async function handlePlatformSummary(res, session, requestedSections = null) {
  const sections = requestedPlatformSummarySections(requestedSections);
  const serviceStatus = {};
  const needsFullProjects = sections.has("builds");
  const needsProjectSummaries = sections.has("projects") || sections.has("progress");
  const projectsPromise = needsFullProjects
    ? loadUserIdeProjects(session)
    : needsProjectSummaries ? loadUserIdeProjectSummaries(session) : Promise.resolve([]);
  const trackedProjectsPromise = projectsPromise.then((items) => {
    serviceStatus.project_server = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.project_server = { ok: false, error: error.message || String(error) };
    return [];
  });
  const devicesPromise = sections.has("devices") ? loadUserIdeDevices(session).then((items) => {
    serviceStatus.device_management = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.device_management = { ok: false, error: error.message || String(error) };
    recordSystemEvent({
      severity: "error",
      source_service: "identity_server",
      target_service: "device_management",
      category: "dependency",
      event_type: "dependency_unreachable",
      message: "Device Management Server ist fuer Identity nicht erreichbar.",
      impact: "Device-Inventarisierung und Recovery koennen keine Account-Devices laden oder speichern.",
      account_id: projectServerUserId(session),
      route: "/app/device-management/inventory/",
      details: {
        dependency_base_url: deviceManagementBaseUrl,
        operation: "loadUserIdeDevices",
        error: error.message || String(error),
      },
    });
    return [];
  }) : Promise.resolve([]);
  const needsAiUsage = sections.has("ai") || sections.has("billing");
  const aiUsagePromise = needsAiUsage ? loadAiUsageSummary(session).then((summary) => {
    serviceStatus.ai_usage = { ok: summary.available !== false };
    return summary;
  }).catch((error) => {
    serviceStatus.ai_usage = { ok: false, error: error.message || String(error) };
    return null;
  }) : Promise.resolve(null);
  const communitySummaryPromise = sections.has("community") ? loadCommunityDashboardSummary(session).then((summary) => {
    serviceStatus.community = { ok: true };
    return summary;
  }).catch((error) => {
    serviceStatus.community = { ok: false, error: error.message || String(error) };
    return {
      available: false,
      total: 0,
      public: { open: 0, closed: 0 },
      private: { open: 0, closed: 0 },
      messages: { unread: 0, threads: 0 },
    };
  }) : Promise.resolve(null);
  const knowledgeStatePromise = sections.has("knowledge") ? loadKnowledgeState(session) : Promise.resolve(null);
  const projects = await trackedProjectsPromise;
  const buildsPromise = sections.has("builds") ? loadProjectBuilds(projects, session).then((items) => {
    serviceStatus.builds = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.builds = { ok: false, error: error.message || String(error) };
    return [];
  }) : Promise.resolve([]);
  const progressPromise = sections.has("progress") ? learningProgress.list(projectServerUserId(session), projects) : Promise.resolve([]);
  const [devices, builds, aiUsage, communitySummary, knowledgeState, learningProgressItems] = await Promise.all([
    devicesPromise,
    buildsPromise,
    aiUsagePromise,
    communitySummaryPromise,
    knowledgeStatePromise,
    progressPromise,
  ]);
  const userId = projectServerUserId(session);
  const payload = {
    routes: {
      auth: "/app/auth/",
      dashboard: "/app/dashboard/",
      learn: "/app/learn/",
      ide: "/app/ide/",
      projects: "/app/projects/",
      development_platform: "/app/development-platform/",
      devices: "/app/device-management/inventory/",
      billing: "/app/billing/",
    },
    workspace_state: getWorkspaceState(userId),
    service_status: serviceStatus,
  };
  if (sections.has("development")) {
    payload.development_assistant = developmentAssistant.config();
    payload.development_project_templates = developmentProjectTemplateCatalog().map((template) => ({
      ...template,
      available: hasEntitlements(session, template.required_entitlements),
    }));
    payload.development_project_template_previews = developmentProjectTemplatePreviews();
  }
  if (sections.has("account")) payload.account = await createAccountSummary(session, aiUsage, { includeAiCredits: needsAiUsage });
  if (sections.has("projects")) payload.projects = projects.map(toPlatformProjectSummary);
  if (sections.has("progress")) payload.learning_progress = learningProgressItems;
  if (sections.has("devices")) payload.devices = devices;
  if (sections.has("builds")) payload.builds = builds;
  if (sections.has("community")) payload.community_summary = communitySummary;
  if (sections.has("knowledge")) {
    payload.knowledge_updates = knowledgeState.updates;
    payload.knowledge_history = knowledgeState.history;
  }
  if (sections.has("billing")) payload.billing = await loadBillingSummary(session, aiUsage);
  else if (sections.has("subscription")) {
    const subscription = accountSubscription(session);
    payload.billing = { plan: subscription.plan, entitlements: subscription.entitlements };
  }
  if (sections.has("ai")) payload.ai_usage = aiUsage;
  sendJson(res, 200, payload);
}

async function handlePlatformBootstrap(res, session, requestedSections = null) {
  const startedAt = Date.now();
  const sections = requestedPlatformBootstrapSections(requestedSections);
  const projects = sections.has("projects") ? await loadUserIdeProjectSummaries(session) : [];
  const userId = projectServerUserId(session);
  const subscription = accountSubscription(session);
  const payload = {
    account: {
      username: session.account.username || "",
      user_id: userId,
      plan: subscription.plan,
      capabilities: ["ide_flash_usb", "ide_flash_ota", "cloud_flash"],
    },
    workspace_state: getWorkspaceState(userId),
    billing: {
      plan: subscription.plan,
      entitlements: subscription.entitlements,
      ai_credits: { monthly_available_credits: 0, purchased_available_credits: 0, consumed_credits: 0 },
      ai_credit_packages: [],
    },
    bootstrap_duration_ms: Date.now() - startedAt,
  };
  if (sections.has("projects")) payload.projects = projects.map(toPlatformProjectSummary);
  if (sections.has("development")) {
    payload.development_assistant = developmentAssistant.config();
    payload.development_project_templates = developmentProjectTemplateCatalog().map((template) => ({
      ...template,
      available: hasEntitlements(session, template.required_entitlements),
    }));
    payload.development_project_template_previews = developmentProjectTemplatePreviews();
  }
  sendJson(res, 200, payload);
}

async function loadKnowledgeState(session) {
  const accountId = projectServerUserId(session);
  const reads = await auth().list_knowledge_chapter_reads(accountId);
  const entitlements = accountSubscription(session).entitlements;
  return {
    updates: unreadKnowledgeChapterReleases(reads, entitlements),
    history: knowledgeChapterHistory(reads, entitlements),
  };
}

async function handleKnowledgeChapterRead(res, session, chapterId) {
  const release = findKnowledgeChapterRelease(chapterId);
  if (!release) {
    sendJson(res, 404, { error: "knowledge_chapter_not_found" });
    return;
  }
  if (!canReadKnowledgeChapter(release, accountSubscription(session).entitlements)) {
    sendJson(res, 403, {
      error: "knowledge_chapter_access_required",
      required_entitlements: release.required_entitlements,
    });
    return;
  }
  const read = await auth().mark_knowledge_chapter_read(
    projectServerUserId(session),
    release.chapter_id,
    release.version,
  );
  sendJson(res, 200, { read });
}

async function loadCommunityDashboardSummary(session) {
  const headers = {
    "X-GerNetiX-Community-Actor": session.account.user_id,
    "X-GerNetiX-Community-Operator": "false",
  };
  return communityJson("/api/community/dashboard-summary", { headers });
}


  return { handleUserIdeSummary, handlePlatformSummary, handlePlatformBootstrap, handleKnowledgeChapterRead };
}

module.exports = { createPlatformService };
