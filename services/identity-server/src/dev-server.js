const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { createDefaultIdentityModule, MockEmailService } = require("./index");

const publicDir = path.join(__dirname, "..", "public");
const appDir = path.join(publicDir, "app");
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const port = Number(process.env.PORT || 4300);
const host = process.env.HOST || "127.0.0.1";
const demoUsername = process.env.DEMO_USER || "demo";
const demoEmail = process.env.DEMO_EMAIL || "demo@gernetix.local";
const demoPassword = process.env.DEMO_PASSWORD || "demo-passwort";
const projectServerBaseUrl = process.env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800";
const buildDeployBaseUrl = process.env.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400";
const hardwareShopBaseUrl = process.env.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900";
const hardwareCatalogBaseUrl = process.env.HARDWARE_CATALOG_BASE_URL || "http://127.0.0.1:4910";
const deviceManagementBaseUrl = process.env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700";
const aiUsageBaseUrl = process.env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000";
const deviceDiscoveryUrls = process.env.GERNETIX_DEVICE_DISCOVERY_URLS || process.env.DEVICE_DISCOVERY_URLS || "";
const gernetixNodeHostnamePrefix = "gernetix-";
const execFileAsync = promisify(execFile);
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
  console.log(`Identity login UI: http://${host}:${port}/app/auth/`);
  console.log(`GerNetiX Platform: http://${host}:${port}/app/dashboard/`);
  console.log(`Project Server adapter: ${projectServerBaseUrl}`);
  console.log(`Build & Deploy adapter: ${buildDeployBaseUrl}`);
  console.log(`Hardware Shop adapter: ${hardwareShopBaseUrl}`);
  console.log(`Hardware Catalog adapter: ${hardwareCatalogBaseUrl}`);
  console.log(`Device Management adapter: ${deviceManagementBaseUrl}`);
  console.log(`AI Usage adapter: ${aiUsageBaseUrl}`);
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

  if (url.pathname === "/api/dev/lesson-preview-migration" && req.method === "OPTIONS") {
    sendDevJson(res, 204, {});
    return;
  }

  if (url.pathname === "/api/dev/lesson-preview-migration" && req.method === "POST") {
    await handleDevLessonPreviewMigration(req, res);
    return;
  }

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

  if (url.pathname === "/api/platform/summary") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformSummary(res, session);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/workspace-state") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, updateWorkspaceState(session, await readJsonBody(req)));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/learning-progress") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, updateLearningProgress(session, await readJsonBody(req)));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/hardware/processor-boards") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, { items: await loadProcessorBoards() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/devices/discover") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, await discoverNetworkDevices(session, Object.fromEntries(url.searchParams.entries())));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/usb-serial/ports") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, { items: await listUsbSerialPorts() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/devices/from-discovery") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformDiscoveredDeviceClaim(req, res, session);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/devices") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformDeviceCreate(req, res, session);
    return;
  }

  const platformDevice = url.pathname.match(/^\/api\/platform\/devices\/([^/]+)$/);
  if (req.method === "DELETE" && platformDevice) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformDeviceRemove(res, session, decodeURIComponent(platformDevice[1]));
    return;
  }

  const platformSource = url.pathname.match(/^\/api\/platform\/projects\/([^/]+)\/sources\/(.+)$/);
  if (platformSource && ["GET", "PUT"].includes(req.method)) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    if (req.method === "GET") {
      await handlePlatformSourceRead(res, session, decodeURIComponent(platformSource[1]), decodeURIComponent(platformSource[2]));
      return;
    }
    await handlePlatformSourceWrite(req, res, session, decodeURIComponent(platformSource[1]), decodeURIComponent(platformSource[2]));
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


  if (url.pathname === "/demo" || url.pathname === "/demo/" || url.pathname === "/projects" || url.pathname === "/projects/") {
    redirect(res, "/app/dashboard/");
    return;
  }

  if (url.pathname === "/app" || url.pathname === "/app/") {
    if (!readSession(req)) {
      redirect(res, authRoute("/app/dashboard/"));
      return;
    }
    redirect(res, "/app/dashboard/");
    return;
  }

  if (url.pathname === "/login.html" || url.pathname === "/login.js" || url.pathname === "/styles.css") {
    redirect(res, authRoute(url.searchParams.get("next") || "/app/dashboard/"));
    return;
  }

  if (url.pathname === "/app/auth" || url.pathname.startsWith("/app/auth/")) {
    serveStatic(res, appDir, normalizeAppPath(url.pathname));
    return;
  }

  if (url.pathname.startsWith("/app/")) {
    if (!readSession(req)) {
      redirect(res, authRoute(url.pathname + url.search));
      return;
    }
    serveStatic(res, appDir, normalizeAppPath(url.pathname));
    return;
  }

  if (url.pathname.startsWith("/projects/")) {
    if (!readSession(req)) {
      redirect(res, authRoute(url.pathname + url.search));
      return;
    }
    redirect(res, "/app/dashboard/");
    return;
  }

  if (url.pathname === "/dev/projects" || url.pathname === "/dev/projects/") {
    if (!readSession(req)) {
      redirect(res, authRoute("/app/learn/"));
      return;
    }
    redirect(res, "/app/learn/");
    return;
  }

  if (url.pathname.startsWith("/dev/projects/")) {
    if (!readSession(req)) {
      redirect(res, authRoute("/app/learn/"));
      return;
    }
    redirect(res, "/app/learn/");
    return;
  }

  if (url.pathname === "/") {
    redirect(res, "/app/auth/");
    return;
  }

  serveStatic(res, publicDir, url.pathname);
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  try {
    const login = await auth.login_local(body.identifier, body.password);
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, {
      account: login.account,
      next: sanitizeNextPath(body.next) || "/app/dashboard/",
    });
  } catch (error) {
    sendJson(res, error.status || 401, {
      error: error.code || "invalid_login",
      message: "Login fehlgeschlagen.",
    });
  }
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

async function handlePlatformSummary(res, session) {
  const projects = await loadUserIdeProjects(session);
  const devices = await loadUserIdeDevices(session);
  const builds = await loadProjectBuilds(projects, session);
  const userId = projectServerUserId(session);
  sendJson(res, 200, {
    account: await createAccountSummary(session),
    routes: {
      auth: "/app/auth/",
      dashboard: "/app/dashboard/",
      learn: "/app/learn/",
      ide: "/app/ide/",
      projects: "/app/projects/",
      devices: "/app/devices/",
      builds: "/app/builds/",
      billing: "/app/billing/",
    },
    workspace_state: getWorkspaceState(userId),
    projects: projects.map(toPlatformProject),
    learning_progress: listLearningProgress(userId, projects),
    devices,
    builds,
    billing: await loadBillingSummary(session),
  });
}

async function handlePlatformSourceRead(res, session, projectId, sourcePath) {
  const project = await requireSessionProject(session, projectId);
  const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(sourcePath)}`);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, source);
}

async function handlePlatformSourceWrite(req, res, session, projectId, sourcePath) {
  const project = await requireSessionProject(session, projectId);
  const body = await readJsonBody(req);
  const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
    method: "PUT",
    body: {
      path: sourcePath,
      content: String(body.content || ""),
      content_type: body.content_type || "text/x-c++src",
      role: body.role || "user_code",
    },
  });
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, source);
}

async function handlePlatformDeviceCreate(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const hardwareProfileId = requiredField(body.hardware_profile_id, "hardware_profile_id");
    const serialNumber = requiredField(body.serial_number, "serial_number");
    const displayName = requiredField(body.display_name || serialNumber, "display_name");
    const processorBoard = await findProcessorBoard(hardwareProfileId);
    const capabilities = normalizeCapabilityIds(
      body.technical_capability_ids || body.capability_ids || processorBoard?.capability_ids || [],
    );
    const registered = await deviceManagementJson("/api/device-management/devices/register", {
      method: "POST",
      body: {
        serial_number: serialNumber,
        hardware_profile_id: hardwareProfileId,
        authenticity_status: "community_unverified",
        lifecycle_state: "registered_by_customer",
        connectivity_status: body.connectivity_status || "unknown",
        ota_status: body.ota_status || (capabilities.includes("ota") ? "unknown" : "unsupported"),
        app_version: body.app_version || "",
        runtime_version: body.runtime_version || "",
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
      },
    });
    sendJson(res, 201, decorateUserIdeDevice(accountDevice));
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "device_inventory_create_failed",
      message: error.message || "Device konnte nicht inventarisiert werden.",
      details: error.payload || {},
    });
  }
}

async function handlePlatformDiscoveredDeviceClaim(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const discoveredDeviceId = body.device_id || body.deviceId || "";
    const serialNumber = requiredField(body.serial_number || body.serialNumber || discoveredDeviceId, "serial_number");
    const hardwareProfileId = requiredField(body.hardware_profile_id || body.hardwareProfileId, "hardware_profile_id");
    const displayName = requiredField(body.display_name || body.displayName || serialNumber, "display_name");
    const capabilities = normalizeCapabilityIds(body.technical_capability_ids || body.capability_ids || body.capabilities || []);
    const registered = await deviceManagementJson("/api/device-management/devices/register", {
      method: "POST",
      body: {
        device_id: discoveredDeviceId || undefined,
        serial_number: serialNumber,
        hardware_profile_id: hardwareProfileId,
        authenticity_status: body.authenticity_status || body.authenticityStatus || "gernetix_verified_pending_proof",
        lifecycle_state: "discovered_by_user_ide",
        connectivity_status: "online",
        ota_status: body.ota_status || body.otaStatus || (capabilities.includes("ota") ? "ready" : "unknown"),
        app_version: body.app_version || body.firmwareVersion || "",
        runtime_version: body.runtime_version || body.runtimeVersion || "",
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
      },
    });
    sendJson(res, 201, decorateUserIdeDevice(accountDevice));
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "discovered_device_claim_failed",
      message: error.message || "Gefundenes Device konnte nicht ins Inventar uebernommen werden.",
      details: error.payload || {},
    });
  }
}

async function handlePlatformDeviceRemove(res, session, accountDeviceId) {
  try {
    const accountId = projectServerUserId(session);
    const result = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}`, {
      method: "DELETE",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "device_inventory_remove_failed",
      message: error.message || "Device konnte nicht aus dem Inventar entfernt werden.",
      details: error.payload || {},
    });
  }
}

async function discoverNetworkDevices(session, options = {}) {
  const accountDevices = await loadUserIdeDevices(session).catch(() => []);
  const adminDevices = await loadAdminDeviceSummaries().catch(() => []);
  const knownDeviceIds = new Set(accountDevices.map((device) => device.device_id));
  const adminByDeviceId = new Map(adminDevices.map((device) => [device.device_id, device]));
  const scope = String(options.scope || "node").trim();
  const candidates = discoveryCandidateUrls({ includeSetupAp: scope === "setup_ap", onlySetupAp: scope === "setup_ap" });
  const found = [];
  const errors = [];
  await runLimited(candidates, 32, async (url) => {
    const result = await probeDeviceStatus(url);
    if (result.device) {
      const adminDevice = adminByDeviceId.get(result.device.device_id);
      const alreadyInInventory = knownDeviceIds.has(result.device.device_id);
      found.push({
        ...result.device,
        already_in_inventory: alreadyInInventory,
        ownership_status: alreadyInInventory
          ? "current_account"
          : (adminDevice?.pairing_status === "paired_to_account" ? "other_account" : "unregistered"),
      });
    } else if (result.error) {
      errors.push(result.error);
    }
  });
  const unique = [];
  const seen = new Set();
  for (const item of found) {
    const key = item.device_id || item.serial_number || item.source_url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return {
    searched_at: new Date().toISOString(),
    strategy: scope === "setup_ap" ? "http_status_setup_ap" : "http_status_scan_gernetix_prefix",
    hostname_pattern: `${gernetixNodeHostnamePrefix}*`,
    candidate_count: candidates.length,
    items: unique,
    errors: errors.slice(0, 10),
  };
}

async function loadAdminDeviceSummaries() {
  const response = await deviceManagementJson("/api/device-management/admin/devices");
  return response.items || [];
}

function discoveryCandidateUrls(options = {}) {
  if (options.onlySetupAp) return ["http://192.168.4.1/status"];
  const explicit = deviceDiscoveryUrls
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.startsWith("http") ? item : `http://${item}`);
  const candidates = new Set(explicit.map(statusUrl));
  for (const baseAddress of localIpv4NetworkBases()) {
    for (let host = 1; host <= 254; host += 1) {
      candidates.add(`http://${baseAddress}.${host}/status`);
    }
  }
  if (options.includeSetupAp) candidates.add("http://192.168.4.1/status");
  return Array.from(candidates);
}

function statusUrl(value) {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.endsWith("/status") ? trimmed : `${trimmed}/status`;
}

function localIpv4NetworkBases() {
  const bases = new Set();
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (!/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(entry.address)) continue;
      const parts = entry.address.split(".");
      if (parts.length === 4) bases.add(parts.slice(0, 3).join("."));
    }
  }
  return Array.from(bases);
}

async function probeDeviceStatus(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 450);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return {};
    const status = await response.json();
    const device = normalizeDiscoveredDevice(url, status);
    return device ? { device } : {};
  } catch (error) {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDiscoveredDevice(sourceUrl, status = {}) {
  const deviceName = String(status.device || status.hostname || "").trim();
  const displayName = String(status.displayName || status.display_name || "").trim();
  const runtimeName = String(status.runtime || "").trim();
  const isGerNetixRuntime = runtimeName === "basissoftware/esp32" || runtimeName.toLowerCase().includes("gernetix");
  const isGerNetix = deviceName.toLowerCase().startsWith(gernetixNodeHostnamePrefix)
    || displayName.toLowerCase().startsWith(gernetixNodeHostnamePrefix)
    || isGerNetixRuntime;
  if (!isGerNetix) return null;
  const capabilities = normalizeCapabilityIds(status.capabilities || inferDiscoveredCapabilities(status));
  const deviceId = status.deviceId || status.device_id || "";
  const serialNumber = status.serialNumber || status.serial_number || "";
  const hostname = status.hostname || deviceName;
  return {
    discovery_id: Buffer.from(sourceUrl).toString("base64url"),
    source_url: sourceUrl,
    device_id: deviceId,
    serial_number: serialNumber,
    display_name: displayName || serialNumber || deviceId || hostname || `GerNetiX Device ${sourceUrl}`,
    hostname,
    hardware_profile_id: status.hardwareProfileId || status.hardware_profile_id || "hardware.processor_board.esp32_devkit",
    technical_capability_ids: capabilities,
    runtime_version: status.runtimeVersion || status.runtime_version || "",
    firmware_version: status.firmwareVersion || status.firmware_version || "",
    provisioning_state: status.provisioningState || status.provisioning_state || "",
    connectivity_status: status.wifiMode === "setup_ap" ? "setup_ap" : "online",
    esp32_inventory_state: status.wifiMode === "setup_ap" ? "basissoftware_setup_ap" : "node_online",
    treatment: status.wifiMode === "setup_ap"
      ? "Basissoftware ist vorhanden, aber noch nicht im Kunden-WLAN. Im Setup-AP WLAN-Daten speichern und danach Node-Suche erneut ausfuehren."
      : "Basissoftware ist als Node im WLAN erreichbar. Nach Kontopruefung kann das Board ins Inventar uebernommen werden.",
    ota_status: capabilities.includes("ota") ? "ready" : "unknown",
    authenticity_status: status.hasDeviceSecret ? "gernetix_verified_pending_proof" : "community_unverified",
  };
}

function inferDiscoveredCapabilities(status = {}) {
  const capabilities = ["wifi", "flash_firmware"];
  if (String(status.runtime || "").toLowerCase().includes("ota") || String(status.firmwareBasis || "").toLowerCase().includes("ota")) {
    capabilities.push("ota");
  }
  return capabilities;
}

async function runLimited(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

async function requireSessionProject(session, projectId) {
  const projects = await loadUserIdeProjects(session);
  const project = projects.find((item) => item.project_server_id === projectId || item.slug === projectId);
  if (!project) {
    const error = new Error("Projekt wurde nicht gefunden.");
    error.status = 404;
    throw error;
  }
  return project;
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
  if (body.mode === "build_and_usb_flash" && !device.usb_flash_supported) {
    sendJson(res, 409, { error: "device_not_usb_flash_ready", message: "Das ausgewaehlte Device ist nicht fuer USB-Flash konfiguriert." });
    return;
  }

  const projectServerJob = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`, {
    method: "POST",
    body: {
      mode: body.mode || "build",
      device_id: device.device_id,
      build_config: resolveBuildConfig(project, device),
    },
  });
  const buildPackage = await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/build-package`);
  const buildDeployJob = await buildDeployJson("/api/build-jobs", {
    method: "POST",
    body: {
      job_id: projectServerJob.build_job_id,
      mode: body.mode || "build",
      device_id: device.device_id,
      build_package: toBuildDeployPackage(buildPackage, device, project),
      usb_flash: body.mode === "build_and_usb_flash" ? {
        upload_port: String(body.upload_port || device.upload_port || "").trim(),
      } : null,
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
    artifact_url: completedBuildDeployJob?.result?.build?.primary_firmware?.download_url
      || completedBuildDeployJob?.result?.build?.artifacts?.["firmware.bin"]?.download_url
      || completedBuildDeployJob?.result?.build?.artifacts?.["firmware.hex"]?.download_url
      || "",
    flash_status: completedBuildDeployJob?.result?.build?.usb_flash?.status
      || completedBuildDeployJob?.result?.deploy?.status
      || "nicht angefordert",
  };
  userIdeState.builds.unshift(build);
  touchWorkspace(session, project.project_server_id, body.mode === "learn" ? "learn" : "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 202, build);
}

async function loadUserIdeProjects(session) {
  await ensureProjectServerDemoProjects(session);
  const userId = projectServerUserId(session);
  const response = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}`);
  const projectsById = new Map(response.items.map((item) => [item.project_id, item]));
  const workspace = getWorkspaceState(userId);
  return userIdeState.projectDefinitions.map((definition) => {
    const project = projectsById.get(definition.project_server_id);
    return {
      ...definition,
      owner_user_id: project ? project.user_id : userId,
      title: project ? project.title : definition.title,
      summary: project ? project.description : definition.summary,
      hardware_profile_id: definition.hardware_profile_id,
      build_config: Object.hasOwn(definition, "build_config") ? definition.build_config : project?.build_config,
      linked_device_id: definition.default_device_id || null,
      status: project ? project.status : "project_server_missing",
      last_build_status: latestBuildStatus(project),
      source_count: project ? project.source_count : 0,
      build_count: project ? project.build_count : 0,
      view_manifest: projectViewManifest(definition),
      created_at: project ? project.created_at : "",
      updated_at: project ? project.updated_at : "",
      last_opened_mode: workspace.lastProjectId === definition.project_server_id ? workspace.lastMode : "",
      last_opened_at: workspace.lastProjectId === definition.project_server_id ? workspace.updatedAt : "",
      source_files: definition.source_files || [{ path: "src/main.cpp", role: "user_code" }],
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
        build_config: definition.build_config,
        view_manifest: projectViewManifest(definition),
        sources: demoProjectSources(definition),
      },
    }).catch((error) => {
      if (error.status !== 400) throw error;
    });
    await projectServerJson(`/api/projects/${encodeURIComponent(definition.project_server_id)}`, {
      method: "PATCH",
      body: {
        hardware_profile_id: definition.hardware_profile_id,
        device_id: definition.default_device_id || null,
        build_config: definition.build_config || null,
        view_manifest: projectViewManifest(definition),
      },
    }).catch((error) => {
      if (error.status !== 404) throw error;
    });
    for (const source of demoProjectSources(definition)) {
      await projectServerJson(`/api/projects/${encodeURIComponent(definition.project_server_id)}/sources`, {
        method: "POST",
        body: source,
      }).catch((error) => {
        if (error.status !== 404) throw error;
      });
    }
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

function toPlatformProject(project) {
  return {
    id: project.project_server_id,
    ownerUserId: project.owner_user_id || "",
    name: project.title,
    description: project.summary,
    type: project.area || "guided_project",
    sourceFiles: project.source_files || [{ path: "src/main.cpp", role: "user_code" }],
    targetRuntime: project.hardware_profile_id,
    linkedDeviceId: project.linked_device_id || project.default_device_id || "",
    lastOpenedMode: project.last_opened_mode || "learn",
    lastOpenedAt: project.last_opened_at || "",
    createdAt: project.created_at || "",
    updatedAt: project.updated_at || "",
    slug: project.slug,
    courseId: project.course_id,
    lessonId: project.lesson_id,
    requiredCapabilityIds: project.required_capability_ids,
    buildConfig: project.build_config,
    status: project.status,
    sourceCount: project.source_count,
    buildCount: project.build_count,
    viewManifest: project.view_manifest,
    steps: project.steps,
  };
}

function getWorkspaceState(userId) {
  return userIdeState.workspaceStates.get(userId) || {
    userId,
    lastProjectId: "",
    lastMode: "learn",
    lastRoute: "/app/dashboard/",
    updatedAt: "",
  };
}

function touchWorkspace(session, projectId, mode, route) {
  return updateWorkspaceState(session, {
    lastProjectId: projectId,
    lastMode: mode,
    lastRoute: route,
  });
}

function updateWorkspaceState(session, input = {}) {
  const userId = projectServerUserId(session);
  const current = getWorkspaceState(userId);
  const updated = {
    userId,
    lastProjectId: input.lastProjectId || input.last_project_id || current.lastProjectId || "",
    lastMode: input.lastMode || input.last_mode || current.lastMode || "learn",
    lastRoute: input.lastRoute || input.last_route || current.lastRoute || "/app/dashboard/",
    updatedAt: new Date().toISOString(),
  };
  userIdeState.workspaceStates.set(userId, updated);
  return updated;
}

function listLearningProgress(userId, projects) {
  return projects.map((project) => {
    const key = learningProgressKey(userId, project.course_id, project.lesson_id, project.project_server_id);
    return userIdeState.learningProgress.get(key) || {
      id: `learning_progress_${project.slug}`,
      userId,
      courseId: project.course_id,
      lessonId: project.lesson_id,
      projectId: project.project_server_id,
      currentStep: 0,
      completedSteps: [],
      updatedAt: "",
    };
  });
}

function updateLearningProgress(session, input = {}) {
  const userId = projectServerUserId(session);
  const projectId = requiredField(input.projectId || input.project_id, "projectId");
  const courseId = requiredField(input.courseId || input.course_id, "courseId");
  const lessonId = requiredField(input.lessonId || input.lesson_id, "lessonId");
  const currentStep = Number(input.currentStep ?? input.current_step ?? 0);
  const completedSteps = Array.from(new Set((input.completedSteps || input.completed_steps || []).map(Number))).sort((left, right) => left - right);
  const progress = {
    id: input.id || `learning_progress_${courseId}_${lessonId}_${projectId}`.replace(/[^a-zA-Z0-9_.-]+/g, "_"),
    userId,
    courseId,
    lessonId,
    projectId,
    currentStep,
    completedSteps,
    updatedAt: new Date().toISOString(),
  };
  userIdeState.learningProgress.set(learningProgressKey(userId, courseId, lessonId, projectId), progress);
  touchWorkspace(session, projectId, "learn", `/app/learn/?project=${encodeURIComponent(projectId)}`);
  return progress;
}

function learningProgressKey(userId, courseId, lessonId, projectId) {
  return `${userId}:${courseId}:${lessonId}:${projectId}`;
}

async function loadBillingSummary(session) {
  const aiUsage = await loadAiUsageSummary(session);
  return {
    account_id: projectServerUserId(session),
    plan: "Premium Demo",
    entitlements: ["learn_guided_projects", "ide_edit_code", "build_and_flash", "ai_assistant"],
    ai_credits: aiUsage.credits,
  };
}

function requiredField(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error(`Pflichtfeld fehlt: ${field}`);
    error.status = 400;
    throw error;
  }
  return normalized;
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

async function loadProcessorBoards() {
  const response = await hardwareCatalogJson("/api/hardware-catalog/processor-boards");
  return response.items || [];
}

async function findProcessorBoard(hardwareProfileId) {
  const boards = await loadProcessorBoards().catch(() => []);
  return boards.find((board) => (
    board.hardware_item_id === hardwareProfileId
    || board.hardware_profile_id === hardwareProfileId
    || board.provisioning_profile_id === hardwareProfileId
  )) || null;
}

async function loadUserIdeDevices(session) {
  const accountId = projectServerUserId(session);
  const response = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`);
  return (response.items || []).map(decorateUserIdeDevice);
}

function decorateUserIdeDevice(device) {
  return {
    device_id: device.device_id,
    account_device_id: device.account_device_id,
    display_name: device.display_name,
    hardware_profile_id: device.hardware_profile_id,
    technical_capability_ids: device.technical_capability_ids || [],
    authenticity_status: device.authenticity_status,
    connectivity_status: device.connectivity_status,
    ota_status: device.ota_status,
    usb_flash_supported: isUsbFlashDevice(device),
    upload_port: defaultUploadPort(device),
    build_config: deviceBuildConfig(device),
    build_target_label: buildTargetLabel(device),
    ownership_status: device.ownership_status,
    purchase_context_id: device.purchase_context_id || "",
  };
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
  try {
    const [credits, dashboard] = await Promise.all([
      aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`),
      aiUsageJson("/api/ai-usage/admin/dashboard"),
    ]);
    return {
      base_url: aiUsageBaseUrl,
      available: true,
      credits,
      usage_events: dashboard.summary,
      model_summary: dashboard.by_model,
    };
  } catch (error) {
    return {
      base_url: aiUsageBaseUrl,
      available: false,
      credits: {
        account_id: accountId,
        available_credits: 0,
        consumed_credits: 0,
      },
      usage_events: {},
      model_summary: [],
      error: error.message || "AI Usage Service ist nicht erreichbar.",
    };
  }
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
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const job = await buildDeployJson(`/api/build-jobs/${encodeURIComponent(jobId)}`);
    if (["succeeded", "failed", "replaced"].includes(job.status)) return job;
    await delay(1000);
  }
  return null;
}

function toBuildDeployPackage(buildPackage, device = {}, project = {}) {
  const files = Object.fromEntries((buildPackage.files || []).map((file) => [file.path, file.content]));
  const buildConfig = resolveBuildConfig(project, device);
  if (buildConfig) files["platformio.ini"] = renderPlatformioIni(buildConfig);
  return {
    package_id: buildPackage.package_id,
    files,
  };
}

function resolveBuildConfig(project = {}, device = {}) {
  if (project.slug === "arduino-atmel-bare-metal" && project.build_config) return project.build_config;
  return device.build_config || project.build_config || null;
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
    project("arduino-blink", "Arduino Blink", "Firmware", "Kleines Blink-Projekt fuer den ersten USB-Flash auf ein Arduino-kompatibles Board.", [
      step("Projekt waehlen", "Arduino Blink ist das kleinste sinnvolle Firmware-Projekt fuer Arduino-kompatible Boards.", "Der Sketch bleibt gleich, das Boardprofil bestimmt die Zielplattform."),
      step("Board anschliessen", "Ein ESP32 DevKit, Arduino Nano oder ein anderes Arduino-kompatibles Board haengt per USB am Rechner.", "USB-Flash ist der schnellste lokale MVP-Nachweis."),
      step("Flash starten", "Die IDE startet Build und Upload ueber den Build-&-Deploy-Server.", "Der Button prueft die Plattformkette Ende zu Ende."),
    ]),
    project("arduino-atmel-bare-metal", "Arduino Atmel/AVR ohne Arduino", "Firmware", "Bare-Metal-Basissoftware fuer Arduino-kompatible AVR-Boards mit avr-libc, Build und USB-Flash.", [
      step("Runtime waehlen", "Dieses Projekt nutzt ein Arduino-kompatibles AVR-Board ohne Arduino-Framework.", "Die Board-Hardware bleibt Arduino-kompatibel, die Software spricht aber direkt AVR-Register an."),
      step("User-Datei bearbeiten", "Deine Logik liegt in src/user/user_app.c; main.c bleibt geschuetzte Basissoftware.", "Basis und User-Code bleiben getrennt."),
      step("Build starten", "Die IDE baut das Projekt mit PlatformIO fuer atmelavr/nanoatmega328.", "Das Ergebnis ist fuer AVR typischerweise eine firmware.hex."),
      step("USB-Flash starten", "Der Flash-Button nutzt den ausgewaehlten Arduino Nano und den COM-Port.", "Build und Upload laufen ueber denselben Build-&-Deploy-Pfad wie andere Firmware-Projekte."),
    ], {
      hardware_profile_id: "hardware.processor_board.arduino_nano_atmega328p",
      default_device_id: "device_arduino_nano_1",
      build_config: {
        environment: "uno",
        platform: "atmelavr",
        board: "uno",
        framework: "",
        monitorSpeed: "9600",
      },
      source_files: [{ path: "src/user/user_app.c", role: "user_code" }],
    }),
    project("software-engineering-tamagotchi", "Software Engineering mit Tamagotchi", "Modellbasierte Entwicklung", "Verhalten zuerst verstehen, bevor Code entsteht.", [
      step("Warum Tamagotchi?", "Ein vertrautes Spiel macht Zustaende, Werte und Regeln sichtbar.", "Du erkennst, dass Software Verhalten beschreibt, nicht nur Befehle ausfuehrt."),
      step("State sichtbar machen", "Hunger, Durst, Laune und Leben werden als Zustand modelliert.", "Ein Zustand ist eine fachliche Aussage ueber das System."),
      step("Regeln formulieren", "Ausloeser veraendern Werte und fuehren zu neuen Zustaenden.", "Gute Regeln sind klarer als verstreute if-Abfragen."),
      step("Runtime waehlen", "Dasselbe Modell kann spaeter Browser-App oder Embedded-App antreiben.", "Das Modell bleibt stabil, die technische Huelle kann wechseln."),
    ], {
      hardware_profile_id: "runtime.software_model",
      default_device_id: "",
      source_files: [{ path: "model/tamagotchi/model.yaml", role: "domain_model" }],
    }),
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
    lessonManifestOverrides: new Map(),
    learningProgress: new Map(),
    workspaceStates: new Map(),
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

function project(slug, title, area, summary, steps, options = {}) {
  const requiredCapabilitiesBySlug = {
    "software-engineering-tamagotchi": [],
    "arduino-blink": ["capability.arduino_framework_runtime", "capability.flash_firmware"],
    "arduino-atmel-bare-metal": ["capability.atmel_avr_bare_metal_runtime", "capability.flash_firmware"],
    "esp32-ota-bootstrap-firmware": ["capability.processor_esp32", "capability.wifi", "capability.ota"],
    "plant-watering-control": ["capability.processor_esp32", "capability.wifi", "capability.digital_output"],
  };
  return {
    slug,
    project_server_id: `project_${slug}`,
    learning_project_id: `learning_project.${slug.replace(/-/g, "_")}`,
    course_id: `course.${slug.replace(/-/g, "_")}`,
    lesson_id: `lesson.${slug.replace(/-/g, "_")}.intro`,
    hardware_profile_id: Object.hasOwn(options, "hardware_profile_id") ? options.hardware_profile_id : "hardware.processor_board.esp32_devkit",
    default_device_id: Object.hasOwn(options, "default_device_id") ? options.default_device_id : "device_verified_1",
    build_config: options.build_config || undefined,
    source_files: options.source_files || [{ path: "src/main.cpp", role: "user_code" }],
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

function normalizeCapabilityIds(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(list.map((item) => String(item).replace(/^capability\./, "")).filter(Boolean)));
}

function step(title, text, insight) {
  return { title, text, insight };
}

function primarySourcePath(project) {
  return project.source_files?.[0]?.path || "src/main.cpp";
}

function projectViewManifest(project) {
  const override = userIdeState.lessonManifestOverrides.get(project.slug);
  if (override) return override;

  if (project.slug === "software-engineering-tamagotchi") {
    return {
      schema_version: 1,
      title: "Tamagotchi Verhaltensmodell",
      summary: "Code ist nicht die erste Wahrheit. Das Projekt fuehrt ueber Zustaende, Regeln und PlantUML zum fachlichen Modell.",
      primary_source_path: primarySourcePath(project),
      hide_source_editor: true,
      mode: "guided_ide",
      views: [
        tamagotchiStorySlide("code-problem", "Schau dir den Quellcode an", "Die statische Quellcode-Datei zeigt sehr viele Details auf einmal. Die Frage ist: erkennst du sofort die fachliche Idee dahinter?", ["problem.code_is_not_explanation"], {
          type: "code",
          title: "assets/tamagotchi-complete-example.c",
          content: tamagotchiCodeExcerpt(),
        }),
        tamagotchiStorySlide("state-intro", "Einfuehrung in Zustaende", "Menschen verstehen Verhalten leichter, wenn sie es zuerst als benannte Zustaende betrachten.", ["state.simple_examples"], {
          type: "state_rows",
          title: "Objekte in Zustaenden",
          rows: [
            {
              label: "Regentonne",
              description: "Der Fuellstand ist als Zustand leichter lesbar als als technische Messung.",
              states: [
                { label: "leer", kind: "barrel", level: 0 },
                { label: "halb voll", kind: "barrel", level: 50 },
                { label: "voll", kind: "barrel", level: 100 },
              ],
            },
            {
              label: "Akku",
              description: "Auch beim Akku helfen einfache Namen, bevor ueber Spannung gesprochen wird.",
              states: [
                { label: "leer", kind: "battery", level: 8 },
                { label: "halb voll", kind: "battery", level: 50 },
                { label: "voll", kind: "battery", level: 100 },
              ],
            },
          ],
        }),
        tamagotchiStorySlide("state-categories", "Einteilung von Zustaenden", "Manche Zustaende sind direkt definiert. Andere Eigenschaften sind fliessend und haben von sich aus keine klaren Stufen.", ["state.discrete", "state.continuous", "classification.thresholds"], {
          type: "state_rows",
          title: "Direkt definiert oder eingeteilt",
          rows: [
            {
              label: "Direkt definiert",
              description: "Der Zustand ist bereits klar getrennt, zum Beispiel bei Kaffeemaschine oder Fernseher.",
              states: [
                { label: "aus", kind: "power", value: "off", showValue: false },
                { label: "an", kind: "power", value: "on", showValue: false },
              ],
            },
            {
              label: "Fliessend",
              description: "Der Wert veraendert sich kontinuierlich und wird erst spaeter klassifiziert.",
              states: [
                { label: "Temperatur", kind: "thermometer", level: 58, value: "0..100 Grad" },
                { label: "Punktzahl", kind: "label", value: "0..100" },
                { label: "Fuellstand", kind: "barrel", level: 50, value: "0..100 %" },
              ],
            },
          ],
        }),
        tamagotchiStorySlide("discrete-states", "Direkte diskrete Zustaende", "Wenn ein Objekt klar getrennte Zustaende besitzt, kann man den Zustand direkt benennen.", ["state.binary", "state.presence", "state.substates"], {
          type: "state_rows",
          title: "Diskrete Zustaende",
          rows: [
            {
              label: "Fernseher",
              description: "Zwei klare Zustaende: an oder aus. Bei genau zwei Zustaenden spricht man von binaer.",
              states: [
                { label: "aus", kind: "power", value: "off", showValue: false },
                { label: "an", kind: "power", value: "on", showValue: false },
              ],
            },
            {
              label: "Wetter",
              description: "Diskrete Zustaende muessen nicht nur zwei sein.",
              states: [
                { label: "sonnig", kind: "weather", value: "sunny", showValue: false },
                { label: "bewoelkt", kind: "weather", value: "cloudy", showValue: false },
                { label: "regnerisch", kind: "weather", value: "rainy", showValue: false },
                { label: "windig", kind: "weather", value: "windy", showValue: false },
              ],
            },
            {
              label: "Siebtraegermaschine",
              description: "Ein Oberzustand kann Unterzustaende enthalten.",
              states: [
                { label: "aus", kind: "power", value: "off", showValue: false },
                { label: "an", kind: "power", value: "on", showValue: false, substates: ["aufheizend", "bereit"] },
              ],
            },
          ],
        }),
        tamagotchiStorySlide("physical-property-rule", "Aus Messwerten werden Zustaende", "Wenn eine Eigenschaft fliessend ist, brauchen wir eine Messgroesse und Grenzen.", ["physical.temperature", "physical.fill_level", "physical.voltage", "classification.thresholds", "rule.physical_to_state"], {
          type: "state_rows",
          title: "Messwert, Schwelle und Zustand",
          rows: [
            {
              label: "Stein: Temperatur",
              description: "Messbar mit PT1000 oder IR-Sensor. Schwellen: unter 10 Grad kalt, ab 10 Grad warm, ab 55 Grad heiss.",
              states: [
                { label: "unter 10 Grad", kind: "stone", tone: "cold", value: "Zustand = kalt" },
                { label: "10 bis unter 55 Grad", kind: "stone", tone: "warm", value: "Zustand = warm" },
                { label: "ab 55 Grad", kind: "stone", tone: "hot", value: "Zustand = heiss" },
              ],
            },
            {
              label: "Regentonne: Fuellstand",
              description: "Erfassbar mit Reedkontakten, Kamera oder Schwimmer mit Seillaenge.",
              states: [
                { label: "niedrig", kind: "barrel", level: 10, value: "Zustand = leer" },
                { label: "mittel", kind: "barrel", level: 50, value: "Zustand = halb voll" },
                { label: "hoch", kind: "barrel", level: 100, value: "Zustand = voll" },
              ],
            },
            {
              label: "Akku: Spannung",
              description: "Der Ladezustand kann vereinfacht ueber die Spannung erfasst werden.",
              states: [
                { label: "niedrige Spannung", kind: "battery", level: 8, value: "Zustand = leer" },
                { label: "mittlere Spannung", kind: "battery", level: 50, value: "Zustand = halb voll" },
                { label: "hohe Spannung", kind: "battery", level: 100, value: "Zustand = voll" },
              ],
            },
            {
              label: "Notensystem: Punktzahl",
              description: "Eine Punktzahl wird durch Grenzen in eine Note von 1 bis 6 uebersetzt.",
              states: [
                { label: "wenige Punkte", kind: "label", value: "Note 6" },
                { label: "mittlere Punkte", kind: "label", value: "Note 3" },
                { label: "viele Punkte", kind: "label", value: "Note 1" },
              ],
            },
          ],
        }),
        tamagotchiStorySlide("state-machine-concept", "Aus Zustaenden wird eine State Machine", "Jetzt haben wir die Grundlagen zusammen: Zustaende, Transitionen und Bedingungen bilden eine Zustandsmaschine.", ["state_machine.states", "state_machine.transitions", "state_machine.conditions"], {
          type: "cycle",
          title: "Regentonnen-Zustandskreislauf",
          states: [
            { label: "Tonne leer", kind: "barrel", level: 0 },
            { label: "Tonne voll", kind: "barrel", level: 100 },
          ],
          transitions: [
            { label: "Regen" },
            { label: "Giessen" },
          ],
        }),
        {
          id: "plantuml-model",
          type: "plantuml",
          title: "Eine State Machine mit PlantUML beschreiben",
          summary: "Jetzt schreiben wir die Tamagotchi-Zustandsmaschine als PlantUML. Zustaende stehen als Text, Transitionen werden mit Pfeilen und Bedingungen beschrieben.",
          completion: { type: "acknowledge", label: "Diagramm verstanden" },
          validation: { type: "plantuml_contains", must_contain: ["satt --> hungrig", "hungrig --> satt", "hungrig --> tot"] },
          payload: {
            source: tamagotchiPlantUmlBaseSource(),
            highlight_lines: [13, 14, 17, 18, 22, 23, 24, 25],
            model_lines: ["state_machine.plantuml", "state_machine.tamagotchi_machine", "state_machine.machine_readable"]
              .map((lineId) => tamagotchiModelLines()[lineId])
              .filter(Boolean),
          },
        },
        tamagotchiStorySlide("runtime-independent", "Modell ist runtime-unabhaengig", "Das gleiche Modell kann spaeter Browser-App oder Embedded-App antreiben.", ["runtime.choice", "runtime.browser_app", "runtime.embedded", "runtime.same_model_core"]),
        tamagotchiStorySlide("browser-first", "Browser App zuerst", "Der erste sichtbare Lauf soll schnell im Browser funktionieren, ohne Board und ohne Flashen.", ["lesson.browser_advantages", "lesson.browser_disadvantages", "behavior.event_driven_first"]),
        tamagotchiStorySlide("state-machine-next", "Zeitgesteuerte State-Machine folgt", "Im naechsten Schritt kommen Tick, Speicherung und Wiederherstellung dazu.", ["behavior.time_driven_next", "persistence.browser_storage"]),
        tamagotchiStorySlide("next-runtime-apps", "Weitere Runtime-Apps", "Embedded bleibt ein spaeterer Runtime-Pfad, nicht der Startpunkt dieses Projekts.", ["runtime.same_model_core", "runtime.embedded"]),
      ],
    };
  }

  return {
    schema_version: 1,
    title: `${project.title} Projektansicht`,
    summary: project.summary,
    primary_source_path: primarySourcePath(project),
    mode: "guided_ide",
    views: [
      {
        id: "source-analysis",
        type: "source_analysis",
        title: "Quellcode analysieren",
        summary: "Primaere Projektdatei lesen, verstehen und bearbeiten.",
        source_path: primarySourcePath(project),
      },
      {
        id: "implementation-plan",
        type: "implementation_plan",
        title: "Naechste Schritte",
        summary: "Projektmanifest kann spaeter weitere Erklaerungen, Diagramme und Pruefungen enthalten.",
        payload: {
          tasks: project.steps.map((item) => item.title),
        },
      },
    ],
  };
}

function tamagotchiStorySlide(id, title, summary, modelLineIds, artifact = null) {
  return {
    id,
    type: "story_slide",
    title,
    summary,
    completion: { type: "acknowledge", label: "Verstanden" },
    payload: {
      artifact,
      model_lines: modelLineIds.map((lineId) => tamagotchiModelLines()[lineId]).filter(Boolean),
    },
  };
}

function tamagotchiCodeExcerpt() {
  return [
    "typedef enum {",
    "  TAMA_LIFE_ALIVE,",
    "  TAMA_LIFE_DEAD",
    "} TamaLife;",
    "",
    "typedef enum {",
    "  TAMA_HUNGER_SATIATED,",
    "  TAMA_HUNGER_HUNGRY,",
    "  TAMA_HUNGER_STARVING",
    "} TamaHungerState;",
    "",
    "typedef struct {",
    "  uint8_t hunger;",
    "  uint8_t thirst;",
    "  uint8_t energy;",
    "  uint8_t happiness;",
    "  uint8_t hygiene;",
    "  uint8_t health;",
    "} TamaNeeds;",
    "",
    "typedef struct {",
    "  TamaLife life;",
    "  TamaHungerState hunger_state;",
    "  TamaNeeds needs;",
    "  uint32_t last_tick_second;",
    "  uint32_t last_fed_second;",
    "  bool dirty;",
    "} Tama;",
    "",
    "static void recompute_states(void) {",
    "  if (tama.needs.hunger >= 100 || tama.needs.health == 0) {",
    "    tama.life = TAMA_LIFE_DEAD;",
    "    return;",
    "  }",
    "",
    "  if (tama.needs.hunger >= 50) {",
    "    tama.hunger_state = TAMA_HUNGER_HUNGRY;",
    "  } else {",
    "    tama.hunger_state = TAMA_HUNGER_SATIATED;",
    "  }",
    "}",
  ].join("\n");
}

async function hardwareCatalogJson(pathname, options = {}) {
  const response = await fetch(`${hardwareCatalogBaseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Hardware Catalog request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function tamagotchiPlantUmlBaseSource() {
  return [
    "@startuml",
    "title Tamagotchi State-Machine",
    "",
    "hide empty description",
    "",
    "skinparam shadowing false",
    "skinparam state {",
    "  BackgroundColor #fbfdff",
    "  BorderColor #9db0ca",
    "  FontColor #08142b",
    "  FontStyle bold",
    "}",
    "",
    "state \"lebendig\" as lebendig {",
    "  state \"satt\" as satt",
    "  state \"hungrig\" as hungrig",
    "}",
    "",
    "state \"tot\" as tot #fff7f7",
    "",
    "note right of lebendig",
    "  Initialwerte",
    "  Hunger = 45",
    "end note",
    "",
    "[*] --> lebendig",
    "satt --> hungrig : Hunger >= 50",
    "hungrig --> satt : fuettern",
    "hungrig --> tot : Hunger = 100",
    "@enduml",
  ].join("\n");
}

function tamagotchiModelLines() {
  return {
    "problem.code_is_not_explanation": {
      label: "Problem",
      text: "Quellcode zeigt viele Details auf einmal. Daraus erkennt man nicht sofort, wann das Tamagotchi lebt, satt, hungrig oder tot ist.",
    },
    "state.simple_examples": {
      label: "Einfache Zustaende",
      text: "Regentonne und Akku koennen zuerst einfach als leer, halb voll oder voll beschrieben werden.",
    },
    "state.discrete": {
      label: "Direkte Zustaende",
      text: "Manche Zustaende sind direkt definiert, zum Beispiel an oder aus, vorhanden oder nicht vorhanden.",
    },
    "state.continuous": {
      label: "Fliessende Eigenschaften",
      text: "Andere Eigenschaften veraendern sich stufenlos, zum Beispiel Temperatur, Punktzahl oder Fuellstand.",
    },
    "state.binary": {
      label: "Binaer",
      text: "Bei genau zwei Zustaenden spricht man von binaer, zum Beispiel an oder aus.",
    },
    "state.presence": {
      label: "Vorhandenheit",
      text: "Ein Objekt kann vorhanden oder nicht vorhanden sein.",
    },
    "state.substates": {
      label: "Unterzustaende",
      text: "Ein Oberzustand kann Unterzustaende enthalten, zum Beispiel an mit aufheizend und bereit.",
    },
    "classification.thresholds": {
      label: "Klassifizierung",
      text: "Durch Grenzen werden aus fliessenden Werten benannte Zustaende, zum Beispiel kalt, warm, heiss oder Note 1 bis 6.",
    },
    "physical.temperature": {
      label: "Temperatur",
      text: "Beim Stein ist Temperatur die messbare physikalische Groesse. Sie kann zum Beispiel mit PT1000 oder IR-Sensor erfasst werden.",
    },
    "physical.fill_level": {
      label: "Fuellstand",
      text: "Bei der Regentonne ist der Fuellstand die relevante physikalische Eigenschaft.",
    },
    "physical.voltage": {
      label: "Spannung",
      text: "Beim Akku kann der Ladezustand vereinfacht ueber die Spannung erfasst werden.",
    },
    "rule.physical_to_state": {
      label: "Regel",
      text: "Aus einem Messwert wird durch einfache Regeln ein Zustand, zum Beispiel unter 10 Grad kalt, ab 10 Grad warm und ab 55 Grad heiss.",
    },
    "state_machine.states": {
      label: "States",
      text: "Eine State Machine besteht aus benannten Zustaenden, zum Beispiel Tonne leer und Tonne voll.",
    },
    "state_machine.transitions": {
      label: "Transitionen",
      text: "Transitionen beschreiben, wie ein System von einem State in den naechsten State wechselt, zum Beispiel durch Regen oder Giessen.",
    },
    "state_machine.conditions": {
      label: "Bedingungen",
      text: "Eine Transition hat oft eine Bedingung, zum Beispiel Hunger >= 50 macht satt zu hungrig.",
    },
    "state_machine.plantuml": {
      label: "PlantUML",
      text: "PlantUML beschreibt das Diagramm mit Text. Dadurch koennen KI und andere Werkzeuge das Modell gezielt lesen.",
    },
    "state_machine.tamagotchi_machine": {
      label: "Tamagotchi-State-Machine",
      text: "Das Tamagotchi hat den Oberzustand lebendig mit den Unterzustaenden satt und hungrig sowie den Zustand tot.",
    },
    "state_machine.machine_readable": {
      label: "Maschinenlesbar",
      text: "Aus einer praezisen PlantUML-Beschreibung kann spaeter gezielter Code fuer Browser App oder Embedded Runtime erzeugt werden.",
    },
    "model.runtime_independent": {
      label: "Runtime-unabhaengig",
      text: "Das Modell beschreibt das Tamagotchi, nicht Browser, Embedded, Build-System oder Hardwaredetails.",
    },
    "state.life": {
      label: "Leben",
      text: "Das Tamagotchi ist entweder alive oder dead. Nach Programmstart ist es alive.",
    },
    "state.alive_substates": {
      label: "Unterzustand von alive",
      text: "Wenn alive gilt, ist das Tamagotchi entweder hungry oder satt.",
    },
    "value.hunger": {
      label: "Hunger",
      text: "Hunger ist eine Skala von 0 bis 100. Der Startwert ist 55.",
    },
    "rule.satt": {
      label: "Regel satt",
      text: "Wenn Hunger unter 50 ist, wechselt der Unterzustand zu satt.",
    },
    "action.feed": {
      label: "Aktion fuettern",
      text: "Fuettern setzt Hunger auf 0 und merkt sich den Fuetterzeitpunkt.",
    },
    "display.multiple_states": {
      label: "Gleichzeitige Zustaende",
      text: "Hungry, tired oder dirty koennen gleichzeitig wahr sein. Das Modell darf diese Wahrheiten nicht kuenstlich zu genau einem Zustand zusammenpressen.",
    },
    "display.priority": {
      label: "Prioritaet",
      text: "Eine Prioritaet ist eine Anzeigeentscheidung: dead ist wichtiger als hungry, hungry wichtiger als tired.",
    },
    "display.visible_state": {
      label: "Sichtbarer Zustand",
      text: "Der sichtbare Zustand ist nicht das ganze Modell, sondern die gerade wichtigste Information fuer den Nutzer.",
    },
    "runtime.choice": {
      label: "Runtime-Auswahl",
      text: "Der Lernende waehlt zwischen Browser App und Embedded. Das Modell bleibt gleich.",
    },
    "runtime.browser_app": {
      label: "Browser App",
      text: "Die erste erzeugte App laeuft schnell im Browser auf Mac, PC und Mobile.",
    },
    "runtime.embedded": {
      label: "Embedded",
      text: "Spaeter kann dasselbe Modell fuer ein Embedded Board erzeugt werden.",
    },
    "runtime.same_model_core": {
      label: "Gleicher Modellkern",
      text: "Browser App und Embedded unterscheiden sich technisch, aber nutzen denselben fachlichen Modellkern.",
    },
    "lesson.browser_advantages": {
      label: "Browser Vorteile",
      text: "Schnell starten, sofort beobachten, kein Board und kein Flashen noetig.",
    },
    "lesson.browser_disadvantages": {
      label: "Browser Nachteile",
      text: "Wenn nichts gespeichert wird, ist das Tamagotchi nach dem Schliessen des Browsers weg.",
    },
    "behavior.event_driven_first": {
      label: "Erste Version",
      text: "Anfangs veraendert sich das Tamagotchi nur durch Benutzerinteraktionen.",
    },
    "behavior.time_driven_next": {
      label: "Naechste Version",
      text: "Danach aktualisiert ein regelmaessiger Tick die State-Machine.",
    },
    "persistence.browser_storage": {
      label: "Speichern",
      text: "Der Zustand kann im Browser gespeichert und spaeter wieder geladen werden.",
    },
  };
}

function demoProjectSources(project) {
  if (project.slug === "arduino-atmel-bare-metal") {
    return [
      {
        path: "src/main.c",
        role: "base_runtime",
        content: [
          "#include <avr/io.h>",
          "#include \"user/user_app.h\"",
          "",
          "int main(void) {",
          "  user_setup();",
          "",
          "  while (1) {",
          "    user_loop();",
          "  }",
          "}",
          "",
        ].join("\n"),
      },
      {
        path: "include/user/user_app.h",
        role: "header",
        content: [
          "#pragma once",
          "",
          "void user_setup(void);",
          "void user_loop(void);",
          "",
        ].join("\n"),
      },
      {
        path: primarySourcePath(project),
        role: "user_code",
        content: demoProjectSource(project),
      },
    ];
  }

  return [{
    path: primarySourcePath(project),
    role: "user_code",
    content: demoProjectSource(project),
  }];
}

function demoProjectSource(project) {
  if (project.slug === "software-engineering-tamagotchi") {
    return readWorkspaceText("model/tamagotchi/model.yaml");
  }

  if (project.slug === "arduino-blink") {
    return [
      "#include <Arduino.h>",
      "",
      "const int blinkPin = LED_BUILTIN;",
      "",
      "void setup() {",
      "  pinMode(blinkPin, OUTPUT);",
      "}",
      "",
      "void loop() {",
      "  digitalWrite(blinkPin, HIGH);",
      "  delay(500);",
      "  digitalWrite(blinkPin, LOW);",
      "  delay(500);",
      "}",
      "",
    ].join("\n");
  }

  if (project.slug === "arduino-atmel-bare-metal") {
    return [
      "#include <avr/io.h>",
      "#include <util/delay.h>",
      "",
      "void user_setup(void) {",
      "  DDRB |= _BV(DDB5);",
      "}",
      "",
      "void user_loop(void) {",
      "  PORTB ^= _BV(PORTB5);",
      "  _delay_ms(250);",
      "}",
      "",
    ].join("\n");
  }

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

function readWorkspaceText(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

function isUsbFlashDevice(device) {
  if (device.connectivity_status === "offline") return false;
  return device.device_id === "device_verified_1"
    || device.device_id === "device_arduino_nano_1"
    || (device.hardware_profile_id || "").includes("arduino_nano")
    || (device.hardware_profile_id || "").includes("esp32");
}

function defaultUploadPort(device) {
  if (!isUsbFlashDevice(device)) return "";
  if (device.device_id === "device_arduino_nano_1") {
    return process.env.GERNETIX_NANO_UPLOAD_PORT || process.env.GERNETIX_USB_UPLOAD_PORT || process.env.UPLOAD_PORT || "";
  }
  return process.env.GERNETIX_USB_UPLOAD_PORT || process.env.UPLOAD_PORT || "";
}

async function listUsbSerialPorts() {
  if (process.platform !== "win32") return [];
  const script = [
    "$items = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object {",
    "  $port = if ($_.Name -match '(COM\\d+)') { $Matches[1] } else { '' }",
    "  [pscustomobject]@{",
    "    port = $port;",
    "    name = $_.Name;",
    "    device_id = $_.DeviceID;",
    "    manufacturer = $_.Manufacturer;",
    "    pnp_class = $_.PNPClass;",
    "    status = $_.Status",
    "  }",
    "}",
    "$items | ConvertTo-Json -Compress",
  ].join("\n");

  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .map((item) => ({
        port: String(item.port || "").trim(),
        name: String(item.name || "").trim(),
        device_id: String(item.device_id || "").trim(),
        manufacturer: String(item.manufacturer || "").trim(),
        pnp_class: String(item.pnp_class || "").trim(),
        status: String(item.status || "").trim(),
      }))
      .filter((item) => item.port);
  } catch {
    return listUsbSerialPortsFromMode();
  }
}

async function listUsbSerialPortsFromMode() {
  try {
    const { stdout } = await execFileAsync("cmd.exe", ["/c", "mode"], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    return Array.from(new Set(Array.from(stdout.matchAll(/\bCOM\d+\b/gi)).map((match) => match[0].toUpperCase())))
      .map((port) => ({
        port,
        name: `${port} serieller Port`,
        device_id: "",
        manufacturer: "",
        pnp_class: "Ports",
        status: "OK",
      }));
  } catch {
    return [];
  }
}

function deviceBuildConfig(device) {
  if (device.device_id === "device_arduino_nano_1" || (device.hardware_profile_id || "").includes("arduino_nano")) {
    return {
      environment: "uno",
      platform: "atmelavr",
      board: "uno",
      framework: "arduino",
      monitorSpeed: "9600",
    };
  }
  return {
    environment: "esp32dev",
    platform: "espressif32",
    board: "esp32dev",
    framework: "arduino",
  };
}

function buildTargetLabel(device) {
  const config = deviceBuildConfig(device);
  return [config.platform, config.board, config.framework || "ohne Framework"].join("/");
}

function renderPlatformioIni(config) {
  const lines = [
    `[env:${config.environment}]`,
    `platform = ${config.platform}`,
    `board = ${config.board}`,
    `monitor_speed = ${config.monitorSpeed || "115200"}`,
  ];
  if (config.framework) lines.splice(3, 0, `framework = ${config.framework}`);
  if (config.uploadSpeed) lines.push(`upload_speed = ${config.uploadSpeed}`);
  lines.push("");
  return lines.join("\n");
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

function normalizeAppPath(pathname) {
  const stripped = pathname.replace(/^\/app\/?/, "/");
  if (stripped === "/" || stripped === "") return "/index.html";
  if (/^\/auth\/?$/.test(stripped)) return "/auth/index.html";
  if (/^\/(auth|dashboard|learn|ide|projects|devices|builds|billing)\/?$/.test(stripped)) return "/index.html";
  return stripped;
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

async function handleDevLessonPreviewMigration(req, res) {
  const body = await readJsonBody(req);
  const slug = String(body.slug || "").trim();
  const projectId = String(body.project_id || body.projectId || `project_${slug}`).trim();
  const manifest = body.view_manifest || body.viewManifest;

  if (!slug || !projectId || !manifest || typeof manifest !== "object") {
    sendDevJson(res, 400, {
      error: "invalid_lesson_preview_payload",
      message: "slug, project_id und view_manifest werden benoetigt.",
    });
    return;
  }

  const normalizedManifest = {
    schema_version: manifest.schema_version || 1,
    title: String(manifest.title || ""),
    summary: String(manifest.summary || ""),
    primary_source_path: String(manifest.primary_source_path || manifest.primarySourcePath || "model/lesson.json"),
    hide_source_editor: manifest.hide_source_editor !== false,
    mode: manifest.mode || "guided_ide",
    views: Array.isArray(manifest.views) ? manifest.views : [],
  };

  userIdeState.lessonManifestOverrides.set(slug, normalizedManifest);

  let projectServerUpdated = false;
  let projectServerError = "";
  try {
    await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: {
        view_manifest: normalizedManifest,
        build_config: null,
      },
    });
    projectServerUpdated = true;
  } catch (error) {
    projectServerError = error.message || String(error);
  }

  sendDevJson(res, 200, {
    ok: true,
    slug,
    project_id: projectId,
    view_count: normalizedManifest.views.length,
    project_server_updated: projectServerUpdated,
    project_server_error: projectServerError,
    preview_url: `/app/ide/?project=${encodeURIComponent(projectId)}`,
  });
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

function sendDevJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(status === 204 ? "" : JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function authRoute(next = "/app/dashboard/") {
  return `/app/auth/?next=${encodeURIComponent(next)}`;
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
