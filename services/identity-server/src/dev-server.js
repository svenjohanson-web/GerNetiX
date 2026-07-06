const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createDefaultIdentityModule, MockEmailService } = require("./index");

const publicDir = path.join(__dirname, "..", "public");
const projectExperienceDir = path.join(publicDir, "projects");
const tamagotchiDemoDir = path.join(publicDir, "demo-tamagotchi");
const guidedCodeLessonDir = path.join(__dirname, "..", "..", "..", "tools", "guided-code-lesson");
const port = Number(process.env.PORT || 4300);
const host = process.env.HOST || "127.0.0.1";
const demoUsername = process.env.DEMO_USER || "demo";
const demoEmail = process.env.DEMO_EMAIL || "demo@gernetix.local";
const demoPassword = process.env.DEMO_PASSWORD || "demo-passwort";
const projectServerBaseUrl = process.env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800";
const buildDeployBaseUrl = process.env.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400";
const hardwareShopBaseUrl = process.env.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900";
const deviceManagementBaseUrl = process.env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700";
const aiUsageBaseUrl = process.env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000";
const builtInDemoAccounts = [
  { username: demoUsername, email: demoEmail, password: demoPassword },
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".puml": "text/plain; charset=utf-8",
};

const emailService = new MockEmailService({ log() {} });
const auth = createDefaultIdentityModule({
  emailService,
  appBaseUrl: `http://${host}:${port}`,
});
const sessions = new Map();
const userIdeState = createUserIdeState();

async function bootstrap() {
  await seedDemoAccount();

  const server = http.createServer((req, res) => {
    routeRequest(req, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: "internal_server_error" });
    });
  });

  server.listen(port, host, () => {
  console.log(`Identity login UI: http://${host}:${port}`);
  console.log(`Project lesson UI: http://${host}:${port}/projects/`);
  console.log(`Tamagotchi demo: http://${host}:${port}/demo/tamagotchi/`);
  console.log(`Project Server adapter: ${projectServerBaseUrl}`);
  console.log(`Build & Deploy adapter: ${buildDeployBaseUrl}`);
  console.log(`Hardware Shop adapter: ${hardwareShopBaseUrl}`);
  console.log(`Device Management adapter: ${deviceManagementBaseUrl}`);
  console.log(`AI Usage adapter: ${aiUsageBaseUrl}`);
  console.log(`Demo login: ${demoUsername} / ${demoPassword}`);
  });
}

async function seedDemoAccount() {
  for (const account of builtInDemoAccounts) {
    try {
      const beforeCount = emailService.sentMessages.length;
      await auth.register_local(account.username, account.email, account.password, true);
      const verification = emailService.sentMessages
        .slice(beforeCount)
        .find((message) => message.type === "verification");
      const token = verification ? new URL(verification.link).searchParams.get("token") : "";
      if (token) {
        await auth.verify_email(token);
      }
    } catch (error) {
      if (!["username_already_exists", "email_already_exists"].includes(error.code)) {
        throw error;
      }
    }
  }
}

async function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "identity-server" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    await handleLogin(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    await handleLogout(req, res);
    return;
  }

  if (url.pathname === "/api/session") {
    handleSession(req, res);
    return;
  }

  if (["/api/account/me/transparency", "/account/me/transparency"].includes(url.pathname)) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    if (!["GET", "POST"].includes(req.method)) {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    sendJson(res, 200, await createAccountTransparency(session, { refresh: req.method === "POST" }));
    return;
  }

  if (["/api/account/me/transparency/refresh", "/account/me/transparency/refresh"].includes(url.pathname)) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    sendJson(res, 200, await createAccountTransparency(session, { refresh: true }));
    return;
  }

  if (url.pathname === "/api/user-ide/summary") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleUserIdeSummary(res, session);
    return;
  }

  if (url.pathname === "/api/user-ide/projects") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, { items: await loadUserIdeProjects(session) });
    return;
  }

  if (url.pathname === "/api/user-ide/devices") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, { items: await loadUserIdeDevices(session) });
    return;
  }

  if (url.pathname === "/api/user-ide/hardware-shop") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, await loadHardwareShopSummary(session));
    return;
  }

  if (url.pathname === "/api/user-ide/ai-usage") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, await loadAiUsageSummary(session));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/user-ide/ai-demo") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleAiDemo(req, res, session);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/user-ide/hardware-shop/orders") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleHardwareShopOrder(req, res, session);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/user-ide/build-jobs") {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleUserIdeBuildJob(req, res);
    return;
  }

  if (url.pathname === "/demo" || url.pathname === "/demo/") {
    redirect(res, "/projects/");
    return;
  }

  if (url.pathname === "/projects" || url.pathname === "/projects/") {
    if (!readSession(req)) {
      redirect(res, "/login.html?next=/projects/");
      return;
    }
    serveStatic(res, projectExperienceDir, "/index.html");
    return;
  }

  if (url.pathname.startsWith("/projects/")) {
    if (!readSession(req)) {
      redirect(res, `/login.html?next=${encodeURIComponent(url.pathname + url.search)}`);
      return;
    }
    serveStatic(res, projectExperienceDir, normalizeProjectsPath(url.pathname));
    return;
  }

  if (url.pathname === "/dev/projects" || url.pathname === "/dev/projects/") {
    if (!readSession(req)) {
      redirect(res, "/login.html?next=/dev/projects/");
      return;
    }
    serveStatic(res, guidedCodeLessonDir, "/index.html");
    return;
  }

  if (url.pathname.startsWith("/dev/projects/")) {
    if (!readSession(req)) {
      redirect(res, `/login.html?next=${encodeURIComponent(url.pathname + url.search)}`);
      return;
    }
    serveStatic(res, guidedCodeLessonDir, normalizeDevProjectsPath(url.pathname));
    return;
  }

  if (url.pathname.startsWith("/demo/tamagotchi")) {
    if (!readSession(req)) {
      redirect(res, "/login.html?next=/demo/tamagotchi/");
      return;
    }
    serveStatic(res, tamagotchiDemoDir, normalizeDemoPath(url.pathname));
    return;
  }

  const requestPath = url.pathname === "/" ? "/login.html" : url.pathname;
  serveStatic(res, publicDir, requestPath);
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  try {
    const credentials = resolveDemoCredentials(body.identifier, body.password);
    const login = await auth.login_local(credentials.identifier, credentials.password);
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, {
      account: login.account,
      next: sanitizeNextPath(body.next) || "/projects/",
    });
  } catch (error) {
    sendJson(res, error.status || 401, {
      error: error.code || "invalid_login",
      message: "Login fehlgeschlagen.",
    });
  }
}

function resolveDemoCredentials(identifier, password) {
  if (identifier === "test" && password === "test") {
    return { identifier: demoUsername, password: demoPassword };
  }

  return { identifier, password };
}

async function handleLogout(req, res) {
  const token = readSessionToken(req);
  if (token) {
    sessions.delete(token);
    await auth.logout(token);
  }
  clearSessionCookie(res);
  sendJson(res, 200, { logged_out: true });
}

function handleSession(req, res) {
  const session = readSession(req);
  if (!session) {
    sendJson(res, 401, { authenticated: false });
    return;
  }

  sendJson(res, 200, {
    authenticated: true,
    account: session.account,
    expires_at: session.expiresAt,
  });
}

async function createAccountTransparency(session, options = {}) {
  const accountId = projectServerUserId(session);
  const generatedAt = new Date().toISOString();
  const [
    projects,
    feedback,
    devices,
    purchaseContexts,
    auditEvents,
    credits,
    usageEvents,
    hardwareOffers,
  ] = await Promise.all([
    transparencySection("project-server.projects", () => projectServerJson(`/api/projects?user_id=${encodeURIComponent(accountId)}`)),
    transparencySection("project-server.feedback", () => projectServerJson(`/api/learning-feedback?user_id=${encodeURIComponent(accountId)}`)),
    transparencySection("device-management.devices", () => deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`)),
    transparencySection("device-management.purchase-contexts", () => deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/purchase-contexts`)),
    transparencySection("device-management.audit-events", () => deviceManagementJson(`/api/device-management/customer-data-access/audit-events?accountId=${encodeURIComponent(accountId)}`)),
    transparencySection("ai-usage.credits", () => aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`)),
    transparencySection("ai-usage.events", () => aiUsageJson(`/api/ai-usage/events?account_id=${encodeURIComponent(accountId)}`)),
    transparencySection("hardware-shop.offers", () => hardwareShopJson("/api/hardware-shop/offers")),
  ]);
  const ownDevices = sectionItems(devices).map(sanitizeDevice);

  return {
    generated_at: generatedAt,
    refresh_requested: Boolean(options.refresh),
    identity: {
      user_id: accountId,
      username: session.account.username || demoUsername,
      account_status: "active",
      sources: [sourceRef("identity-server.session", "authenticated_session")],
    },
    contact_data: {
      email: session.account.email || demoEmail,
      email_verified: Boolean(session.account.email_verified ?? true),
      sources: [sourceRef("identity-server.session", "own_account_contact_data")],
    },
    login_providers: [{
      provider: "local_password",
      status: "active",
      exposed_fields: ["provider", "status"],
      redacted_fields: ["password_hash", "reset_tokens", "session_tokens"],
      source: sourceRef("identity-server.auth", "credential_material_is_never_exposed"),
    }],
    plans_subscriptions_and_purchases: {
      plan: "Premium Demo",
      subscriptions: [],
      purchase_contexts: sectionItems(purchaseContexts).map(sanitizePurchaseContext),
      sources: [sourceRef("identity-server.demo-plan", "demo_plan_assignment"), sourceStatus(purchaseContexts)],
    },
    product_offerings: {
      hardware_offers: sectionItems(hardwareOffers).map((offer) => ({
        offer_id: offer.offer_id,
        title: offer.title,
        hardware_profile_id: offer.hardware_profile_id,
        capability_ids: offer.capability_ids || [],
      })),
      sources: [sourceStatus(hardwareOffers)],
    },
    grants_overrides_and_capabilities: {
      grants: [
        grant("ide_flash_usb", "Premium Demo", "User IDE darf USB-Builds vorbereiten."),
        grant("ide_flash_ota", "Premium Demo", "User IDE darf OTA-faehige Zielgeraete verwenden."),
        grant("cloud_flash", "Device Ownership", "Cloud Flash ist nur fuer eigene Devices vorgesehen."),
        grant("system_capability.ai_assistant", "AI Usage Credits", "KI-Aufrufe werden per Preflight gegen Credits geprueft."),
      ],
      overrides: [],
      sources: [sourceRef("identity-server.capability-map", "derived_from_demo_plan_and_user_ownership")],
    },
    devices_and_support: {
      devices: ownDevices,
      purchase_contexts: sectionItems(purchaseContexts).map(sanitizePurchaseContext),
      sources: [sourceStatus(devices), sourceStatus(purchaseContexts)],
    },
    learning_profile: {
      projects: sectionItems(projects).map(sanitizeProject),
      sources: [sourceStatus(projects)],
    },
    feedback: {
      items: sectionItems(feedback).map(sanitizeFeedback),
      sources: [sourceStatus(feedback)],
    },
    ai_credits_and_usage: {
      credits: stripProviderCosts(credits.payload || {}),
      events: sectionItems(usageEvents).map(stripProviderCosts),
      sources: [sourceStatus(credits), sourceStatus(usageEvents)],
    },
    consents_and_customer_data_access: {
      audit_events: sectionItems(auditEvents).map(stripProviderCosts),
      note: "Consent-Details werden nur ueber eigene Consent-IDs abgerufen; Secrets und interne Kosten bleiben redigiert.",
      sources: [sourceStatus(auditEvents)],
    },
    sources_and_last_updated: [
      sourceStatus(projects),
      sourceStatus(feedback),
      sourceStatus(devices),
      sourceStatus(purchaseContexts),
      sourceStatus(auditEvents),
      sourceStatus(credits),
      sourceStatus(usageEvents),
      sourceStatus(hardwareOffers),
    ],
  };
}

async function transparencySection(source, loader) {
  try {
    return { source, available: true, refreshed_at: new Date().toISOString(), payload: await loader() };
  } catch (error) {
    return {
      source,
      available: false,
      refreshed_at: new Date().toISOString(),
      error: error.status ? `${error.status}:${error.message}` : error.message,
      payload: { items: [] },
    };
  }
}

function sectionItems(section) {
  if (!section || !section.payload) return [];
  if (Array.isArray(section.payload.items)) return section.payload.items;
  if (Array.isArray(section.payload)) return section.payload;
  return [];
}

function sourceStatus(section) {
  return {
    source: section.source,
    available: section.available,
    refreshed_at: section.refreshed_at,
    reason: section.available ? "own_data_query" : section.error,
  };
}

function sourceRef(source, reason) {
  return { source, available: true, refreshed_at: new Date().toISOString(), reason };
}

function grant(capability_id, source, reason) {
  return { capability_id, source, reason };
}

function sanitizeDevice(device) {
  return {
    account_device_id: device.account_device_id,
    device_id: device.device_id,
    display_name: device.display_name,
    hardware_profile_id: device.hardware_profile_id,
    technical_capability_ids: device.technical_capability_ids || [],
    authenticity_status: device.authenticity_status,
    connectivity_status: device.connectivity_status,
    ota_status: device.ota_status,
    ownership_status: device.ownership_status,
    purchase_context_id: device.purchase_context_id || "",
  };
}

function sanitizePurchaseContext(context) {
  return {
    purchase_context_id: context.purchase_context_id,
    order_id: context.order_id,
    account_id: context.account_id,
    source: context.source,
    support_level: context.support_level,
    hardware_profile_id: context.hardware_profile_id,
    valid_from: context.valid_from,
    valid_until: context.valid_until,
  };
}

function sanitizeProject(project) {
  return {
    project_id: project.project_id,
    user_id: project.user_id,
    title: project.title,
    description: project.description,
    learning_project_id: project.learning_project_id,
    hardware_profile_id: project.hardware_profile_id,
    device_id: project.device_id,
    status: project.status,
    source_count: project.source_count,
    build_count: project.build_count,
    updated_at: project.updated_at,
  };
}

function sanitizeFeedback(feedback) {
  return {
    feedback_id: feedback.feedback_id,
    user_id: feedback.user_id,
    project_id: feedback.project_id,
    rating: feedback.rating,
    comment: feedback.comment,
    has_contact_consent: Boolean(feedback.has_contact_consent),
    created_at: feedback.created_at,
  };
}

function stripProviderCosts(value) {
  if (Array.isArray(value)) return value.map(stripProviderCosts);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "estimated_provider_cost" && key !== "provider_cost")
      .map(([key, entry]) => [key, stripProviderCosts(entry)]),
  );
}

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

async function handleUserIdeBuildJob(req, res) {
  const body = await readJsonBody(req);
  const session = readSession(req);
  const projects = await loadUserIdeProjects(session);
  const devices = await loadUserIdeDevices(session);
  const project = projects.find((item) => item.slug === body.project_slug);
  const device = devices.find((item) => item.device_id === body.device_id);

  if (!project) {
    sendJson(res, 404, { error: "project_not_found", message: "Projekt wurde nicht gefunden." });
    return;
  }
  if (!device) {
    sendJson(res, 404, { error: "device_not_found", message: "Device wurde nicht gefunden." });
    return;
  }
  if (body.mode === "build_and_flash" && device.ota_status !== "ready") {
    sendJson(res, 409, { error: "device_not_ota_ready", message: "Das ausgewaehlte Device ist nicht OTA-ready." });
    return;
  }

  const projectServerJob = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`, {
    method: "POST",
    body: {
      mode: body.mode || "build",
      device_id: device.device_id,
    },
  });
  const buildPackage = await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/build-package`);
  const buildDeployJob = await buildDeployJson("/api/build-jobs", {
    method: "POST",
    body: {
      job_id: projectServerJob.build_job_id,
      mode: body.mode || "build",
      device_id: device.device_id,
      build_package: toBuildDeployPackage(buildPackage),
      deploy: body.mode === "build_and_flash" ? {
        requested: true,
        authorized: true,
        device_id: device.device_id,
      } : null,
    },
  });
  await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/submitted`, {
    method: "POST",
    body: {
      build_deploy_job_id: buildDeployJob.job_id,
    },
  });
  const completedBuildDeployJob = await waitForBuildDeployJob(buildDeployJob.job_id);
  if (completedBuildDeployJob && ["succeeded", "failed"].includes(completedBuildDeployJob.status)) {
    await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/result`, {
      method: "POST",
      body: toProjectBuildResult(completedBuildDeployJob),
    });
  }

  const build = {
    build_job_id: projectServerJob.build_job_id,
    project_server_id: project.project_server_id,
    project_slug: project.slug,
    project_title: project.title,
    device_id: device.device_id,
    device_label: device.display_name,
    mode: body.mode || "build",
    status: completedBuildDeployJob ? completedBuildDeployJob.status : "submitted_to_build_deploy",
    created_at: projectServerJob.created_at,
    build_package_contract: `${buildPackage.files.length} Dateien: platformio.ini + Projektquellen`,
    artifact_url: completedBuildDeployJob?.result?.build?.artifacts?.["firmware.bin"]?.download_url || "",
  };
  userIdeState.builds.unshift(build);
  sendJson(res, 202, build);
}

async function loadUserIdeProjects(session) {
  await ensureProjectServerDemoProjects(session);
  const userId = projectServerUserId(session);
  const response = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}`);
  const projectsById = new Map(response.items.map((item) => [item.project_id, item]));
  return userIdeState.projectDefinitions.map((definition) => {
    const project = projectsById.get(definition.project_server_id);
    return {
      ...definition,
      title: project ? project.title : definition.title,
      summary: project ? project.description : definition.summary,
      hardware_profile_id: project ? project.hardware_profile_id : definition.hardware_profile_id,
      status: project ? project.status : "project_server_missing",
      last_build_status: latestBuildStatus(project),
      source_count: project ? project.source_count : 0,
      build_count: project ? project.build_count : 0,
    };
  });
}

async function ensureProjectServerDemoProjects(session) {
  if (userIdeState.projectServerSeeded) return;
  const userId = projectServerUserId(session);
  for (const definition of userIdeState.projectDefinitions) {
    await projectServerJson("/api/projects", {
      method: "POST",
      body: {
        project_id: definition.project_server_id,
        user_id: userId,
        title: definition.title,
        description: definition.summary,
        learning_project_id: definition.learning_project_id,
        hardware_profile_id: definition.hardware_profile_id,
        device_id: definition.default_device_id,
        sources: [{
          path: "src/main.cpp",
          content: demoProjectSource(definition),
        }],
      },
    }).catch((error) => {
      if (error.status !== 400) throw error;
    });
  }
  userIdeState.projectServerSeeded = true;
}

async function loadProjectBuilds(projects, session) {
  const devices = await loadUserIdeDevices(session);
  const result = [];
  for (const project of projects) {
    const response = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`);
    for (const job of response.items) {
      const device = devices.find((item) => item.device_id === job.device_id);
      result.push({
        build_job_id: job.build_job_id,
        project_server_id: job.project_id,
        project_slug: project.slug,
        project_title: project.title,
        device_id: job.device_id,
        device_label: device ? device.display_name : job.device_id || "kein Device",
        mode: job.mode,
        status: job.status,
        created_at: job.created_at,
        build_package_contract: "Project Server BuildPackage",
      });
    }
  }
  return result.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

async function loadHardwareShopSummary(session) {
  const devices = await loadUserIdeDevices(session);
  const offers = await hardwareShopJson("/api/hardware-shop/offers");
  const projects = userIdeState.projectDefinitions;
  const recommendations = [];
  for (const project of projects) {
    const match = await hardwareShopJson("/api/hardware-shop/match", {
      method: "POST",
      body: {
        required_capability_ids: project.required_capability_ids,
        owned_capability_ids: ownedCapabilityIds(devices),
      },
    });
    recommendations.push({
      project_slug: project.slug,
      project_title: project.title,
      required_capability_ids: project.required_capability_ids,
      matches: match.items.slice(0, 3),
    });
  }
  return {
    base_url: hardwareShopBaseUrl,
    account_id: projectServerUserId(session),
    offers: offers.items,
    recommendations,
  };
}

async function loadUserIdeDevices(session) {
  await ensureDeviceManagementDemoDevices(session);
  const accountId = projectServerUserId(session);
  const response = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`);
  return (response.items || []).map((device) => ({
    device_id: device.device_id,
    account_device_id: device.account_device_id,
    display_name: device.display_name,
    hardware_profile_id: device.hardware_profile_id,
    technical_capability_ids: device.technical_capability_ids || [],
    authenticity_status: device.authenticity_status,
    connectivity_status: device.connectivity_status,
    ota_status: device.ota_status,
    ownership_status: device.ownership_status,
    purchase_context_id: device.purchase_context_id || "",
  }));
}

async function ensureDeviceManagementDemoDevices(session) {
  const accountId = projectServerUserId(session);
  const existing = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`);
  if ((existing.items || []).length) return;

  await deviceManagementJson("/api/device-management/devices/register", {
    method: "POST",
    body: {
      device_id: "device_verified_1",
      serial_number: "GNX-ESP32-0001",
      hardware_profile_id: "hardware.processor_board.esp32_devkit",
      gernetix_verified: true,
      connectivity_status: "online",
      ota_status: "ready",
      firmware_version: "0.1.0",
      provisioning_batch_id: "demo-batch",
      provisioned_by: "user-ide-demo",
      one_time_device_secret: "demo-device-secret",
    },
  });
  await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
    method: "POST",
    body: {
      device_id: "device_verified_1",
      display_name: "Sven ESP32 DevKit",
      technical_capability_ids: ["wifi", "ota", "flash_firmware"],
    },
  });

  await deviceManagementJson("/api/device-management/devices/register", {
    method: "POST",
    body: {
      device_id: "device_community_1",
      serial_number: "COMM-ESP32-123",
      hardware_profile_id: "hardware.processor_board.esp32_unknown",
      connectivity_status: "offline",
      ota_status: "unknown",
    },
  });
  await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
    method: "POST",
    body: {
      device_id: "device_community_1",
      display_name: "Keller Sensor ESP32",
      technical_capability_ids: ["wifi"],
    },
  });
}

async function handleHardwareShopOrder(req, res, session) {
  const body = await readJsonBody(req);
  const offerId = String(body.offer_id || "").trim();
  if (!offerId) {
    sendJson(res, 400, { error: "missing_offer_id", message: "offer_id fehlt." });
    return;
  }
  const cart = await hardwareShopJson("/api/hardware-shop/carts", {
    method: "POST",
    body: { account_id: projectServerUserId(session) },
  });
  await hardwareShopJson(`/api/hardware-shop/carts/${encodeURIComponent(cart.cart_id)}/items`, {
    method: "POST",
    body: { offer_id: offerId, quantity: Number(body.quantity || 1) },
  });
  const order = await hardwareShopJson("/api/hardware-shop/orders", {
    method: "POST",
    body: { cart_id: cart.cart_id, payment_status: "paid" },
  });
  const purchaseContext = await hardwareShopJson(`/api/hardware-shop/orders/${encodeURIComponent(order.order_id)}/purchase-context`);
  const deviceManagementPurchaseContext = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(projectServerUserId(session))}/purchase-contexts`, {
    method: "POST",
    body: {
      order_id: order.order_id,
      ...purchaseContext,
    },
  });
  sendJson(res, 201, {
    order,
    purchase_context: purchaseContext,
    device_management_purchase_context: deviceManagementPurchaseContext,
  });
}

async function loadAiUsageSummary(session) {
  const accountId = projectServerUserId(session);
  const [credits, dashboard] = await Promise.all([
    aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`),
    aiUsageJson("/api/ai-usage/admin/dashboard"),
  ]);
  return {
    base_url: aiUsageBaseUrl,
    credits,
    usage_events: dashboard.summary,
    model_summary: dashboard.by_model,
  };
}

async function handleAiDemo(req, res, session) {
  const body = await readJsonBody(req);
  const accountId = projectServerUserId(session);
  const model = body.model || "gpt-4.1-mini";
  const preflight = await aiUsageJson("/api/ai-usage/preflight", {
    method: "POST",
    body: {
      account_id: accountId,
      user_id: accountId,
      project_id: body.project_id || "",
      feature: "user_ide_demo_ai_help",
      model,
      estimated_input_tokens: Number(body.estimated_input_tokens || 600),
      estimated_output_tokens: Number(body.estimated_output_tokens || 300),
      system_capabilities: ["system_capability.ai_assistant"],
    },
    allowPaymentRequired: true,
  });
  if (!preflight.allowed) {
    sendJson(res, 402, preflight);
    return;
  }
  const completed = await aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/complete`, {
    method: "POST",
    body: {
      input_tokens: Number(body.input_tokens || body.estimated_input_tokens || 600),
      output_tokens: Number(body.output_tokens || body.estimated_output_tokens || 300),
    },
  });
  sendJson(res, 200, {
    preflight,
    completed,
    credits: await aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`),
  });
}

function latestBuildStatus(project) {
  return project && project.build_count > 0 ? `${project.build_count} BuildJob(s)` : "";
}

async function projectServerJson(pathname, options = {}) {
  const response = await fetch(`${projectServerBaseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Project Server request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function hardwareShopJson(pathname, options = {}) {
  const response = await fetch(`${hardwareShopBaseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Hardware Shop request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function buildDeployJson(pathname, options = {}) {
  const response = await fetch(`${buildDeployBaseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Build & Deploy request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function deviceManagementJson(pathname, options = {}) {
  const response = await fetch(`${deviceManagementBaseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Device Management request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function aiUsageJson(pathname, options = {}) {
  const response = await fetch(`${aiUsageBaseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !(options.allowPaymentRequired && response.status === 402)) {
    const error = new Error(payload.message || payload.error || "AI Usage request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function waitForBuildDeployJob(jobId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = await buildDeployJson(`/api/build-jobs/${encodeURIComponent(jobId)}`);
    if (["succeeded", "failed", "replaced"].includes(job.status)) return job;
    await delay(150);
  }
  return null;
}

function toBuildDeployPackage(buildPackage) {
  return {
    package_id: buildPackage.package_id,
    files: Object.fromEntries((buildPackage.files || []).map((file) => [file.path, file.content])),
  };
}

function toProjectBuildResult(buildDeployJob) {
  const artifacts = buildDeployJob.result?.build?.artifacts || {};
  return {
    status: buildDeployJob.status,
    build: buildDeployJob.result?.build || null,
    deploy: buildDeployJob.result?.deploy || null,
    error: buildDeployJob.error || null,
    artifacts: Object.values(artifacts).map((artifact) => ({
      file_name: artifact.file_name,
      url: artifact.download_url,
      sha256: artifact.sha256,
      size_bytes: artifact.size_bytes,
      artifact_type: artifact.file_name === "build.log" ? "build_log" : "firmware",
    })),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function projectServerUserId(session) {
  return session.account.user_id || session.account.username || demoUsername;
}

async function createAccountSummary(session) {
  const aiUsage = await loadAiUsageSummary(session);
  return {
    username: session.account.username || demoUsername,
    user_id: projectServerUserId(session),
    plan: "Premium Demo",
    capabilities: ["ide_flash_usb", "ide_flash_ota", "cloud_flash"],
    ai_credits: aiUsage.credits.available_credits,
    consent_summary: "1 aktiver Device-Support-Consent",
    project_server: projectServerBaseUrl,
    build_deploy_server: buildDeployBaseUrl,
    hardware_shop: hardwareShopBaseUrl,
    device_management: deviceManagementBaseUrl,
    ai_usage: aiUsageBaseUrl,
  };
}

function createUserIdeState() {
  const projects = [
    project("software-engineering-tamagotchi", "Software Engineering mit Tamagotchi", "Modellbasierte Entwicklung", "Verhalten zuerst verstehen, bevor Code entsteht.", [
      step("Warum Tamagotchi?", "Ein vertrautes Spiel macht Zustaende, Werte und Regeln sichtbar.", "Du erkennst, dass Software Verhalten beschreibt, nicht nur Befehle ausfuehrt."),
      step("State sichtbar machen", "Hunger, Durst, Laune und Leben werden als Zustand modelliert.", "Ein Zustand ist eine fachliche Aussage ueber das System."),
      step("Regeln formulieren", "Ausloeser veraendern Werte und fuehren zu neuen Zustaenden.", "Gute Regeln sind klarer als verstreute if-Abfragen."),
      step("Runtime waehlen", "Dasselbe Modell kann spaeter Browser-App oder Embedded-App antreiben.", "Das Modell bleibt stabil, die technische Huelle kann wechseln."),
    ]),
    project("esp32-ota-bootstrap-firmware", "ESP32 OTA-Basissoftware", "Firmware", "USB-Erstflash vorbereiten und spaetere OTA-Faehigkeit erhalten.", [
      step("USB-Erstflash", "Das Board wird initial mit der GerNetiX-Basissoftware vorbereitet.", "OTA bleibt Teil der Basis, nicht Teil des User-Codes."),
      step("Service-Endpunkte", "Device Management und Build-&-Deploy bleiben konfigurierbar.", "Ein Serverumzug darf keinen USB-Reflash erzwingen."),
      step("OTA pruefen", "Das Board meldet Update-Status und prueft Firmware-Groesse sowie SHA-256.", "Robuste Updates brauchen Rueckmeldung und Verifikation."),
    ]),
    project("plant-watering-control", "Pflanzenbewaesserung", "Sensor und Aktor", "Feuchtigkeit messen und eine Pumpe kontrolliert schalten.", [
      step("Nutzen und Risiko", "Die Pflanze soll Wasser bekommen, ohne Ueberschwemmung.", "Automatisierung braucht Grenzen."),
      step("Sensor lesen", "Bodenfeuchte wird zur Eingangsseite der Steuerung.", "Ein Sensor liefert Hinweise, keine fertige Entscheidung."),
      step("Pumpe schalten", "Die Pumpe ist die Ausgangsseite des Systems.", "Aktorik macht Software in der Welt wirksam."),
      step("Sicherheit", "Laufzeitbegrenzung und Fehlerfaelle gehoeren zur Funktion.", "Sichere Software plant Stoerungen mit ein."),
    ]),
  ];

  return {
    projectDefinitions: projects,
    projectServerSeeded: false,
    devices: [
      {
        device_id: "device_verified_1",
        display_name: "Sven ESP32 DevKit",
        hardware_profile_id: "hardware.processor_board.esp32_devkit",
        authenticity_status: "gernetix_verified",
        connectivity_status: "online",
        ota_status: "ready",
      },
      {
        device_id: "device_community_1",
        display_name: "Keller Sensor ESP32",
        hardware_profile_id: "hardware.processor_board.esp32_unknown",
        authenticity_status: "community_unverified",
        connectivity_status: "offline",
        ota_status: "unknown",
      },
    ],
    builds: [],
  };
}

function project(slug, title, area, summary, steps) {
  const requiredCapabilitiesBySlug = {
    "software-engineering-tamagotchi": ["capability.processor_esp32", "capability.wifi"],
    "esp32-ota-bootstrap-firmware": ["capability.processor_esp32", "capability.wifi", "capability.ota"],
    "plant-watering-control": ["capability.processor_esp32", "capability.wifi", "capability.digital_output"],
  };
  return {
    slug,
    project_server_id: `project_${slug}`,
    learning_project_id: `learning_project.${slug.replace(/-/g, "_")}`,
    hardware_profile_id: "hardware.processor_board.esp32_devkit",
    default_device_id: "device_verified_1",
    required_capability_ids: requiredCapabilitiesBySlug[slug] || ["capability.processor_esp32"],
    title,
    area,
    summary,
    status: "bereit",
    last_build_status: "",
    steps,
  };
}

function ownedCapabilityIds(devices) {
  const capabilities = new Set();
  for (const device of devices) {
    for (const capability of device.technical_capability_ids || []) capabilities.add(`capability.${capability}`);
    if (device.hardware_profile_id === "hardware.processor_board.esp32_devkit") {
      capabilities.add("capability.processor_esp32");
      capabilities.add("capability.wifi");
      if (device.ota_status === "ready") capabilities.add("capability.ota");
    }
  }
  return Array.from(capabilities);
}

function step(title, text, insight) {
  return { title, text, insight };
}

function demoProjectSource(project) {
  return [
    "#include <Arduino.h>",
    "",
    "void setup() {",
    "  Serial.begin(115200);",
    "}",
    "",
    "void loop() {",
    `  Serial.println("${project.title}");`,
    "  delay(1000);",
    "}",
    "",
  ].join("\n");
}

function serveStatic(res, rootDir, requestPath) {
  const normalizedRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(rootDir, normalizedRequestPath));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function normalizeDemoPath(pathname) {
  const stripped = pathname.replace(/^\/demo\/tamagotchi\/?/, "/");
  return stripped === "/" || stripped === "" ? "/index.html" : stripped;
}

function normalizeProjectsPath(pathname) {
  const stripped = pathname.replace(/^\/projects\/?/, "/");
  return stripped === "/" || stripped === "" ? "/index.html" : stripped;
}

function normalizeDevProjectsPath(pathname) {
  const stripped = pathname.replace(/^\/dev\/projects\/?/, "/");
  return stripped === "/" || stripped === "" ? "/index.html" : stripped;
}

function readSession(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function readSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.gernetix_demo_session || "";
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex < 0) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function setSessionCookie(res, token, expiresAt) {
  res.setHeader("Set-Cookie", [
    `gernetix_demo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", [
    "gernetix_demo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  ]);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sanitizeNextPath(value) {
  const next = String(value || "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
