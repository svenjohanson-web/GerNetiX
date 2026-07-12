const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { createDefaultIdentityModule, MockEmailService } = require("./index");
const { createAccountTransparencyFactory } = require("./dev/account-transparency");
const { createDeviceDiscoveryService } = require("./dev/device-discovery");
const { createDevelopmentAssistant } = require("./dev/development-assistant");
const { developmentProjectSources } = require("./dev/development-project-structure");
const { developmentProjectTemplate, templateArchitecturePlantUml, templateFirmwareSources } = require("./dev/development-project-templates");
const { createDevHardwareUtils } = require("./dev/hardware-utils");
const { createLlmConfigStore } = require("../../shared/llm-config");
const {
  authRoute,
  clearSessionCookie,
  normalizeAppPath,
  parseCookies,
  readJsonBody,
  redirect,
  sanitizeNextPath,
  sendDevJson,
  sendJson,
  serveStatic,
  setSessionCookie,
} = require("./dev/http-utils");
const { createDevServiceClients } = require("./dev/service-clients");
const { createTamagotchiEntryCourseModel } = require("./dev/project-models/tamagotchi-entry-course");
const { createSmartAssistantCourseModel } = require("./dev/project-models/smart-assistant-course");
const { defaultCatalogSeed } = require("../../hardware-catalog/src/seed");

const publicDir = path.join(__dirname, "..", "public");
const appDir = path.join(publicDir, "app");
const esptoolJsDir = path.join(__dirname, "..", "node_modules", "esptool-js");
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const usbSerialHelperDistDir = path.join(workspaceRoot, "tools", "usb-serial-helper", "dist");
const identityPersistenceBackend = process.env.IDENTITY_PERSISTENCE_BACKEND || "sqlite";
const identitySqlitePath = process.env.IDENTITY_SQLITE_PATH || path.join(workspaceRoot, ".runtime", "gernetix-identity.sqlite");
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
const aiContextBaseUrl = process.env.AI_CONTEXT_BASE_URL || "http://127.0.0.1:5500";
const adminToolBaseUrl = process.env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:3b";
const deviceDiscoveryUrls = process.env.GERNETIX_DEVICE_DISCOVERY_URLS || process.env.DEVICE_DISCOVERY_URLS || "";
const gernetixNodeHostnamePrefix = "gernetix-";
const execFileAsync = promisify(execFile);
const {
  aiContextJson,
  aiUsageJson,
  buildDeployJson,
  deviceManagementJson,
  hardwareCatalogJson,
  hardwareShopJson,
  projectServerJson,
} = createDevServiceClients({
  aiContextBaseUrl,
  aiUsageBaseUrl,
  buildDeployBaseUrl,
  deviceManagementBaseUrl,
  hardwareCatalogBaseUrl,
  hardwareShopBaseUrl,
  projectServerBaseUrl,
});
const {
  buildTargetLabel,
  createGerNetixSerialNumber,
  defaultUploadPort,
  deviceBuildConfig,
  findProcessorBoard,
  isUsbFlashDevice,
  listUsbSerialPorts,
  loadProcessorBoards,
  normalizeGerNetixNodeName,
  renderPlatformioIni,
  requiredField,
} = createDevHardwareUtils({
  defaultCatalogSeed,
  execFileAsync,
  hardwareCatalogJson,
});
const createAccountTransparency = createAccountTransparencyFactory({
  aiUsageJson,
  demoEmail,
  demoUsername,
  deviceManagementJson,
  hardwareShopJson,
  projectServerJson,
  projectServerUserId,
});
const tamagotchiEntryCourseModel = createTamagotchiEntryCourseModel({ readWorkspaceText });
const smartAssistantCourseModel = createSmartAssistantCourseModel();
const llmConfigStore = createLlmConfigStore({
  configPath: path.join(workspaceRoot, ".runtime", "identity-llm-config.json"),
  defaultOllamaBaseUrl: ollamaBaseUrl,
  defaultOllamaModel: ollamaModel,
});
const { discoverNetworkDevices } = createDeviceDiscoveryService({
  deviceDiscoveryUrls,
  deviceManagementJson,
  loadUserIdeDevices,
  normalizeCapabilityIds,
  nodeHostnamePrefix: gernetixNodeHostnamePrefix,
});
const developmentAssistant = createDevelopmentAssistant({
  aiContextJson,
  aiUsageJson,
  hardwareCatalogJson,
  llmConfigStore,
  projectServerUserId,
  readJsonBody,
  requireProjectAccess: requireSessionProject,
  sendJson,
});
const builtInDemoAccounts = [
  { user_id: "acct-demo", username: demoUsername, email: demoEmail, password: demoPassword },
];

const emailService = new MockEmailService({ log() {} });
const auth = createDefaultIdentityModule({
  emailService,
  persistenceBackend: identityPersistenceBackend,
  sqlitePath: identitySqlitePath,
  appBaseUrl: `http://${host}:${port}`,
});
const sessions = new Map();
const userIdeState = createUserIdeState();

async function bootstrap() {
  await seedDemoAccount();

  const server = http.createServer((req, res) => {
    routeRequest(req, res).catch((error) => {
      console.error(error);
      sendJson(res, error.status || 500, {
        error: error.code || "internal_server_error",
        message: error.message || "Interner Serverfehler.",
      });
    });
  });

  server.listen(port, host, () => {
  console.log(`Identity login UI: http://${host}:${port}/app/auth/`);
  console.log(`GerNetiX Dashboard+: http://${host}:${port}/app/dashboard/`);
  console.log(`Project Server adapter: ${projectServerBaseUrl}`);
  console.log(`Build & Deploy adapter: ${buildDeployBaseUrl}`);
  console.log(`Hardware Shop adapter: ${hardwareShopBaseUrl}`);
  console.log(`Hardware Catalog adapter: ${hardwareCatalogBaseUrl}`);
  console.log(`Device Management adapter: ${deviceManagementBaseUrl}`);
  console.log(`AI Usage adapter: ${aiUsageBaseUrl}`);
  console.log(`AI Context adapter: ${aiContextBaseUrl}`);
  console.log(`Identity persistence: ${identityPersistenceBackend}${identityPersistenceBackend === "sqlite" ? ` (${identitySqlitePath})` : ""}`);
  const llmConfig = llmConfigStore.publicConfig();
  console.log(`Development Platform LLM: ${llmConfig.baseUrl} (${llmConfig.model})`);
  });
}

async function seedDemoAccount() {
  for (const account of builtInDemoAccounts) {
    try {
      const beforeCount = emailService.sentMessages.length;
      await auth.register_local(account.username, account.email, account.password, true, account.password, {
        user_id: account.user_id,
      });
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

  if (req.method === "POST" && url.pathname === "/api/register") {
    await handleRegister(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login/external") {
    await handleExternalLogin(req, res);
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

  if (url.pathname === "/api/platform/downloads" && req.method === "GET") {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, { downloads: usbSerialHelperDownloads() });
    return;
  }

  if (url.pathname.startsWith("/downloads/usb-serial-helper/") && req.method === "GET") {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    serveUsbSerialHelperDownload(res, path.basename(url.pathname));
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

  if (req.method === "POST" && url.pathname === "/api/platform/development-projects") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleDevelopmentProjectCreate(req, res, session);
    return;
  }

  const developmentProjectArchitecture = url.pathname.match(/^\/api\/platform\/development-projects\/([^/]+)\/architecture$/);
  if (req.method === "POST" && developmentProjectArchitecture) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleDevelopmentProjectArchitectureSave(req, res, session, decodeURIComponent(developmentProjectArchitecture[1]));
    return;
  }

  const projectDeviceAllocation = url.pathname.match(/^\/api\/user-ide\/projects\/([^/]+)\/device-allocation$/);
  if (req.method === "POST" && projectDeviceAllocation) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleProjectDeviceAllocation(req, res, session, decodeURIComponent(projectDeviceAllocation[1]));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/development-assistant/chat") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await developmentAssistant.handleChat(req, res, session);
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

  const connectivityCheck = url.pathname.match(/^\/api\/user-ide\/devices\/([^/]+)\/connectivity-check$/);
  if (req.method === "POST" && connectivityCheck) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleDeviceConnectivityCheck(res, session, decodeURIComponent(connectivityCheck[1]));
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
  const platformSources = url.pathname.match(/^\/api\/platform\/projects\/([^/]+)\/sources$/);
  if (platformSources && req.method === "GET") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformSourceList(res, session, decodeURIComponent(platformSources[1]));
    return;
  }

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

  if (req.method === "POST" && url.pathname === "/api/user-ide/device-recovery/check-firmware") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleDeviceRecoveryFirmwareCheck(req, res, session);
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

  const browserFlashResult = url.pathname.match(/^\/api\/user-ide\/build-jobs\/([^/]+)\/browser-usb-flash-result$/);
  if (req.method === "POST" && browserFlashResult) {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    const jobId = decodeURIComponent(browserFlashResult[1]);
    const body = await readJsonBody(req);
    const existing = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}`);
    const updated = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}/result`, {
      method: "POST",
      body: {
        status: body.status === "succeeded" ? "succeeded" : "failed",
        build: {
          ...(existing.result?.build || {}),
          usb_flash: {
            requested: true,
            status: body.status === "succeeded" ? "succeeded" : "failed",
            runner: "web_serial",
            transport: "web_serial",
            chip_name: body.chip_name || "",
            error: body.error || "",
          },
        },
        deploy: existing.result?.deploy || null,
        logs: body.logs || [],
        error: body.status === "succeeded" ? null : { message: body.error || "Browser Web-Serial-Flash fehlgeschlagen." },
      },
    });
    sendJson(res, 200, updated);
    return;
  }

  const buildJobStatus = url.pathname.match(/^\/api\/user-ide\/build-jobs\/([^/]+)\/status$/);
  if (req.method === "GET" && buildJobStatus) {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    const jobId = decodeURIComponent(buildJobStatus[1]);
    const job = await buildDeployJson(`/api/build-jobs/${encodeURIComponent(jobId)}`);
    if (["succeeded", "failed"].includes(job.status)) await recordCompletedBuildJob(jobId, job);
    sendJson(res, 200, {
      build_job_id: jobId,
      build_deploy_job_id: jobId,
      status: job.status,
      flash_status: job.mode === "build_and_flash"
        ? (job.result?.deploy?.status || "nicht angefordert")
        : (job.result?.build?.usb_flash?.status || "nicht angefordert"),
      flash_manifest: browserFlashManifest(jobId, job),
      error: job.error?.message || "",
      build_log: job.error?.details?.build_log || job.result?.build?.log || "",
    });
    return;
  }

  const buildArtifact = url.pathname.match(/^\/api\/user-ide\/build-artifacts\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && buildArtifact) {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await proxyBuildArtifact(res, decodeURIComponent(buildArtifact[1]), decodeURIComponent(buildArtifact[2]));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/vendor/esptool-js/")) {
    serveVendorEsptool(res, url.pathname);
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

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  try {
    const beforeCount = emailService.sentMessages.length;
    const registered = await auth.register_local(
      body.username,
      body.email,
      body.password,
      body.accepted_terms === true,
      body.password_repeat,
    );
    const verification = emailService.sentMessages
      .slice(beforeCount)
      .find((message) => message.type === "verification");
    const token = verification ? new URL(verification.link).searchParams.get("token") : "";
    if (token) await auth.verify_email(token);
    const login = await auth.login_local(body.email, body.password);
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 201, {
      account: login.account,
      next: sanitizeNextPath(body.next) || "/app/dashboard/",
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "registration_failed",
      message: registrationMessage(error),
    });
  }
}

async function handleExternalLogin(req, res) {
  const body = await readJsonBody(req);
  const provider = String(body.provider || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const username = String(body.username || "").trim();
  try {
    if (!provider) throw new Error("provider_required");
    if (!email) throw new Error("email_required");
    const login = await auth.login_external(provider, {
      provider,
      provider_user_id: body.provider_user_id || `${provider}:${email}`,
      email,
      email_verified: body.email_verified !== false,
      username: username || email.split("@")[0],
    });
    if (!login.session) {
      sendJson(res, 202, {
        account: login.account,
        requires_email_verification: true,
        message: "Account erstellt, E-Mail-Verifizierung erforderlich.",
      });
      return;
    }
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, {
      account: login.account,
      provider,
      next: sanitizeNextPath(body.next) || "/app/dashboard/",
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "external_login_failed",
      message: externalLoginMessage(error),
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
  const serviceStatus = {};
  const projects = await loadUserIdeProjects(session).then((items) => {
    serviceStatus.project_server = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.project_server = { ok: false, error: error.message || String(error) };
    return [];
  });
  const devices = await loadUserIdeDevices(session).then((items) => {
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
  });
  const builds = await loadProjectBuilds(projects, session).then((items) => {
    serviceStatus.builds = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.builds = { ok: false, error: error.message || String(error) };
    return [];
  });
  const aiUsage = await loadAiUsageSummary(session).then((summary) => {
    serviceStatus.ai_usage = { ok: summary.available !== false };
    return summary;
  }).catch((error) => {
    serviceStatus.ai_usage = { ok: false, error: error.message || String(error) };
    return null;
  });
  const userId = projectServerUserId(session);
  sendJson(res, 200, {
    account: await createAccountSummary(session),
    routes: {
      auth: "/app/auth/",
      dashboard: "/app/dashboard/",
      learn: "/app/learn/",
      ide: "/app/ide/",
      projects: "/app/projects/",
      development_platform: "/app/development-platform/",
      devices: "/app/device-management/inventory/",
      builds: "/app/builds/",
      billing: "/app/billing/",
    },
    workspace_state: getWorkspaceState(userId),
    development_assistant: developmentAssistant.config(),
    projects: projects.map(toPlatformProject),
    learning_progress: listLearningProgress(userId, projects),
    devices,
    builds,
    billing: await loadBillingSummary(session, aiUsage),
    ai_usage: aiUsage,
    service_status: serviceStatus,
  });
}

function externalLoginMessage(error) {
  if (error.code === "email_already_exists_link_required") {
    return "Fuer diese E-Mail existiert bereits ein Konto. Automatisches Verknuepfen ist gesperrt.";
  }
  if (error.message === "provider_required") return "Provider fehlt.";
  if (error.message === "email_required") return "E-Mail fehlt.";
  return "Externe Anmeldung fehlgeschlagen.";
}

function registrationMessage(error) {
  if (error.code === "username_already_exists") return "Dieser Benutzername ist bereits vergeben.";
  if (error.code === "email_already_exists") return "Diese E-Mail wird bereits verwendet.";
  if (error.code === "password_repeat_mismatch") return "Die Passwoerter stimmen nicht ueberein.";
  if (error.code === "terms_not_accepted") return "Bitte akzeptiere die Nutzungsbedingungen.";
  if (error.code === "invalid_username") return "Der Benutzername muss mindestens 3 Zeichen enthalten.";
  if (error.code === "invalid_email") return "Bitte gib eine gueltige E-Mail-Adresse ein.";
  return "Konto konnte nicht erstellt werden.";
}

function recordSystemEvent(event) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);
  fetch(`${adminToolBaseUrl.replace(/\/$/, "")}/api/admin/system-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    signal: controller.signal,
  })
    .catch((error) => {
      console.warn(`System event logging failed: ${error.message || error}`);
    })
    .finally(() => clearTimeout(timeout));
}

function recordDeviceInventoryFailure(session, eventType, error, context = {}) {
  recordSystemEvent({
    severity: "error",
    source_service: "identity_server",
    target_service: "device_management",
    category: "dependency",
    event_type: eventType,
    message: "Device-Inventarisierung konnte Device Management nicht erfolgreich nutzen.",
    impact: "Device konnte nicht ins Account-Inventar uebernommen, geladen oder entfernt werden.",
    account_id: projectServerUserId(session),
    route: context.route || "/app/device-management/inventory/",
    details: {
      dependency_base_url: deviceManagementBaseUrl,
      operation: context.operation || eventType,
      error: error.message || String(error),
      error_code: error.code || "",
      status: error.status || "",
      payload: error.payload || {},
    },
  });
}

async function handlePlatformSourceRead(res, session, projectId, sourcePath) {
  const project = await requireSessionProject(session, projectId);
  const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(sourcePath)}`);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, source);
}

async function handlePlatformSourceList(res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  const sources = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, sources);
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

async function handleDevelopmentProjectCreate(req, res, session) {
  const body = await readJsonBody(req);
  const userId = projectServerUserId(session);
  const template = developmentProjectTemplate(body.template_id);
  const title = requiredField(body.title || template.title || "Neues Entwicklungsprojekt", "title").slice(0, 120);
  const description = String(body.description || template.description || "Architektur-Discovery-Projekt").trim().slice(0, 1000);
  const projectId = `dev_project_${slugifyProjectId(title)}_${Date.now().toString(36)}`;
  const initialSource = templateArchitecturePlantUml(template, title) || initialArchitecturePlantUml(title);
  const sources = developmentProjectSources({ title, description, architectureSource: initialSource })
    .concat(templateFirmwareSources(template, title));
  const project = await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: userId,
      title,
      description,
      learning_project_id: "development_project",
      hardware_profile_id: template.hardwareProfileId || "architecture.discovery",
      device_id: null,
      build_config: template.buildConfig || null,
      view_manifest: developmentProjectViewManifest({ title, description, source: initialSource, buildConfig: template.buildConfig }),
      sources,
    },
  });
  touchWorkspace(session, project.project_id, "development-platform", "/app/development-platform/");
  sendJson(res, 201, { project: toPlatformProject(mapProjectServerProject(session, project)) });
}

async function handleDevelopmentProjectArchitectureSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Architektur-Discovery kann nur in eigenen Entwicklungsprojekten gespeichert werden." });
    return;
  }
  const body = await readJsonBody(req);
  const diagram = normalizeArchitectureDiagram(body.architectureDiagram || body.architecture_diagram || body.diagram);
  if (!diagram.source) {
    sendJson(res, 400, { error: "missing_diagram", message: "Keine PlantUML-Quelle zum Speichern vorhanden." });
    return;
  }
  const title = String(body.title || project.title || diagram.title || "Architektur").trim().slice(0, 120);
  const description = String(body.description || project.summary || diagram.summary || "").trim().slice(0, 1000);
  const sources = developmentProjectSources({ title, description, diagram, architectureSource: diagram.source });
  await Promise.all(sources.map((source) => projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
      method: "PUT",
      body: source,
    })));
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      title,
      description,
      view_manifest: developmentProjectViewManifest({ title, description, source: diagram.source, diagram, buildConfig: project.build_config }),
      build_config: project.build_config || null,
    },
  });
  touchWorkspace(session, project.project_server_id, "development-platform", "/app/development-platform/");
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, { project: toPlatformProject(updated), saved_at: new Date().toISOString() });
}

async function handleProjectDeviceAllocation(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  const body = await readJsonBody(req);
  const devices = await loadUserIdeDevices(session);
  const device = devices.find((item) => item.device_id === body.device_id);
  if (!device) {
    sendJson(res, 404, { error: "device_not_found", message: "Das Inventar-Device wurde nicht gefunden." });
    return;
  }
  const projectConfig = project.build_config || {};
  const deviceConfig = device.build_config || {};
  const componentPath = requiredField(body.component_path || primaryProjectComponentPath(project), "component_path");
  if (projectConfig.platform && deviceConfig.platform && projectConfig.platform !== deviceConfig.platform) {
    sendJson(res, 409, { error: "device_not_compatible", message: "Das Device ist nicht mit dem Build-Ziel des Projektordners kompatibel." });
    return;
  }
  const allocatedAt = new Date().toISOString();
  const allocations = (Array.isArray(projectConfig.component_device_allocations) ? projectConfig.component_device_allocations : [])
    .filter((item) => item.component_path !== componentPath)
    .concat({ component_path: componentPath, device_id: device.device_id, allocated_at: allocatedAt });
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      device_id: device.device_id,
      hardware_profile_id: device.hardware_profile_id || project.hardware_profile_id,
      build_config: { ...resolveBuildConfig(project, device), component_device_allocations: allocations },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, {
    project: toPlatformProject(updated),
    device,
    allocation: {
      component_path: componentPath,
      device_id: device.device_id,
      allocated_at: allocatedAt,
    },
  });
}

function primaryProjectComponentPath(project) {
  return String(project?.build_config?.user_source_path || "").match(/^(Komponenten\/[^/]+)\//)?.[1] || "Komponenten/ESP32";
}

async function handlePlatformDeviceCreate(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const hardwareProfileId = requiredField(body.hardware_profile_id, "hardware_profile_id");
    const serialNumber = String(body.serial_number || "").trim() || createGerNetixSerialNumber(hardwareProfileId);
    const displayName = requiredField(body.display_name || serialNumber, "display_name");
    const nodeName = normalizeGerNetixNodeName(body.node_name || body.board_short_name || displayName);
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
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    sendJson(res, 201, decorateUserIdeDevice(accountDevice));
  } catch (error) {
    recordDeviceInventoryFailure(session, "device_inventory_create_failed", error, {
      operation: "handlePlatformDeviceCreate",
      route: "/app/device-management/inventory/",
    });
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
    const hardwareProfileId = requiredField(body.hardware_profile_id || body.hardwareProfileId, "hardware_profile_id");
    const serialNumber = String(body.serial_number || body.serialNumber || "").trim() || createGerNetixSerialNumber(hardwareProfileId);
    const displayName = requiredField(body.display_name || body.displayName || serialNumber, "display_name");
    const nodeName = normalizeGerNetixNodeName(body.node_name || body.board_short_name || body.hostname || displayName);
    const capabilities = normalizeCapabilityIds(body.technical_capability_ids || body.capability_ids || body.capabilities || []);
    const registered = await deviceManagementJson("/api/device-management/devices/register", {
      method: "POST",
      body: {
        device_id: discoveredDeviceId || undefined,
        serial_number: serialNumber,
        hardware_profile_id: hardwareProfileId,
        authenticity_status: body.authenticity_status || body.authenticityStatus || "gernetix_verified_pending_proof",
        lifecycle_state: "discovered_by_user_ide",
        connectivity_status: body.connectivity_status || body.connectivityStatus || "online",
        ota_status: body.ota_status || body.otaStatus || (capabilities.includes("ota") ? "ready" : "unknown"),
        app_version: body.app_version || body.firmwareVersion || "",
        runtime_version: body.runtime_version || body.runtimeVersion || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    sendJson(res, 201, decorateUserIdeDevice(accountDevice));
  } catch (error) {
    recordDeviceInventoryFailure(session, "discovered_device_claim_failed", error, {
      operation: "handlePlatformDiscoveredDeviceClaim",
      route: "/app/device-management/inventory/",
    });
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
    recordDeviceInventoryFailure(session, "device_inventory_remove_failed", error, {
      operation: "handlePlatformDeviceRemove",
      route: "/app/device-management/inventory/",
    });
    sendJson(res, error.status || 400, {
      error: error.code || "device_inventory_remove_failed",
      message: error.message || "Device konnte nicht aus dem Inventar entfernt werden.",
      details: error.payload || {},
    });
  }
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

async function handleDeviceConnectivityCheck(res, session, deviceId) {
  const devices = await loadUserIdeDevices(session);
  const accountDevice = devices.find((device) => device.device_id === deviceId);
  if (!accountDevice) {
    sendJson(res, 404, { error: "device_not_in_account", message: "Das Device gehört nicht zum aktuellen Account." });
    return;
  }
  const discovery = await discoverNetworkDevices(session, { scope: "node" });
  const discovered = (discovery.items || []).find((device) => device.device_id === deviceId);
  if (!discovered) {
    sendJson(res, 200, {
      reachable: false,
      device_id: deviceId,
      checked_at: discovery.searched_at,
      message: `Das Board wurde über ${discovery.candidate_count || 0} lokale Adressen nicht erreicht.`,
    });
    return;
  }
  const status = await deviceManagementJson(`/api/device-management/devices/${encodeURIComponent(deviceId)}/connectivity/status`, {
    method: "POST",
    body: {
      connectivity_status: "online",
      ota_status: discovered.ota_status || accountDevice.ota_status,
      ota_hostname: discovered.hostname || "",
      last_seen_ip: new URL(discovered.source_url).hostname,
    },
  });
  sendJson(res, 200, {
    reachable: true,
    checked_at: discovery.searched_at,
    hostname: discovered.hostname,
    source_url: discovered.source_url,
    device: {
      ...accountDevice,
      connectivity_status: status.connectivity_status || "online",
      ota_status: status.ota_status || discovered.ota_status || accountDevice.ota_status,
    },
  });
}

async function handleUserIdeBuildJob(req, res) {
  const body = await readJsonBody(req);
  const session = readSession(req);
  const projects = await loadUserIdeProjects(session);
  const devices = await loadUserIdeDevices(session);
  const project = projects.find((item) => item.slug === body.project_slug);
  const device = devices.find((item) => item.device_id === body.device_id || item.account_device_id === body.device_id) || null;
  const mode = body.mode || "build";

  if (!project) {
    sendJson(res, 404, { error: "project_not_found", message: "Projekt wurde nicht gefunden." });
    return;
  }
  if (!device && mode !== "build") {
    sendJson(res, 404, { error: "device_not_found", message: "Device wurde nicht gefunden." });
    return;
  }
  if (mode === "build_and_flash" && device.ota_status !== "ready") {
    sendJson(res, 409, { error: "device_not_ota_ready", message: "Das ausgewaehlte Device ist nicht OTA-ready." });
    return;
  }
  if (mode === "build_and_flash" && device.connectivity_status !== "online") {
    sendJson(res, 409, {
      error: "device_not_online",
      message: `Das ausgewaehlte Device ist nicht online (${device.connectivity_status || "unknown"}). OTA wurde nicht gestartet.`,
    });
    return;
  }
  if (mode === "build_and_flash") {
    const otaPreflight = await buildDeployJson("/api/ota/preflight");
    if (!otaPreflight.ready) {
      const blockers = (otaPreflight.blockers || []).map((item) => item.message).filter(Boolean);
      sendJson(res, 409, {
        error: "ota_pipeline_not_ready",
        message: `OTA kann noch nicht gestartet werden: ${blockers.join(" ")}`,
        blockers: otaPreflight.blockers || [],
      });
      return;
    }
  }
  if (mode === "build_and_usb_flash" && !device.usb_flash_supported) {
    sendJson(res, 409, { error: "device_not_usb_flash_ready", message: "Das ausgewaehlte Device ist nicht fuer USB-Flash konfiguriert." });
    return;
  }

  const projectServerJob = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`, {
    method: "POST",
    body: {
      mode,
      device_id: device?.device_id || null,
      build_config: resolveBuildConfig(project, device || {}),
    },
  });
  const buildPackage = await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/build-package`);
  const buildDeployJob = await buildDeployJson("/api/build-jobs", {
    method: "POST",
    body: {
      job_id: projectServerJob.build_job_id,
      mode,
      project_id: project.project_server_id,
      device_id: device?.device_id || null,
      build_package: toBuildDeployPackage(buildPackage, device || {}, project),
      usb_flash: mode === "build_and_usb_flash" ? {
        upload_port: String(body.upload_port || device.upload_port || "").trim(),
      } : null,
      deploy: mode === "build_and_flash" ? {
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
    await recordCompletedBuildJob(projectServerJob.build_job_id, completedBuildDeployJob);
  }

  const build = {
    build_job_id: projectServerJob.build_job_id,
    build_deploy_job_id: buildDeployJob.job_id,
    project_server_id: project.project_server_id,
    project_slug: project.slug,
    project_title: project.title,
    device_id: device?.device_id || null,
    device_label: device?.display_name || "kein Device erforderlich",
    mode,
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
    flash_manifest: browserFlashManifest(projectServerJob.build_job_id, completedBuildDeployJob),
  };
  userIdeState.builds.unshift(build);
  touchWorkspace(session, project.project_server_id, body.mode === "learn" ? "learn" : "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 202, build);
}

async function recordCompletedBuildJob(jobId, completedJob) {
  return projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}/result`, {
    method: "POST",
    body: toProjectBuildResult(completedJob),
  });
}

function browserFlashManifest(jobId, completedJob) {
  const artifacts = completedJob?.result?.build?.artifacts || {};
  const definitions = [
    ["bootloader.bin", 0x1000],
    ["partitions.bin", 0x8000],
    ["boot_app0.bin", 0xe000],
    ["firmware.bin", 0x10000],
  ];
  return definitions.filter(([name]) => artifacts[name]).map(([name, address]) => ({
    name,
    address,
    url: `/api/user-ide/build-artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(name)}`,
    size_bytes: artifacts[name].size_bytes,
    sha256: artifacts[name].sha256,
  }));
}

async function proxyBuildArtifact(res, jobId, fileName) {
  const upstream = await fetch(`${buildDeployBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`);
  const content = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Content-Length": content.length,
    "Cache-Control": "no-store",
  });
  res.end(content);
}

function serveVendorEsptool(res, requestPath) {
  const relativePath = requestPath.replace(/^\/vendor\/esptool-js\//, "");
  const root = relativePath === "bundle.js" ? esptoolJsDir : path.join(esptoolJsDir, "lib");
  serveStatic(res, root, `/${relativePath}`);
}

async function handleDeviceRecoveryFirmwareCheck(req, res, session) {
  const body = await readJsonBody(req);
  const devices = await loadUserIdeDevices(session);
  const device = devices.find((item) => item.device_id === body.device_id);
  if (!device) {
    sendJson(res, 404, { error: "device_not_found", message: "Device wurde nicht gefunden." });
    return;
  }
  const mode = String(body.mode || "").trim().toLowerCase();
  if (!["usb", "ota"].includes(mode)) {
    sendJson(res, 400, { error: "invalid_recovery_mode", message: "Recovery Check muss usb oder ota verwenden." });
    return;
  }
  sendJson(res, 200, createFirmwareRecoveryCheck(device, mode, {
    upload_port: body.upload_port || "",
  }));
}

function createFirmwareRecoveryCheck(device, mode, input = {}) {
  const checks = [
    recoveryCheckItem("device_known", true, "Device ist dem Account zugeordnet."),
    recoveryCheckItem("board_profile", Boolean(device.build_config), device.build_config
      ? `Boardprofil erkannt: ${device.build_target_label || device.hardware_profile_id || "konfiguriert"}.`
      : "Kein Boardprofil fuer Firmware-Checks hinterlegt."),
  ];
  if (mode === "usb") {
    const port = String(input.upload_port || device.upload_port || "").trim();
    checks.push(
      recoveryCheckItem("usb_supported", Boolean(device.usb_flash_supported), device.usb_flash_supported
        ? "USB-Firmwarepfad wird fuer dieses Device unterstuetzt."
        : "Dieses Device ist nicht fuer USB-Firmwarechecks konfiguriert."),
      recoveryCheckItem("usb_port", Boolean(port), port
        ? `USB-Port: ${port}.`
        : "Kein USB-Port ausgewaehlt oder erkannt."),
    );
  } else {
    checks.push(
      recoveryCheckItem("ota_ready", device.ota_status === "ready", device.ota_status === "ready"
        ? "OTA ist fuer dieses Device bereit."
        : `OTA ist nicht bereit: ${device.ota_status || "unknown"}.`),
      recoveryCheckItem("network_reachable", device.connectivity_status === "online", device.connectivity_status === "online"
        ? `Verbindungsstatus: ${device.connectivity_status}.`
        : `Device ist nicht erreichbar: ${device.connectivity_status || "unknown"}.`),
    );
  }
  const ok = checks.every((item) => item.ok);
  return {
    check_id: `firmware_${mode}_${Date.now()}`,
    device_id: device.device_id,
    device_label: device.display_name,
    mode,
    status: ok ? "ready" : "blocked",
    summary: ok
      ? `Firmware-Check ueber ${mode.toUpperCase()} ist bereit.`
      : `Firmware-Check ueber ${mode.toUpperCase()} ist noch blockiert.`,
    checks,
    next_action: ok
      ? (mode === "usb" ? "USB-Firmwarecheck kann als Recovery-Schritt angeschlossen werden." : "OTA-Firmwarecheck kann als Recovery-Schritt angeschlossen werden.")
      : "Fehlende Voraussetzungen beheben, dann erneut pruefen.",
  };
}

function recoveryCheckItem(checkId, ok, message) {
  return {
    check_id: checkId,
    ok: Boolean(ok),
    status: ok ? "ok" : "blocked",
    message,
  };
}

async function loadUserIdeProjects(session) {
  const userId = projectServerUserId(session);
  await ensureProjectServerDemoProjects(session);
  const response = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}`);
  return mapUserIdeProjects(session, new Map(response.items.map((item) => [item.project_id, item])));
}

function mapUserIdeProjects(session, projectsById) {
  const userId = projectServerUserId(session);
  const workspace = getWorkspaceState(userId);
  const definitionIds = new Set(userIdeState.projectDefinitions.map((definition) => definition.project_server_id));
  const seededProjects = userIdeState.projectDefinitions.map((definition) => {
    const project = projectsById.get(definition.project_server_id);
    return {
      ...definition,
      owner_user_id: project ? project.user_id : userId,
      title: project ? project.title : definition.title,
      summary: project ? project.description : definition.summary,
      hardware_profile_id: definition.hardware_profile_id,
      build_config: Object.hasOwn(definition, "build_config") ? definition.build_config : project?.build_config,
      linked_device_id: definition.default_device_id || null,
      project_origin: "catalog",
      status: project ? project.status : "project_server_missing",
      last_build_status: latestBuildStatus(project),
      source_count: project ? project.source_count : 0,
      build_count: project ? project.build_count : 0,
      access_model: definition.access_model || "subscription",
      view_manifest: projectViewManifest(definition),
      created_at: project ? project.created_at : "",
      updated_at: project ? project.updated_at : "",
      last_opened_mode: workspace.lastProjectId === definition.project_server_id ? workspace.lastMode : "",
      last_opened_at: workspace.lastProjectId === definition.project_server_id ? workspace.updatedAt : "",
      source_files: definition.source_files || [{ path: "src/main.cpp", role: "user_code" }],
    };
  });
  const customProjects = Array.from(projectsById.values())
    .filter((project) => !definitionIds.has(project.project_id))
    .map((project) => mapProjectServerProject(session, project));
  return seededProjects.concat(customProjects)
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
}

function mapProjectServerProject(session, project) {
  const userId = projectServerUserId(session);
  const workspace = getWorkspaceState(userId);
  const manifest = project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.description,
    source: initialArchitecturePlantUml(project.title),
  });
  const primarySourcePath = manifest.primary_source_path || "docs/architecture.puml";
  return {
    project_server_id: project.project_id,
    slug: project.project_id,
    title: project.title,
    summary: project.description || "",
    area: project.learning_project_id === "development_project" ? "development_project" : "custom_project",
    project_origin: "account_project",
    course_id: "development",
    lesson_id: `architecture_${project.project_id}`,
    learning_project_id: project.learning_project_id || "",
    owner_user_id: project.user_id || userId,
    hardware_profile_id: project.hardware_profile_id || "architecture.discovery",
    build_config: project.build_config || null,
    linked_device_id: project.device_id || "",
    status: project.status || "active",
    last_build_status: latestBuildStatus(project),
    source_count: project.source_count || 0,
    build_count: project.build_count || 0,
    view_manifest: manifest,
    created_at: project.created_at || "",
    updated_at: project.updated_at || "",
    last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
    last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
    source_files: [{ path: primarySourcePath, role: "architecture_model" }],
    steps: [],
    required_capability_ids: [],
    access_model: "owned",
  };
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
    const response = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`).catch(() => ({ items: [] }));
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
    projectOrigin: project.project_origin || "account_project",
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
    accessModel: project.access_model || "subscription",
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

async function loadBillingSummary(session, existingAiUsage = null) {
  const aiUsage = existingAiUsage || await loadAiUsageSummary(session);
  return {
    account_id: projectServerUserId(session),
    plan: "Premium Demo",
    entitlements: ["learn_guided_projects", "ide_edit_code", "build_and_flash", "ai_assistant"],
    ai_credits: aiUsage.credits,
  };
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
    const [credits, rating, dashboard] = await Promise.all([
      aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`),
      aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/rating`),
      aiUsageJson("/api/ai-usage/admin/dashboard"),
    ]);
    return {
      base_url: aiUsageBaseUrl,
      available: true,
      credits,
      rating,
      usage_events: dashboard.summary,
      account_usage: (dashboard.by_account || []).find((item) => item.account_id === accountId) || null,
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
      rating: {
        account_id: accountId,
        used_percent: 0,
        sources: [],
      },
      usage_events: {},
      account_usage: null,
      model_summary: [],
      error: error.message || "AI Usage Service ist nicht erreichbar.",
    };
  }
}

function latestBuildStatus(project) {
  return project && project.build_count > 0 ? `${project.build_count} BuildJob(s)` : "";
}

async function waitForBuildDeployJob(jobId) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const job = await buildDeployJson(`/api/build-jobs/${encodeURIComponent(jobId)}`);
    if (["succeeded", "failed", "replaced"].includes(job.status)) return job;
    await delay(1000);
  }
  return null;
}

function toBuildDeployPackage(buildPackage, device = {}, project = {}) {
  const files = Object.fromEntries((buildPackage.files || []).map((file) => [file.path, file.content]));
  const buildConfig = resolveBuildConfig(project, device);
  if (buildConfig && !buildConfig.firmware_basis_id) files["platformio.ini"] = renderPlatformioIni(buildConfig);
  return {
    package_id: buildPackage.package_id,
    files,
  };
}

function resolveBuildConfig(project = {}, device = {}) {
  if (project.slug === "arduino-atmel-bare-metal" && project.build_config) return project.build_config;
  if (project.build_config?.firmware_basis_id) {
    return {
      ...project.build_config,
      board: device.build_config?.board || project.build_config.board,
      environment: device.build_config?.environment || project.build_config.environment,
    };
  }
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
  const userId = String(session?.account?.user_id || "").trim();
  if (!userId) {
    const error = new Error("Authenticated session is missing identity.user_id.");
    error.code = "missing_identity_user_id";
    error.status = 500;
    throw error;
  }
  return userId;
}

async function createAccountSummary(session) {
  const aiUsage = await loadAiUsageSummary(session);
  return {
    username: session.account.username || "",
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
      hardware_profile_id: "hardware.processor_board.arduino_nano_r3_atmega328p",
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
    tamagotchiEntryCourseModel.createProject(project, step),
    smartAssistantCourseModel.createProject(project, step),
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
        hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
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
  const accessModelsBySlug = {
    "arduino-blink": "free",
    "software-engineering-tamagotchi": "free",
    "arduino-atmel-bare-metal": "subscription",
    "smart-assistant-ai-automation": "subscription",
    "esp32-ota-bootstrap-firmware": "subscription",
    "plant-watering-control": "purchased",
  };
  return {
    slug,
    project_server_id: `project_${slug}`,
    learning_project_id: `learning_project.${slug.replace(/-/g, "_")}`,
    course_id: `course.${slug.replace(/-/g, "_")}`,
    lesson_id: `lesson.${slug.replace(/-/g, "_")}.intro`,
    hardware_profile_id: Object.hasOwn(options, "hardware_profile_id") ? options.hardware_profile_id : "hardware.processor_board.generic_esp_wroom32",
    default_device_id: Object.hasOwn(options, "default_device_id") ? options.default_device_id : "device_verified_1",
    build_config: options.build_config || undefined,
    source_files: options.source_files || [{ path: "src/main.cpp", role: "user_code" }],
    required_capability_ids: requiredCapabilitiesBySlug[slug] || ["capability.processor_esp32"],
    access_model: options.access_model || accessModelsBySlug[slug] || "subscription",
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
    if (device.hardware_profile_id === "hardware.processor_board.generic_esp_wroom32") {
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

  if (project.slug === tamagotchiEntryCourseModel.slug) {
    return tamagotchiEntryCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === smartAssistantCourseModel.slug) {
    return smartAssistantCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
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

function developmentProjectViewManifest({ title, description = "", source = "", diagram = null, buildConfig = null }) {
  const plantUmlSource = source || diagram?.source || initialArchitecturePlantUml(title);
  const buildable = Boolean(buildConfig);
  return {
    schema_version: 1,
    title: `${title || "Entwicklungsprojekt"} Architektur`,
    summary: description || "Projektgebundene Architektur-Discovery mit PlantUML-Skizze.",
    primary_source_path: buildable ? (buildConfig.user_source_path || "Komponenten/ESP32/src/user_main.cpp") : "docs/architecture.puml",
    hide_source_editor: !buildable,
    mode: "architecture_discovery",
    views: [
      ...(buildable ? [{
        id: "firmware-source",
        type: "source_analysis",
        title: "ESP32 User Main",
        summary: "Account- und projektgebundene User-Main; die geschuetzte GerNetiX-Basissoftware wird erst im BuildPackage ergaenzt.",
        source_path: buildConfig.user_source_path || "Komponenten/ESP32/src/user_main.cpp",
      }] : []),
      {
        id: "architecture-diagram",
        type: "plantuml",
        title: diagram?.title || "Architektur-Skizze",
        summary: diagram?.summary || "Aus Architektur-Discovery gespeicherte PlantUML-Skizze.",
        source_path: "docs/architecture.puml",
        validation: { type: "plantuml_contains", must_contain: ["@startuml", "@enduml"] },
        payload: {
          source: plantUmlSource,
          derived_from: diagram?.derived_from || (buildable ? "project_template" : "persisted_project"),
          ...(diagram?.function_coverage ? { function_coverage: diagram.function_coverage } : {}),
          model_lines: [
            { label: "Status", text: "KI-abgeleitete Skizze; Architekturentscheidungen muessen vom Nutzer bestaetigt werden." },
            { label: "Quelle", text: "Gespeichert im Project Server und an den aktuellen Account gebunden." },
          ],
        },
      },
      {
        id: "implementation-plan",
        type: "implementation_plan",
        title: "Naechste Schritte",
        summary: "Aus der Zielarchitektur werden spaeter konkrete Umsetzungsschritte abgeleitet.",
        payload: {
          tasks: [
            "Offene Architekturfragen klaeren",
            "Zielsysteme und Datenfluesse bestaetigen",
            "Technologieentscheidungen erst nach Bestaetigung festlegen",
          ],
        },
      },
    ],
  };
}

function initialArchitecturePlantUml(title) {
  return [
    "@startuml",
    `title Architektur-Skizze: ${String(title || "Neues Entwicklungsprojekt").replace(/"/g, "'")}`,
    "",
    "actor \"Nutzer\" as user",
    "rectangle \"Projektidee / Anforderungen\" as requirements",
    "user --> requirements : beschreibt Ziel und Rahmen",
    "",
    "note right of requirements",
    "  Noch keine KI-abgeleitete Architektur gespeichert.",
    "end note",
    "@enduml",
  ].join("\n");
}

function normalizeArchitectureDiagram(input = {}) {
  const source = String(input.source || "").trim();
  return {
    type: "plantuml",
    title: String(input.title || "Architektur-Skizze").trim(),
    summary: String(input.summary || "Gespeicherte Architektur-Skizze.").trim(),
    source,
    derived_from: String(input.derived_from || input.derivedFrom || "architecture_discovery_ai_response").trim(),
    generated_at: String(input.generated_at || input.generatedAt || new Date().toISOString()).trim(),
    confidence: Number(input.confidence || 0),
    detected_blocks: Array.isArray(input.detected_blocks || input.detectedBlocks)
      ? (input.detected_blocks || input.detectedBlocks).map(String)
      : [],
  };
}

function slugifyProjectId(value) {
  return String(value || "projekt")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "projekt";
}

function demoProjectSources(project) {
  if (project.slug === tamagotchiEntryCourseModel.slug) {
    return tamagotchiEntryCourseModel.createSources(project, primarySourcePath);
  }
  if (project.slug === smartAssistantCourseModel.slug) {
    return smartAssistantCourseModel.createSources();
  }

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

function readSession(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (session && new Date(session.expiresAt).getTime() > Date.now()) {
    return session;
  }
  if (session) {
    sessions.delete(token);
  }
  const resolved = auth.resolve_session_token(token);
  if (!resolved) return null;
  const restoredSession = {
    account: resolved.account,
    expiresAt: resolved.session.expires_at,
  };
  sessions.set(token, restoredSession);
  return restoredSession;
}

function readSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.gernetix_demo_session || "";
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

function usbSerialHelperDownloads() {
  const files = fs.existsSync(usbSerialHelperDistDir) ? fs.readdirSync(usbSerialHelperDistDir) : [];
  const definitions = [
    { platform: "macos", label: "Für macOS", pattern: /^GerNetiX-USB-Serial-Helper-mac-arm64\.zip$/i, detail: "ZIP · Apple Silicon" },
    { platform: "windows", label: "Für Windows", pattern: /^GerNetiX-USB-Serial-Helper-win-x64\.exe$/i, detail: "Portable EXE · Windows 10/11 x64" },
  ];
  return definitions.map((definition) => {
    const filename = files.find((file) => definition.pattern.test(file)) || "";
    return {
      platform: definition.platform,
      label: definition.label,
      detail: definition.detail,
      available: Boolean(filename),
      url: filename ? `/downloads/usb-serial-helper/${encodeURIComponent(filename)}` : "",
    };
  });
}

function serveUsbSerialHelperDownload(res, filename) {
  const download = usbSerialHelperDownloads().find((item) => item.available && decodeURIComponent(item.url).endsWith(`/${filename}`));
  if (!download) {
    sendJson(res, 404, { error: "download_not_found" });
    return;
  }
  const filePath = path.join(usbSerialHelperDistDir, filename);
  res.writeHead(200, {
    "Content-Type": filename.endsWith(".zip") ? "application/zip" : "application/vnd.microsoft.portable-executable",
    "Content-Disposition": `attachment; filename="${filename.replace(/[\"\\]/g, "")}"`,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
