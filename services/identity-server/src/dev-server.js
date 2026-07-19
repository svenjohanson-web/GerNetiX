const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { createDefaultIdentityModule, MockEmailService } = require("./index");
const { createSmtpConfigStore } = require("./services/smtp-config-store");
const { SmtpEmailService } = require("./services/smtp-email-service");
const { ConfigurableEmailService } = require("./services/configurable-email-service");
const { createWebPushService } = require("./services/web-push-service");
const { SqlitePlatformDownloadRepository } = require("./repositories/sqlite-platform-download-repository");
const { canonicalLocalPasskeyLocation } = require("./services/local-passkey-origin");
const { passkeyBrowserFailureEvent, passkeyLoginFailureEvent } = require("./services/passkey-login-events");
const { createSystemEventReporter } = require("./services/system-event-reporter");
const { createRuntimeStreamHub } = require("./runtime-stream-hub");
const { createAccountTransparencyFactory } = require("./dev/account-transparency");
const { createDeviceDiscoveryService } = require("./dev/device-discovery");
const { createDevelopmentAssistant } = require("./dev/development-assistant");
const { createHelpAssistant } = require("./dev/help-assistant");
const { developmentProjectSources } = require("./dev/development-project-structure");
const {
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  developmentProjectTemplatePreviews,
  templateArchitecturePlantUml,
  templateBuildConfig,
  templateFirmwareSources,
  templateHardwareProfileId,
  selectedGamesHeader,
} = require("./dev/development-project-templates");
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
const { createInterfaceCallTelemetry } = require("../../shared/persistence/interface-call-telemetry");
const { createTamagotchiEntryCourseModel } = require("./dev/project-models/tamagotchi-entry-course");
const { createSmartAssistantCourseModel } = require("./dev/project-models/smart-assistant-course");
const { createButtonToSmartphoneNotificationCourseModel } = require("./dev/project-models/button-to-smartphone-notification-course");
const { createHomeAutomationNetworkCourseModel } = require("./dev/project-models/home-automation-network-course");
const { getFirmwareBuildTarget, getFactoryFirmwareRelease } = require("../../../basissoftware/esp32/firmware-build-targets");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const publicDir = path.join(__dirname, "..", "public");
const appDir = path.join(publicDir, "app");
const operatorShellDir = path.join(__dirname, "..", "..", "shared", "public");
const esptoolJsDir = path.join(__dirname, "..", "node_modules", "esptool-js");
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const provisioningFirmwareRoot = process.env.PROVISIONING_FIRMWARE_ROOT
  ? path.resolve(process.env.PROVISIONING_FIRMWARE_ROOT)
  : path.join(workspaceRoot, ".runtime", "server-firmware", "esp32-basissoftware");
const usbSerialHelperDistDir = path.join(workspaceRoot, "tools", "usb-serial-helper", "dist");
const usbSerialHelperManifest = require(path.join(workspaceRoot, "tools", "usb-serial-helper", "package.json"));
const identityPersistenceBackend = process.env.IDENTITY_PERSISTENCE_BACKEND || "sqlite";
const identitySqlitePath = process.env.IDENTITY_SQLITE_PATH || path.join(workspaceRoot, ".runtime", "gernetix-identity.sqlite");
const platformDownloadSqlitePath = process.env.PLATFORM_DOWNLOAD_SQLITE_PATH
  || path.join(path.dirname(identitySqlitePath), "gernetix-platform-downloads.sqlite");
const platformDownloadRepository = identityPersistenceBackend === "sqlite"
  ? new SqlitePlatformDownloadRepository(platformDownloadSqlitePath)
  : null;
const identityAppBaseUrl = process.env.IDENTITY_APP_BASE_URL || process.env.APP_BASE_URL || "";
const identityAdminToken = process.env.IDENTITY_ADMIN_TOKEN || "";
const emailConfigEncryptionKey = process.env.EMAIL_CONFIG_ENCRYPTION_KEY || "";
const webPushService = createWebPushService({ sqlitePath: identitySqlitePath, publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "", privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "", subject: process.env.WEB_PUSH_VAPID_SUBJECT || "" });
const securityAlertPushAccountIds = String(process.env.WEB_PUSH_SECURITY_ALERT_ACCOUNT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
const port = Number(process.env.PORT || 4300);
const host = process.env.HOST || "127.0.0.1";
const demoUsername = process.env.DEMO_USER || "demo";
const demoEmail = process.env.DEMO_EMAIL || "demo@gernetix.local";
const demoPassword = process.env.DEMO_PASSWORD || "demo-passwort";
const defaultAccountPlan = process.env.GERNETIX_DEFAULT_ACCOUNT_PLAN || "premium_demo";
const passkeyChallenges = new Map();
const runtimeStreamHub = createRuntimeStreamHub();
const projectServerBaseUrl = process.env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800";
const telemetryServerBaseUrl = process.env.TELEMETRY_SERVER_BASE_URL || "http://127.0.0.1:5600";
const telemetryInternalToken = process.env.TELEMETRY_INTERNAL_TOKEN || "";
const buildDeployBaseUrl = process.env.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400";
const otaBuildDeployBaseUrl = process.env.OTA_BUILD_DEPLOY_BASE_URL || "https://build.gernetix.com";
const hardwareShopBaseUrl = process.env.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900";
const hardwareCatalogBaseUrl = process.env.HARDWARE_CATALOG_BASE_URL || "http://10.77.0.1:4910";
const deviceManagementBaseUrl = process.env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700";
const aiUsageBaseUrl = process.env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000";
const aiContextBaseUrl = process.env.AI_CONTEXT_BASE_URL || "http://127.0.0.1:5500";
const adminToolBaseUrl = process.env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600";
const systemEventIngestToken = process.env.SYSTEM_EVENT_INGEST_TOKEN || "";
const recordSystemEvent = createSystemEventReporter({
  baseUrl: adminToolBaseUrl,
  ingestToken: systemEventIngestToken,
});
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:3b";
const deviceDiscoveryUrls = process.env.GERNETIX_DEVICE_DISCOVERY_URLS || process.env.DEVICE_DISCOVERY_URLS || "";
const gernetixNodeHostnamePrefix = "gernetix-";
const execFileAsync = promisify(execFile);
const interfaceTelemetry = createInterfaceCallTelemetry({
  dbPath: process.env.INTERFACE_TELEMETRY_SQLITE_PATH || process.env.PERSISTENCE_SQLITE_PATH,
  sourceService: "identity-server",
});
const {
  aiContextJson,
  aiUsageJson,
  buildDeployJson,
  deviceManagementJson,
  hardwareCatalogJson,
  hardwareShopJson,
  projectServerJson,
  telemetryJson,
} = createDevServiceClients({
  aiContextBaseUrl,
  aiUsageBaseUrl,
  buildDeployBaseUrl,
  deviceManagementBaseUrl,
  hardwareCatalogBaseUrl,
  hardwareShopBaseUrl,
  projectServerBaseUrl,
  telemetryBaseUrl: telemetryServerBaseUrl,
  telemetryInternalToken,
  interfaceTelemetry,
});
const { buildDeployJson: otaBuildDeployJson } = createDevServiceClients({
  aiContextBaseUrl,
  aiUsageBaseUrl,
  buildDeployBaseUrl: otaBuildDeployBaseUrl,
  deviceManagementBaseUrl,
  hardwareCatalogBaseUrl,
  hardwareShopBaseUrl,
  projectServerBaseUrl,
  interfaceTelemetry,
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
  loadSensors,
  normalizeGerNetixNodeName,
  renderPlatformioIni,
  requiredField,
} = createDevHardwareUtils({
  execFileAsync,
  hardwareCatalogJson,
  interfaceTelemetry,
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
const buttonToSmartphoneNotificationCourseModel = createButtonToSmartphoneNotificationCourseModel();
const homeAutomationNetworkCourseModel = createHomeAutomationNetworkCourseModel();
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
  projectServerJson,
  projectServerUserId,
  readJsonBody,
  requireProjectAccess: requireSessionProject,
  sendJson,
});
const helpAssistant = createHelpAssistant({ aiContextJson, llmConfigStore, readJsonBody, sendJson });
const builtInDemoAccounts = [
  { user_id: "acct-demo", username: demoUsername, email: demoEmail, password: demoPassword },
];

const mockEmailService = new MockEmailService({ log() {} });
const smtpConfigStore = createSmtpConfigStore({ sqlitePath: identitySqlitePath, encryptionKey: emailConfigEncryptionKey });
const smtpEmailService = new SmtpEmailService({ configStore: smtpConfigStore });
const emailService = new ConfigurableEmailService({ smtpEmailService, fallbackEmailService: mockEmailService });
const auth = createDefaultIdentityModule({
  emailService,
  persistenceBackend: identityPersistenceBackend,
  sqlitePath: identitySqlitePath,
  appBaseUrl: identityAppBaseUrl || `http://${host}:${port}`,
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
  console.log(`OTA Build & Deploy adapter: ${otaBuildDeployBaseUrl}`);
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
      const beforeCount = mockEmailService.sentMessages.length;
      await auth.register_local(account.username, account.email, account.password, true, account.password, {
        user_id: account.user_id,
      });
      const verification = mockEmailService.sentMessages
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

function requireInternalAdmin(req) {
  if (!identityAdminToken) {
    const error = new Error("Interne Admin-Authentifizierung ist nicht konfiguriert.");
    error.status = 503;
    error.code = "identity_admin_token_missing";
    throw error;
  }
  const provided = String(req.headers["x-gernetix-admin-token"] || "");
  const expectedBuffer = Buffer.from(identityAdminToken);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    const error = new Error("Interne Admin-Authentifizierung fehlgeschlagen.");
    error.status = 403;
    error.code = "internal_admin_access_denied";
    throw error;
  }
}

async function handleInternalDevicePushEvent(req, res) {
  requireInternalAdmin(req);
  const event = await readJsonBody(req);
  const accountId = String(event.account_id || "").trim();
  const projectId = String(event.project_id || "").trim();
  const deviceId = String(event.device_id || "").trim();
  if (!accountId || !projectId || !deviceId) { sendJson(res, 400, { error: "account_project_and_device_required" }); return; }
  const title = String(event.title || "GerNetiX Board").trim().slice(0, 120) || "GerNetiX Board";
  const body = String(event.body || "Neue Meldung von deinem Board.").trim().slice(0, 500) || "Neue Meldung von deinem Board.";
  const requestedUrl = String(event.url || "").trim();
  const url = requestedUrl.startsWith("/app/") ? requestedUrl : "/app/device-management/";
  const push = await webPushService.notifyProject(accountId, projectId, { title, body, url });
  sendJson(res, 202, { accepted: true, account_id: accountId, project_id: projectId, device_id: deviceId, push });
}

async function handleInternalDeviceRuntimeEvent(req, res) {
  requireInternalAdmin(req);
  const event = await readJsonBody(req);
  const accountId = String(event.account_id || "").trim();
  const projectId = String(event.project_id || "").trim();
  const deviceId = String(event.device_id || "").trim();
  const line = String(event.line || "").trim().slice(0, 500);
  if (!accountId || !projectId || !deviceId || !line) { sendJson(res, 400, { error: "account_project_device_and_line_required" }); return; }
  runtimeStreamHub.publish({ accountId, projectId, deviceId, channel: event.channel, line, occurredAt: event.occurred_at });
  sendJson(res, 202, { accepted: true, account_id: accountId, project_id: projectId, device_id: deviceId });
}

async function handleProjectRuntimeStream(req, res, session, projectId) {
  await requireSessionProject(session, projectId);
  const accountId = projectServerUserId(session);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("event: ready\ndata: {}\n\n");
  const unsubscribe = runtimeStreamHub.subscribe({ accountId, projectId, send: (payload) => res.write(`event: runtime\ndata: ${payload}\n\n`) });
  const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 25000);
  heartbeat.unref?.();
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
}

async function routeRequest(req, res) {
  const canonicalLocation = canonicalLocalPasskeyLocation(req);
  if (canonicalLocation) {
    redirect(res, canonicalLocation);
    return;
  }
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
  if (url.pathname === "/app/manifest.webmanifest") { serveStatic(res, appDir, "/manifest.webmanifest"); return; }
  if (url.pathname === "/app/push-sw.js") { serveStatic(res, appDir, "/push-sw.js"); return; }
  if (url.pathname === "/app/operator-shell.css") { serveStatic(res, operatorShellDir, "/operator-shell.css"); return; }

  if (url.pathname === "/api/internal/email-config") {
    requireInternalAdmin(req);
    if (req.method === "GET") {
      sendJson(res, 200, { config: smtpConfigStore.publicConfig() });
      return;
    }
    if (req.method === "PUT") {
      sendJson(res, 200, { config: smtpConfigStore.update(await readJsonBody(req)) });
      return;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/internal/email-config/test" && req.method === "POST") {
    requireInternalAdmin(req);
    await smtpEmailService.testConnection();
    sendJson(res, 200, { ok: true, config: smtpConfigStore.publicConfig() });
    return;
  }

  if (url.pathname === "/api/internal/security-alert" && req.method === "POST") {
    requireInternalAdmin(req);
    const alert = await readJsonBody(req);
    const config = smtpConfigStore.deliveryConfig();
    const recipient = config?.security_alert_recipient || config?.reply_to || config?.from_address;
    if (!recipient) { sendJson(res, 409, { error: "security_alert_recipient_missing" }); return; }
    await smtpEmailService.send(recipient, `GerNetiX Sicherheitsalarm: ${String(alert.severity || "warning").toUpperCase()}`, String(alert.message || "Sicherheitsereignis erkannt."));
    const push = await webPushService.notifyAccounts(securityAlertPushAccountIds, { title: "GerNetiX Sicherheitsalarm", body: String(alert.message || "Sicherheitsereignis erkannt."), url: "/app/dashboard/" });
    sendJson(res, 202, { accepted: true, recipient, push });
    return;
  }

  if (url.pathname === "/api/push/public-key" && req.method === "GET") { sendJson(res, 200, { enabled: webPushService.enabled, public_key: webPushService.publicKey || "" }); return; }
  const pushProjectRoute = url.pathname.match(/^\/api\/push\/projects\/([^/]+)\/(subscribe|test)$/);
  if (pushProjectRoute && req.method === "POST") { const session = readSession(req); if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; } const projectId = decodeURIComponent(pushProjectRoute[1]); await requireSessionProject(session, projectId); if (pushProjectRoute[2] === "subscribe") { if (!webPushService.enabled) { sendJson(res, 503, { error: "push_not_configured" }); return; } webPushService.subscribeProject(projectServerUserId(session), projectId, await readJsonBody(req)); sendJson(res, 201, { subscribed: true, project_id: projectId }); return; } const push = await webPushService.notifyProject(projectServerUserId(session), projectId, { title: "GerNetiX Testnachricht", body: "Hallo Welt – dein privater Projekt-Push-Kanal ist aktiv.", url: `/app/ide/?project=${encodeURIComponent(projectId)}` }); sendJson(res, 202, { accepted: true, project_id: projectId, push }); return; }
  if (url.pathname === "/api/internal/push/device-event" && req.method === "POST") { await handleInternalDevicePushEvent(req, res); return; }
  if (url.pathname === "/api/internal/runtime/device-event" && req.method === "POST") { await handleInternalDeviceRuntimeEvent(req, res); return; }

  const runtimeStreamRoute = url.pathname.match(/^\/api\/platform\/projects\/([^/]+)\/runtime-stream$/);
  if (runtimeStreamRoute && req.method === "GET") {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    await handleProjectRuntimeStream(req, res, session, decodeURIComponent(runtimeStreamRoute[1]));
    return;
  }

  const telemetryProjectRoute = url.pathname.match(/^\/api\/platform\/telemetry\/projects\/([^/]+)\/(measurements|events|retention|data)$/);
  if (telemetryProjectRoute) {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    const projectId = decodeURIComponent(telemetryProjectRoute[1]);
    const resource = telemetryProjectRoute[2];
    await requireSessionProject(session, projectId);
    const accountId = projectServerUserId(session);
    const query = url.search || "";
    const telemetryPath = `/api/telemetry/internal/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(projectId)}/${resource}${query}`;
    if (req.method === "GET" && resource !== "data") { sendJson(res, 200, await telemetryJson(telemetryPath)); return; }
    if (req.method === "PUT" && resource === "retention") { sendJson(res, 200, await telemetryJson(telemetryPath, { method: "PUT", body: await readJsonBody(req) })); return; }
    if (req.method === "DELETE" && resource === "data") { sendJson(res, 200, await telemetryJson(telemetryPath, { method: "DELETE" })); return; }
    sendJson(res, 405, { error: "method_not_allowed" }); return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    await handleLogin(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    await handleRegister(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/passkeys/registration/options") {
    await handlePasskeyRegistrationOptions(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/passkeys/registration/verify") {
    await handlePasskeyRegistrationVerify(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/passkeys/authentication/options") {
    await handlePasskeyAuthenticationOptions(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/passkeys/authentication/verify") {
    await handlePasskeyAuthenticationVerify(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/passkeys/client-error") {
    await recordSystemEvent(passkeyBrowserFailureEvent(await readJsonBody(req)));
    sendJson(res, 202, { accepted: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/account/guest") {
    const guest = await auth.create_guest();
    sessions.set(guest.session.token, { account: guest.account, expiresAt: guest.session.expires_at });
    setSessionCookie(res, guest.session.token, guest.session.expires_at);
    sendJson(res, 201, { account: guest.account, next: "/app/dashboard/" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/account/access-profile") {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    sendJson(res, 200, { account: session.account });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/account/upgrade-guest") {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    const body = await readJsonBody(req);
      const result = await auth.upgrade_guest_to_base(session.account.user_id, body.username, body.password, body.accepted_terms === true, body.passkey_credential_id, body.offline_recovery_set_confirmed === true, body.offline_recovery_set);
    updateCachedSessionAccount(req, result.account);
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/account/offline-recovery-set") {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    const result = await auth.create_offline_recovery_set(session.account.user_id);
    updateCachedSessionAccount(req, result.account);
    sendJson(res, 201, result);
    return;
  }

  const recoveryBoardRoute = url.pathname.match(/^\/api\/account\/recovery-boards\/([^/]+)$/);
  if (recoveryBoardRoute && ["POST", "DELETE"].includes(req.method)) {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    const boardId = decodeURIComponent(recoveryBoardRoute[1]);
    const result = req.method === "POST"
      ? await auth.add_esp32_recovery_token(session.account.user_id, boardId)
      : await auth.remove_esp32_recovery_token(session.account.user_id, boardId);
    updateCachedSessionAccount(req, result.account);
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/password-reset/request") {
    const body = await readJsonBody(req);
    sendJson(res, 202, await auth.request_password_reset(body.email));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/password-reset/complete") {
    const body = await readJsonBody(req);
    sendJson(res, 200, await auth.reset_password(body.token, body.password));
    return;
  }

  if (req.method === "GET" && url.pathname === "/verify-email") {
    try {
      await auth.verify_email(url.searchParams.get("token") || "");
      redirect(res, "/app/auth/?verification=success");
    } catch {
      redirect(res, "/app/auth/?verification=invalid");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/reset-password") {
    redirect(res, `/app/auth/?mode=reset&token=${encodeURIComponent(url.searchParams.get("token") || "")}`);
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
    await serveUsbSerialHelperDownload(res, path.basename(url.pathname));
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

  const learningProjectStart = url.pathname.match(/^\/api\/platform\/learning-projects\/([^/]+)\/start$/);
  if (req.method === "POST" && learningProjectStart) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleLearningProjectStart(res, session, decodeURIComponent(learningProjectStart[1]));
    return;
  }

  const learningProjectDevice = url.pathname.match(/^\/api\/platform\/learning-projects\/([^/]+)\/device$/);
  if (req.method === "POST" && learningProjectDevice) {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    await handleLearningProjectDeviceAssign(req, res, session, decodeURIComponent(learningProjectDevice[1]));
    return;
  }

  const platformProject = url.pathname.match(/^\/api\/platform\/projects\/([^/]+)$/);
  if (req.method === "DELETE" && platformProject) {
    const session = readSession(req);
    if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    await handlePlatformProjectDelete(res, session, decodeURIComponent(platformProject[1]));
    return;
  }

  const developmentProjectDialog = url.pathname.match(/^\/api\/platform\/development-projects\/([^/]+)\/dialog$/);
  if (req.method === "POST" && developmentProjectDialog) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleDevelopmentProjectDialogSave(req, res, session, decodeURIComponent(developmentProjectDialog[1]));
    return;
  }

  const developmentProjectHardware = url.pathname.match(/^\/api\/platform\/development-projects\/([^/]+)\/hardware-configuration$/);
  if (req.method === "POST" && developmentProjectHardware) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleDevelopmentProjectHardwareSave(req, res, session, decodeURIComponent(developmentProjectHardware[1]));
    return;
  }

  const projectComponentFeatures = url.pathname.match(/^\/api\/user-ide\/projects\/([^/]+)\/component-features$/);
  if (req.method === "POST" && projectComponentFeatures) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleProjectComponentFeatures(req, res, session, decodeURIComponent(projectComponentFeatures[1]));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/development-assistant/chat") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    if (!requireEntitlement(res, session, "ai_assistant")) return;
    await developmentAssistant.handleChat(req, res, session);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/hardware/processor-boards") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    try {
      sendJson(res, 200, { items: await loadProcessorBoards() });
    } catch {
      sendJson(res, 502, {
        error: "hardware_catalog_unreachable",
        dependency: "hardware_catalog",
        message: "Hardware-Katalog nicht erreichbar.",
      });
    }
    return;
  }

  const projectPwaDashboard = url.pathname.match(/^\/api\/user-ide\/projects\/([^/]+)\/pwa-dashboard$/);
  if (req.method === "POST" && projectPwaDashboard) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleProjectPwaDashboard(req, res, session, decodeURIComponent(projectPwaDashboard[1]));
    return;
  }

  const projectEventConfiguration = url.pathname.match(/^\/api\/user-ide\/projects\/([^/]+)\/event-configuration$/);
  if (req.method === "POST" && projectEventConfiguration) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleProjectEventConfiguration(req, res, session, decodeURIComponent(projectEventConfiguration[1]));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/help-assistant/chat") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    if (!requireEntitlement(res, session, "ai_assistant")) return;
    await helpAssistant.handleChat(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/hardware/board-feature-options") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    try {
      sendJson(res, 200, await hardwareCatalogJson("/api/hardware-catalog/board-feature-options"));
    } catch (error) {
      sendJson(res, 502, {
        error: "hardware_catalog_unreachable",
        dependency: "hardware_catalog",
        message: "Die Boardausstattung konnte nicht aus dem Hardware Catalog geladen werden.",
      });
    }
    return;
  }

  const projectComponentHardwareFeatures = url.pathname.match(/^\/api\/user-ide\/projects\/([^/]+)\/component-hardware-features$/);
  if (req.method === "POST" && projectComponentHardwareFeatures) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handleProjectComponentHardwareFeatures(req, res, session, decodeURIComponent(projectComponentHardwareFeatures[1]));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/hardware/sensors") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
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
  if (req.method === "PUT" && platformDevice) {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformDeviceBasissoftwareProfileUpdate(req, res, session, decodeURIComponent(platformDevice[1]));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/provisioning/session") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformProvisioningSession(req, res, session);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform/provisioning/complete") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformProvisioningComplete(req, res, session);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/provisioning-firmware") {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    const request = provisioningFirmwareRequest(url.searchParams);
    const artifact = await resolveProvisioningFirmwareArtifact(request);
    if (!fs.existsSync(artifact.path)) {
      sendJson(res, 503, {
        error: "provisioning_firmware_unavailable",
        message: `Die Factory-Basissoftware fuer ${artifact.label} ist auf diesem Server noch nicht bereitgestellt.`,
      });
      return;
    }
    sendJson(res, 200, {
      artifact_id: artifact.id,
      profile: request.profile,
      hardware_profile_id: request.hardwareProfileId,
      firmware_build_target_id: artifact.firmwareBuildTargetId,
      version: artifact.version,
      flash_size_mb: request.flashSizeMb,
      flash_mode: artifact.flashMode,
      flash_freq: artifact.flashFreq,
      flash_size: artifact.flashSize,
      flash_offset: 0,
      content_url: `/api/platform/provisioning-firmware/content?profile=${encodeURIComponent(request.profile)}&hardware_profile_id=${encodeURIComponent(request.hardwareProfileId)}&flash_size_mb=${request.flashSizeMb}`,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform/provisioning-firmware/content") {
    if (!readSession(req)) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    const request = provisioningFirmwareRequest(url.searchParams);
    const artifact = await resolveProvisioningFirmwareArtifact(request);
    if (!fs.existsSync(artifact.path)) {
      sendJson(res, 503, { error: "provisioning_firmware_unavailable", message: `Die Factory-Basissoftware fuer ${artifact.label} ist auf diesem Server noch nicht bereitgestellt.` });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=${artifact.fileName}`,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(artifact.path).pipe(res);
    return;
  }
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
  const platformSourceSearch = url.pathname.match(/^\/api\/platform\/projects\/([^/]+)\/source-search$/);
  if (platformSourceSearch && req.method === "GET") {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    await handlePlatformSourceSearch(res, session, decodeURIComponent(platformSourceSearch[1]), url.searchParams);
    return;
  }
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
    const job = await loadBuildDeployJob(jobId);
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

  if (["/hilfe", "/hilfe/", "/wissen", "/wissen/"].includes(url.pathname)) {
    serveStatic(res, appDir, "/index.html");
    return;
  }

  if (url.pathname.startsWith("/app/") && path.extname(url.pathname)) {
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
    serveStatic(res, publicDir, "/index.html");
    return;
  }

  serveStatic(res, publicDir, url.pathname);
}

function passkeyConfiguration(req) {
  const origin = String(req.headers.origin || identityAppBaseUrl || `http://${host}:${port}`).replace(/\/$/, "");
  return { origin, rpID: new URL(origin).hostname };
}

function storePasskeyChallenge(kind, username, challenge, config) {
  passkeyChallenges.set(`${kind}:${passkeyChallengeSubject(username)}`, { challenge, config, expiresAt: Date.now() + 5 * 60 * 1000 });
}

function readPasskeyChallenge(kind, username) {
  const key = `${kind}:${passkeyChallengeSubject(username)}`;
  const value = passkeyChallenges.get(key);
  passkeyChallenges.delete(key);
  if (!value || value.expiresAt < Date.now()) throw new Error("passkey_challenge_expired");
  return value;
}

function passkeyChallengeSubject(username) {
  return String(username || "").trim().toLowerCase() || "__discoverable_passkey__";
}

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function handlePasskeyRegistrationOptions(req, res) {
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    if (username.length < 3) throw new Error("invalid_username");
    const config = passkeyConfiguration(req);
    const options = await generateRegistrationOptions({
      rpName: "GerNetiX", rpID: config.rpID, userName: username,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    storePasskeyChallenge("register", username, options.challenge, config);
    sendJson(res, 200, options);
  } catch (error) {
    sendJson(res, 400, { error: error.code || "passkey_registration_unavailable", message: "Konto wurde nicht angelegt. Grund: Passkey konnte nicht vorbereitet werden." });
  }
}

async function handlePasskeyRegistrationVerify(req, res) {
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    if (body.accepted_terms !== true) throw new Error("terms_not_accepted");
    const challenge = readPasskeyChallenge("register", username);
    const verification = await verifyRegistrationResponse({
      response: body.credential, expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) throw new Error("passkey_registration_not_verified");
    const credential = verification.registrationInfo.credential;
    const created = await auth.create_passkey_account(username, {
      credentialId: credential.id, publicKey: toBase64Url(credential.publicKey),
      counter: credential.counter, transports: credential.transports || [],
    });
    sessions.set(created.session.token, { account: created.account, expiresAt: created.session.expires_at });
    setSessionCookie(res, created.session.token, created.session.expires_at);
    sendJson(res, 201, { account: created.account, message: "Konto wurde angelegt.", next: "/app/dashboard/" });
  } catch (error) {
    const message = error.message === "terms_not_accepted"
      ? "Konto wurde nicht angelegt. Grund: Bitte bestätige Datenschutz und Nutzungsbedingungen."
      : host === "127.0.0.1"
        ? `Konto wurde nicht angelegt. Grund: Passkey konnte nicht verifiziert werden: ${error.message || "unbekannter Fehler"}`
        : "Konto wurde nicht angelegt. Grund: Passkey konnte nicht verifiziert werden.";
    sendJson(res, error.status || 400, { error: error.code || "passkey_registration_failed", message });
  }
}

async function handlePasskeyAuthenticationOptions(req, res) {
  let account = null;
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const config = passkeyConfiguration(req);
    account = username ? auth.get_passkey_login_candidate(username) : null;
    const options = await generateAuthenticationOptions({
      rpID: config.rpID, userVerification: "required",
      ...(account ? { allowCredentials: [{ id: account.passkey_credential_id, transports: account.passkey_transports || [] }] } : {}),
    });
    storePasskeyChallenge("authenticate", username, options.challenge, config);
    sendJson(res, 200, options);
  } catch (error) {
    await recordPasskeyLoginFailure("options", error, account);
    sendJson(res, error.status || 400, { error: error.code || "passkey_authentication_unavailable", message: "Passkey-Login konnte nicht vorbereitet werden." });
  }
}

async function handlePasskeyAuthenticationVerify(req, res) {
  let account = null;
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    account = username
      ? auth.get_passkey_login_candidate(username)
      : auth.get_passkey_login_candidate_by_credential_id(body.credential?.id);
    const challenge = readPasskeyChallenge("authenticate", username);
    const verification = await verifyAuthenticationResponse({
      response: body.credential, expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID,
      requireUserVerification: true,
      credential: {
        id: account.passkey_credential_id,
        publicKey: Buffer.from(account.passkey_public_key, "base64url"),
        counter: Number(account.passkey_counter || 0),
        transports: account.passkey_transports || [],
      },
    });
    if (!verification.verified) throw new Error("passkey_authentication_not_verified");
    const login = await auth.login_passkey_by_credential_id(account.passkey_credential_id, verification.authenticationInfo.newCounter);
    sessions.set(login.session.token, { account: login.account, expiresAt: login.session.expires_at });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, { account: login.account, next: sanitizeNextPath(body.next) || "/app/dashboard/" });
  } catch (error) {
    await recordPasskeyLoginFailure("verification", error, account);
    sendJson(res, error.status || 401, { error: error.code || "passkey_authentication_failed", message: "Passkey-Login fehlgeschlagen." });
  }
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
    const beforeCount = mockEmailService.sentMessages.length;
    const registered = await auth.register_local(
      body.username,
      body.email,
      body.password,
      body.accepted_terms === true,
      body.password_repeat,
    );
    if (smtpEmailService.configured()) {
      sendJson(res, 202, {
        account: registered.account,
        requires_email_verification: true,
        message: "Konto erstellt. Bitte bestaetige jetzt die E-Mail-Adresse.",
      });
      return;
    }
    const verification = mockEmailService.sentMessages
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
  const projectsPromise = loadUserIdeProjects(session).then((items) => {
    serviceStatus.project_server = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.project_server = { ok: false, error: error.message || String(error) };
    return [];
  });
  const devicesPromise = loadUserIdeDevices(session).then((items) => {
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
  const aiUsagePromise = loadAiUsageSummary(session).then((summary) => {
    serviceStatus.ai_usage = { ok: summary.available !== false };
    return summary;
  }).catch((error) => {
    serviceStatus.ai_usage = { ok: false, error: error.message || String(error) };
    return null;
  });
  const accountPromise = createAccountSummary(session);
  const projects = await projectsPromise;
  const buildsPromise = loadProjectBuilds(projects, session).then((items) => {
    serviceStatus.builds = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.builds = { ok: false, error: error.message || String(error) };
    return [];
  });
  const [devices, builds, aiUsage, account] = await Promise.all([
    devicesPromise,
    buildsPromise,
    aiUsagePromise,
    accountPromise,
  ]);
  const userId = projectServerUserId(session);
  sendJson(res, 200, {
    account,
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
    development_project_templates: developmentProjectTemplateCatalog().map((template) => ({
      ...template,
      available: hasEntitlements(session, template.required_entitlements),
    })),
    development_project_template_previews: developmentProjectTemplatePreviews(),
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

function recordPasskeyLoginFailure(stage, error, account) {
  return recordSystemEvent(passkeyLoginFailureEvent(stage, error, account));
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

async function handlePlatformSourceSearch(res, session, projectId, searchParams) {
  const project = await requireSessionProject(session, projectId);
  const query = new URLSearchParams({
    q: String(searchParams.get("q") || "").slice(0, 1000),
    current_path: String(searchParams.get("current_path") || "").slice(0, 300),
    limit: "6",
  });
  const result = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/search?${query}`);
  sendJson(res, 200, result);
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
  if (!requireEntitlements(res, session, template.requiredEntitlements || [])) return;
  const title = requiredField(body.title || template.title || "Neues Entwicklungsprojekt", "title").slice(0, 120);
  const description = String(body.description || template.description || "Architektur-Discovery-Projekt").trim().slice(0, 1000);
  const buildConfig = templateBuildConfig(template);
  const projectId = `dev_project_${slugifyProjectId(title)}_${Date.now().toString(36)}`;
  const initialSource = template.id === "empty" ? "" : templateArchitecturePlantUml(template, title);
  const sources = developmentProjectSources({ title, description, architectureSource: initialSource })
    .concat(templateFirmwareSources(template, title));
  const project = await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: userId,
      plan_id: accountSubscription(session).plan,
      title,
      description,
      learning_project_id: "development_project",
      hardware_profile_id: templateHardwareProfileId(template),
      device_id: null,
      build_config: buildConfig,
      view_manifest: developmentProjectViewManifest({
        title,
        description,
        source: initialSource,
        buildConfig,
        templateId: template.id,
        templateModelVersion: template.schemaVersion,
        homeAutomationConfiguration: template.id === "distributed_home_automation"
          ? defaultHomeAutomationConfiguration()
          : null,
        gameConfiguration: template.id === "touchscreen_game_collection"
          ? defaultTouchscreenGameConfiguration()
          : null,
        dataLoggerConfiguration: template.dataLogger,
      }),
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
      view_manifest: developmentProjectViewManifest({
        title,
        description,
        source: diagram.source,
        diagram,
        buildConfig: project.build_config,
        architectureDialog: project.view_manifest?.architecture_dialog,
        templateId: project.view_manifest?.template_id,
        templateModelVersion: project.view_manifest?.template_ref?.model_schema_version,
        hardwareConfiguration: hardwareConfigurationFromManifest(project.view_manifest),
        homeAutomationConfiguration: project.view_manifest?.home_automation_configuration,
        gameConfiguration: project.view_manifest?.game_configuration,
        pwaDashboardConfiguration: project.view_manifest?.pwa_dashboard,
        dataLoggerConfiguration: project.view_manifest?.data_logger,
        eventConfiguration: project.view_manifest?.event_configuration,
      }),
      build_config: project.build_config || null,
    },
  });
  touchWorkspace(session, project.project_server_id, "development-platform", "/app/development-platform/");
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, { project: toPlatformProject(updated), saved_at: new Date().toISOString() });
}

async function handleLearningProjectStart(res, session, catalogProjectId) {
  const definition = userIdeState.projectDefinitions
    .find((item) => item.project_server_id === catalogProjectId || catalogProjectIdForDefinition(item) === catalogProjectId);
  if (!definition) {
    sendJson(res, 404, { error: "learning_project_not_found", message: "Dieses Lernprojekt ist im Katalog nicht vorhanden." });
    return;
  }

  const userId = projectServerUserId(session);
  const existing = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}`);
  const alreadyStarted = existing.items.find((item) => item.learning_project_id === definition.learning_project_id
    && item.project_id !== definition.project_server_id);
  const projectId = `learning_${definition.slug}_${crypto.randomUUID().slice(0, 8)}`;
  const project = alreadyStarted
    ? await synchronizeLearningProjectStructure(alreadyStarted, definition)
    : await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: userId,
      plan_id: accountSubscription(session).plan,
      title: definition.title,
      description: definition.summary,
      learning_project_id: definition.learning_project_id,
      hardware_profile_id: definition.hardware_profile_id,
      device_id: null,
      build_config: definition.build_config,
      view_manifest: projectViewManifest(definition),
      sources: demoProjectSources(definition, { projectId }),
    },
    });
  const mapped = mapProjectServerProject(session, project);
  touchWorkspace(session, project.project_id, "learn", `/app/learning-project/?project=${encodeURIComponent(project.project_id)}`);
  sendJson(res, alreadyStarted ? 200 : 201, { project: toPlatformProject(mapped), created: !alreadyStarted });
}

async function synchronizeLearningProjectStructure(project, definition) {
  const projectId = project.project_id;
  const needsBuildConfig = !project.build_config?.user_source_path;
  const updated = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: {
      view_manifest: projectViewManifest(definition),
      ...(needsBuildConfig ? { build_config: definition.build_config } : {}),
    },
  });
  for (const source of demoProjectSources(definition, { projectId })) {
    const present = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(source.path)}`)
      .then(() => true)
      .catch((error) => {
        if (error.status === 404) return false;
        throw error;
      });
    if (!present) {
      await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources`, { method: "PUT", body: source });
    }
  }
  return updated;
}

async function handleLearningProjectDeviceAssign(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.learning_project_id || project.project_origin !== "account_project") {
    sendJson(res, 409, { error: "learning_project_required", message: "Ein Board kann hier nur einem eigenen Lernprojekt zugeordnet werden." });
    return;
  }
  const deviceId = String((await readJsonBody(req)).device_id || "").trim();
  const device = (await loadUserIdeDevices(session)).find((item) => item.device_id === deviceId);
  if (!device) { sendJson(res, 404, { error: "inventory_device_not_found", message: "Das gewaehlte Board ist nicht in deinem Inventar." }); return; }
  const updated = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: { device_id: device.device_id },
  });
  sendJson(res, 200, { project: toPlatformProject(mapProjectServerProject(session, updated)), device });
}

async function handlePlatformProjectDelete(res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!['development_project', 'custom_project'].includes(project.area)) {
    sendJson(res, 400, { error: 'not_development_project', message: 'Nur eigene Entwicklungsprojekte koennen geloescht werden.' });
    return;
  }
  const accountId = projectServerUserId(session);
  const telemetryPath = `/api/telemetry/internal/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(project.project_server_id)}/data`;
  const telemetry = await telemetryJson(telemetryPath, { method: 'DELETE' });
  const push = webPushService.unsubscribeProject(accountId, project.project_server_id);
  const deletion = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, { method: 'DELETE' });
  sendJson(res, 200, { deleted: true, project_id: project.project_server_id, project: deletion, telemetry, push });
}

async function handleDevelopmentProjectDialogSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Architektur-Dialog kann nur in eigenen Entwicklungsprojekten gespeichert werden." });
    return;
  }

  const body = await readJsonBody(req);
  const existingManifest = project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.summary,
    source: initialArchitecturePlantUml(project.title),
    buildConfig: project.build_config,
  });
  const diagram = normalizeArchitectureDiagram(body.architectureDiagram || existingManifest.architecture_dialog?.architectureDiagram || architectureDiagramFromManifest(existingManifest));
  const architectureDialog = normalizeArchitectureDialog(body, diagram);
  const homeAutomationConfiguration = normalizeHomeAutomationConfiguration(
    body.homeAutomationConfiguration || body.home_automation_configuration || existingManifest.home_automation_configuration,
  );
  const gameConfiguration = normalizeTouchscreenGameConfiguration(
    body.gameConfiguration || body.game_configuration || existingManifest.game_configuration,
  );
  let buildConfig = project.build_config || null;
  let selectedBoard = null;
  let selectedInventoryDevice = null;
  if (existingManifest.template_id === "touchscreen_game_collection" && gameConfiguration) {
    const boards = await loadProcessorBoards();
    selectedBoard = boards.find((board) => board.hardware_item_id === gameConfiguration.board_profile_id) || null;
    if (gameConfiguration.board_profile_id && !selectedBoard) {
      sendJson(res, 409, { error: "game_board_not_found", message: "Das gewaehlte Touch-Display-Board ist nicht mehr im Hardware-Katalog vorhanden." });
      return;
    }
    if (selectedBoard && !isTouchscreenGameBoard(selectedBoard)) {
      sendJson(res, 409, { error: "game_board_not_touchscreen", message: "Das gewaehlte Board besitzt laut Hardware-Katalog keinen integrierten Touchscreen." });
      return;
    }
    if (selectedBoard) buildConfig = buildConfigForBoard(selectedBoard.hardware_item_id, buildConfig);
    if (gameConfiguration.inventory_device_id) {
      const inventoryDevices = await loadUserIdeDevices(session);
      selectedInventoryDevice = inventoryDevices.find((device) => device.device_id === gameConfiguration.inventory_device_id) || null;
      if (!selectedInventoryDevice) {
        sendJson(res, 404, { error: "game_inventory_device_not_found", message: "Das gewaehlte Inventar-Board wurde nicht gefunden." });
        return;
      }
      if (gameConfiguration.board_profile_id && !touchscreenGameInventoryMatches(gameConfiguration.board_profile_id, selectedInventoryDevice)) {
        sendJson(res, 409, { error: "game_inventory_device_not_compatible", message: "Das Inventar-Board entspricht nicht dem gewaehlten Touch-Display-Board." });
        return;
      }
    }
    if (buildConfig) {
      buildConfig = {
        ...buildConfig,
        component_device_allocations: selectedInventoryDevice ? [{
          component_path: "Komponenten/IoT-Device 1",
          device_id: selectedInventoryDevice.device_id,
          allocated_at: new Date().toISOString(),
        }] : [],
      };
    }
    await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
      method: "PUT",
      body: {
        path: "Komponenten/IoT-Device 1/src/config/selected_games.h",
        role: "user_code",
        content_type: "text/x-c++hdr",
        content: selectedGamesHeader(gameConfiguration.selected_game_ids),
      },
    });
  }
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      ...(selectedBoard ? { hardware_profile_id: selectedBoard.hardware_item_id } : {}),
      device_id: selectedInventoryDevice?.device_id || project.device_id || "",
      view_manifest: {
        ...existingManifest,
        architecture_dialog: architectureDialog,
        ...(homeAutomationConfiguration ? { home_automation_configuration: homeAutomationConfiguration } : {}),
        ...(gameConfiguration ? { game_configuration: gameConfiguration } : {}),
      },
      build_config: buildConfig,
    },
  });
  touchWorkspace(session, project.project_server_id, "development-platform", "/app/development-platform/");
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, { project: toPlatformProject(updated), saved_at: new Date().toISOString() });
}

async function handleDevelopmentProjectHardwareSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Hardware kann nur in eigenen Entwicklungsprojekten konfiguriert werden." });
    return;
  }
  const body = await readJsonBody(req);
  const existingManifest = project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.summary,
    source: initialArchitecturePlantUml(project.title),
    buildConfig: project.build_config,
  });
  const diagram = architectureDiagramFromManifest(existingManifest);
  const hardwareConfiguration = normalizeHardwareConfiguration(body.hardware_configuration || body.hardwareConfiguration, project);
  const boardComponent = hardwareConfiguration.components.find((component) => component.abstract_type === "iot_device" && component.board_profile_id);
  const baseBuildConfig = boardComponent
    ? buildConfigForBoard(boardComponent.board_profile_id, project.build_config)
    : project.build_config;
  const inventoryDevices = await loadUserIdeDevices(session);
  const allocations = [];
  let primaryInventoryDevice = null;
  for (const component of hardwareConfiguration.components.filter((item) => item.abstract_type === "iot_device")) {
    component.inventory_device_label = "";
  }
  for (const component of hardwareConfiguration.components.filter((item) => item.abstract_type === "iot_device" && item.inventory_device_id)) {
    const inventoryDevice = inventoryDevices.find((device) => device.device_id === component.inventory_device_id);
    if (!inventoryDevice) {
      sendJson(res, 404, { error: "device_not_found", message: `Das Inventar-Device fuer ${component.label} wurde nicht gefunden.` });
      return;
    }
    if (component.board_profile_id && inventoryDevice.hardware_profile_id !== component.board_profile_id) {
      sendJson(res, 409, { error: "device_not_compatible", message: `Das Inventar-Device fuer ${component.label} entspricht nicht dem gewaehlten Board.` });
      return;
    }
    component.inventory_device_label = String(inventoryDevice.display_name || inventoryDevice.device_id).slice(0, 180);
    primaryInventoryDevice ||= inventoryDevice;
    allocations.push({
      component_path: component.component_path,
      device_id: inventoryDevice.device_id,
      allocated_at: new Date().toISOString(),
    });
  }
  const allocatedBasissoftwareProfile = primaryInventoryDevice?.instance_configuration?.basissoftware_profile || null;
  const allocatedFlashValue = primaryInventoryDevice?.instance_configuration?.board_features?.flash?.value || "";
  const allocatedFlashSizeMb = Number(String(allocatedFlashValue).match(/^(\d+)_mb$/)?.[1] || 0);
  const buildConfig = baseBuildConfig ? {
    ...baseBuildConfig,
    component_device_allocations: allocations,
    ...(allocatedBasissoftwareProfile ? {
      firmware_basis_variant: allocatedBasissoftwareProfile.class,
      partition_profile_id: allocatedBasissoftwareProfile.partition_profile_id,
      flash_size_mb: allocatedFlashSizeMb || undefined,
    } : {}),
  } : null;
  const sources = hardwareConfigurationSources(hardwareConfiguration, project.title);
  await Promise.all(sources.map((source) => projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
    method: "PUT",
    body: source,
  })));
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      hardware_profile_id: boardComponent?.board_profile_id || project.hardware_profile_id,
      device_id: primaryInventoryDevice?.device_id || "",
      build_config: buildConfig || null,
      view_manifest: developmentProjectViewManifest({
        title: project.title,
        description: project.summary,
        source: diagram.source,
        diagram,
        buildConfig,
        architectureDialog: existingManifest.architecture_dialog,
        templateId: existingManifest.template_id,
        templateModelVersion: existingManifest.template_ref?.model_schema_version,
        hardwareConfiguration,
        homeAutomationConfiguration: existingManifest.home_automation_configuration,
        gameConfiguration: existingManifest.game_configuration,
        pwaDashboardConfiguration: existingManifest.pwa_dashboard,
        dataLoggerConfiguration: existingManifest.data_logger,
        eventConfiguration: existingManifest.event_configuration,
      }),
    },
  });
  touchWorkspace(session, project.project_server_id, "development-hardware", `/app/development-platform/hardware/?project=${encodeURIComponent(project.project_server_id)}`);
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, {
    project: toPlatformProject(updated),
    hardware_configuration: hardwareConfiguration,
    hardware_architecture: {
      source: hardwareWiringPlantUml(hardwareConfiguration, project.title),
      title: "Hardware-Architektur",
      summary: "Vollstaendige Hardware-Realisierung des Projekts.",
    },
    saved_at: new Date().toISOString(),
  });
}

async function handleProjectComponentFeatures(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.build_config) {
    sendJson(res, 409, { error: "missing_build_config", message: "Das Projekt besitzt keine konfigurierbare Firmware-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const allowed = new Set(["wifi", "mqtt", "ota", "http", "webserver", "measurement_chart"]);
  const enabled = Array.isArray(body.enabled) ? body.enabled.map(String).filter((item) => allowed.has(item)) : [];
  const current = project.build_config.component_features || {};
  const webserver = body.webserver && typeof body.webserver === "object" ? body.webserver : {};
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      build_config: {
        ...project.build_config,
        component_features: {
          ...current,
          enabled,
          webserver: {
            ...(current.webserver || {}),
            title: String(webserver.title || "GerNetiX Device").trim().slice(0, 80),
            measurement_chart: Boolean(webserver.measurement_chart),
            measurement_label: String(webserver.measurement_label || "Messwert").trim().slice(0, 60),
            measurement_unit: String(webserver.measurement_unit || "").trim().slice(0, 16),
          },
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated) });
}

async function handleProjectComponentHardwareFeatures(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.build_config) {
    sendJson(res, 409, { error: "missing_build_config", message: "Das Projekt besitzt keine konfigurierbare IoT-Device-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const componentId = String(body.component_id || "").trim();
  const hardwareConfiguration = hardwareConfigurationFromManifest(project.view_manifest);
  const component = hardwareConfiguration?.components?.find((item) => item.component_id === componentId && item.abstract_type === "iot_device");
  if (!component) {
    sendJson(res, 409, { error: "iot_device_component_not_found", message: "Die IoT-Device-Komponente gehoert nicht zur Hardware-Architektur des Projekts." });
    return;
  }
  const boards = await loadProcessorBoards();
  const board = boards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
    .filter(Boolean).some((id) => String(id) === String(component.board_profile_id)));
  if (!board) {
    sendJson(res, 409, { error: "processor_board_not_found", message: "Das reale Board der IoT-Device-Komponente wurde im Hardware Catalog nicht gefunden." });
    return;
  }
  const resources = Array.isArray(board.peripheral_profile?.resources)
    ? board.peripheral_profile.resources
    : [
      { id: "adc", configurable: true, pin_profile_key: "analog_inputs" },
      { id: "pwm", configurable: true, pin_profile_key: "pwm_pins" },
    ];
  const configurable = new Map(resources.filter((item) => item.configurable).map((item) => [String(item.id), item]));
  const enabled = Array.isArray(body.enabled)
    ? Array.from(new Set(body.enabled.map(String).filter((item) => configurable.has(item))))
    : [];
  const unsupported = enabled.filter((item) => {
    const resource = configurable.get(item);
    if (resource.supported === false) return true;
    if (!resource.pin_profile_key) return false;
    return !Array.isArray(board.pin_profile?.[resource.pin_profile_key]) || board.pin_profile[resource.pin_profile_key].length === 0;
  });
  if (unsupported.length) {
    sendJson(res, 409, { error: "board_peripheral_not_supported", message: `Das gewaehlte Board unterstuetzt nicht: ${unsupported.join(", ")}.` });
    return;
  }
  const current = project.build_config.component_hardware_features || {};
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      build_config: {
        ...project.build_config,
        component_hardware_features: {
          ...current,
          [componentId]: { enabled },
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated) });
}

async function handleProjectPwaDashboard(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (project.view_manifest?.template_id !== "iot_datalogger_web_push_pwa") {
    sendJson(res, 409, { error: "pwa_dashboard_not_available", message: "Dieses Projekt besitzt keine konfigurierbare PWA-Dashboard-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const pwaDashboard = normalizePwaDashboardConfiguration(body);
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: {
        ...project.view_manifest,
        pwa_dashboard: pwaDashboard,
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated) });
}

async function handleProjectEventConfiguration(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (project.view_manifest?.template_id !== "event_driven_project_application") {
    sendJson(res, 409, { error: "event_configuration_not_available", message: "Dieses Projekt besitzt keinen konfigurierbaren Ereignis-Worker oder Dispatcher." });
    return;
  }
  const configuration = normalizeEventConfiguration(await readJsonBody(req), project.view_manifest);
  await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: {
        ...project.view_manifest,
        event_configuration: {
          ...(project.view_manifest.event_configuration || {}),
          [configuration.kind]: configuration.value,
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated) });
}

function normalizeEventConfiguration(input = {}, manifest = {}) {
  const kind = String(input.kind || "").trim();
  if (!new Set(["worker", "dispatcher"]).has(kind)) throw new Error("Ungueltige Ereigniskomponente.");
  if (kind === "worker") {
    const triggerType = String(input.trigger_type || "timer");
    if (!new Set(["timer", "project_event"]).has(triggerType)) throw new Error("Ungueltiger Ausloeser.");
    const cycleMinutes = Number(input.cycle_minutes || 15);
    if (!Number.isInteger(cycleMinutes) || cycleMinutes < 1 || cycleMinutes > 10080) throw new Error("Der Timer-Zyklus muss zwischen 1 und 10.080 Minuten liegen.");
    const eventName = String(input.event_name || "").trim().slice(0, 80);
    if (!eventName) throw new Error("Ein Ereignisname wird benoetigt.");
    return { kind, value: { schema_version: 1, event_name: eventName, trigger_type: triggerType, cycle_minutes: cycleMinutes } };
  }
  const conditionType = String(input.condition_type || "event_available");
  if (!new Set(["event_available", "field_equals"]).has(conditionType)) throw new Error("Ungueltige Bedingung.");
  const targetComponentId = String(input.target_component_id || "").trim();
  const components = hardwareConfigurationFromManifest(manifest)?.components || [];
  const validTarget = components.some((component) => component.component_id === targetComponentId && component.abstract_type === "iot_device" && /ziel|target/i.test(`${component.label || ""} ${component.component_path || ""}`));
  if (!validTarget) throw new Error("Waehle ein IoT-Zielgeraet aus diesem Projekt.");
  return {
    kind,
    value: {
      schema_version: 1,
      condition_type: conditionType,
      condition_value: String(input.condition_value || "").trim().slice(0, 120),
      target_component_id: targetComponentId,
      push_enabled: input.push_enabled === true,
    },
  };
}

function normalizePwaDashboardConfiguration(input = {}) {
  const cards = new Set(["current_values", "history", "events", "device_status"]);
  const visibleCards = Array.isArray(input.visible_cards || input.visibleCards)
    ? (input.visible_cards || input.visibleCards).map(String).filter((id) => cards.has(id))
    : Array.from(cards);
  return {
    schema_version: 1,
    title: String(input.title || "Mein Datenlogger").trim().slice(0, 80),
    visible_cards: Array.from(new Set(visibleCards)),
  };
}

function primaryProjectComponentPath(project) {
  return String(project?.build_config?.user_source_path || "").match(/^(Komponenten\/[^/]+)\//)?.[1] || "Komponenten/IoT-Device 1";
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
    const recoveryAccount = await assignFirstEsp32AsRecoveryToken(req, session, registered.device_id, hardwareProfileId);
    sendJson(res, 201, {
      ...decorateUserIdeDevice(accountDevice),
      recovery_token_assigned: Boolean(recoveryAccount),
      account: recoveryAccount || undefined,
    });
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
  const body = await readJsonBody(req);
  return claimPlatformDiscoveredDevice(req, res, session, body);
}

async function handlePlatformProvisioningSession(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const provisioningBinding = requiredField(body.provisioning_binding, "provisioning_binding");
    const token = await deviceManagementJson("/api/device-management/provisioning/tokens", {
      method: "POST",
      body: { account_id: accountId, provisioning_binding: provisioningBinding },
    });
    sendJson(res, 201, token);
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "provisioning_session_create_failed",
      message: error.message || "Provisionierungs-Token konnte nicht erstellt werden.",
    });
  }
}

async function handlePlatformProvisioningComplete(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const consumed = await deviceManagementJson("/api/device-management/provisioning/tokens/consume", {
      method: "POST",
      body: {
        provisioning_token: requiredField(body.provisioning_token, "provisioning_token"),
        provisioning_binding: requiredField(body.provisioning_binding, "provisioning_binding"),
      },
    });
    if (consumed.account_id !== accountId) throw new Error("Provisionierungs-Token gehoert nicht zum angemeldeten Account.");
    delete body.provisioning_token;
    delete body.provisioning_binding;
    return claimPlatformDiscoveredDevice(req, res, session, body);
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "provisioning_complete_failed",
      message: error.message || "WLAN-Provisionierung konnte nicht abgeschlossen werden.",
    });
  }
}

async function claimPlatformDiscoveredDevice(req, res, session, body) {
  try {
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
    const recoveryAccount = await assignFirstEsp32AsRecoveryToken(req, session, registered.device_id, hardwareProfileId);
    sendJson(res, 201, {
      ...decorateUserIdeDevice(accountDevice),
      recovery_token_assigned: Boolean(recoveryAccount),
      account: recoveryAccount || undefined,
    });
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
    const otaPreflight = await otaBuildDeployJson("/api/ota/preflight");
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
  const buildDeployClient = mode === "build_and_flash" ? otaBuildDeployJson : buildDeployJson;
  const buildDeployJob = await buildDeployClient("/api/build-jobs", {
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
  const completedBuildDeployJob = await waitForBuildDeployJob(buildDeployJob.job_id, buildDeployClient);
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
  let upstream = await fetch(`${buildDeployBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`);
  if (upstream.status === 404 && otaBuildDeployBaseUrl !== buildDeployBaseUrl) {
    upstream = await fetch(`${otaBuildDeployBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`);
  }
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
  const synchronizedItems = await Promise.all(response.items.map(async (project) => {
    const definition = userIdeState.projectDefinitions
      .find((item) => item.learning_project_id === project.learning_project_id);
    const needsLearningViewSync = definition?.slug === buttonToSmartphoneNotificationCourseModel.slug
      && Number(project.view_manifest?.schema_version || 0) < 4;
    return needsLearningViewSync ? synchronizeLearningProjectStructure(project, definition) : project;
  }));
  return mapUserIdeProjects(session, new Map(synchronizedItems.map((item) => [item.project_id, item])));
}

function mapUserIdeProjects(session, projectsById) {
  const userId = projectServerUserId(session);
  const workspace = getWorkspaceState(userId);
  const definitionIds = new Set(userIdeState.projectDefinitions.map((definition) => definition.project_server_id));
  const seededProjects = userIdeState.projectDefinitions.map((definition) => {
    return {
      ...definition,
      project_server_id: catalogProjectIdForDefinition(definition),
      owner_user_id: userId,
      hardware_profile_id: definition.hardware_profile_id,
      build_config: definition.build_config,
      linked_device_id: "",
      project_origin: "catalog",
      status: "catalog_template",
      last_build_status: "",
      source_count: 0,
      build_count: 0,
      access_model: definition.access_model || "subscription",
      view_manifest: projectViewManifest(definition),
      created_at: "",
      updated_at: "",
      last_opened_mode: "",
      last_opened_at: "",
      source_files: [],
    };
  });
  const customProjects = Array.from(projectsById.values())
    .filter((project) => !isRetiredCatalogProject(project))
    .filter((project) => !definitionIds.has(project.project_id) || isEstablishedLearningProject(project))
    .map((project) => mapProjectServerProject(session, project));
  return seededProjects.concat(customProjects)
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
}

function mapProjectServerProject(session, project) {
  const userId = projectServerUserId(session);
  const workspace = getWorkspaceState(userId);
  const learningDefinition = userIdeState.projectDefinitions
    .find((definition) => definition.learning_project_id === project.learning_project_id);
  if (learningDefinition && (project.project_id !== learningDefinition.project_server_id || isEstablishedLearningProject(project))) {
    return {
      ...learningDefinition,
      project_server_id: project.project_id,
      title: project.title || learningDefinition.title,
      summary: project.description || learningDefinition.summary,
      project_origin: "account_project",
      owner_user_id: project.user_id || userId,
      hardware_profile_id: project.hardware_profile_id || learningDefinition.hardware_profile_id,
      build_config: project.build_config || learningDefinition.build_config,
      linked_device_id: project.device_id || "",
      status: project.status || "active",
      last_build_status: latestBuildStatus(project),
      source_count: project.source_count || 0,
      build_count: project.build_count || 0,
      view_manifest: project.view_manifest || projectViewManifest(learningDefinition),
      created_at: project.created_at || "",
      updated_at: project.updated_at || "",
      last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
      last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
    };
  }
  const manifest = restoreDevelopmentTemplateReference(project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.description,
    source: initialArchitecturePlantUml(project.title),
  }), project);
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
        plan_id: accountSubscription(session).plan,
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
      // Ein Seed ist keine Nutzeraktion und darf weder die Projektliste noch das Anlegen eigener Projekte blockieren.
      if (![400, 409].includes(error.status)) throw error;
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
        method: "PUT",
        body: source,
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
  const subscription = accountSubscription(session);
  return {
    account_id: projectServerUserId(session),
    plan: subscription.plan,
    entitlements: subscription.entitlements,
    ai_credits: aiUsage.credits,
  };
}

function catalogProjectIdForDefinition(definition) {
  return `catalog_${definition.slug}`;
}

function isEstablishedLearningProject(project) {
  return project.learning_project_id === "learning_project.software_engineering_tamagotchi";
}

function isRetiredCatalogProject(project) {
  return project.project_id === "project_esp32-ota-bootstrap-firmware"
    || project.learning_project_id === "learning_project.esp32_ota_bootstrap_firmware";
}

async function assignFirstEsp32AsRecoveryToken(req, session, deviceId, hardwareProfileId) {
  if (!/esp32/i.test(String(hardwareProfileId || ""))) return null;
  if (Number(session.account?.recovery_board_count || 0) > 0) return null;
  const result = await auth.add_esp32_recovery_token(session.account.user_id, deviceId);
  session.account = result.account;
  updateCachedSessionAccount(req, result.account);
  return result.account;
}

function accountSubscription(session) {
  const configuredPlan = String(session?.account?.subscription_plan || session?.account?.plan || defaultAccountPlan).trim().toLowerCase();
  const premium = ["premium", "premium_demo", "premium-demo"].includes(configuredPlan);
  return {
    plan: premium ? "Premium" : "Kostenlos",
    entitlements: premium
      ? ["learn_guided_projects", "ide_edit_code", "build_and_flash", "ai_assistant", "web_push"]
      : ["ide_edit_code", "build_and_flash"],
  };
}

function hasEntitlements(session, requiredEntitlements = []) {
  const granted = new Set(accountSubscription(session).entitlements);
  return (requiredEntitlements || []).every((entitlement) => granted.has(entitlement));
}

function requireEntitlement(res, session, entitlement) {
  return requireEntitlements(res, session, [entitlement]);
}

function requireEntitlements(res, session, requiredEntitlements = []) {
  if (hasEntitlements(session, requiredEntitlements)) return true;
  sendJson(res, 403, {
    error: "premium_required",
    message: "Diese Funktion ist nur mit einem Premium-Abo verfuegbar.",
    required_entitlements: requiredEntitlements,
    help_url: "/hilfe/#ai-premium",
  });
  return false;
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
    node_name: device.node_name || "",
    hostname: device.hostname || device.node_name || "",
    hardware_profile_id: device.hardware_profile_id,
    technical_capability_ids: device.technical_capability_ids || [],
    instance_configuration: device.instance_configuration || {},
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

async function waitForBuildDeployJob(jobId, client = buildDeployJson) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const job = await client(`/api/build-jobs/${encodeURIComponent(jobId)}`);
    if (["succeeded", "failed", "replaced"].includes(job.status)) return job;
    await delay(1000);
  }
  return null;
}

async function loadBuildDeployJob(jobId) {
  const projectJob = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}`).catch(() => null);
  const client = projectJob?.mode === "build_and_flash" ? otaBuildDeployJson : buildDeployJson;
  return client(`/api/build-jobs/${encodeURIComponent(jobId)}`);
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
      firmware_basis_variant: project.build_config.firmware_basis_variant || "comfort",
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
  const subscription = accountSubscription(session);
  return {
    username: session.account.username || "",
    user_id: projectServerUserId(session),
    plan: subscription.plan,
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
    buttonToSmartphoneNotificationCourseModel.createProject(project, step),
    homeAutomationNetworkCourseModel.createProject(project, step),
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
    "plant-watering-control": ["capability.processor_esp32", "capability.wifi", "capability.digital_output"],
  };
  const accessModelsBySlug = {
    "arduino-blink": "free",
    "software-engineering-tamagotchi": "free",
    "arduino-atmel-bare-metal": "subscription",
    "smart-assistant-ai-automation": "subscription",
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
  if (project.slug === homeAutomationNetworkCourseModel.slug) {
    return homeAutomationNetworkCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === buttonToSmartphoneNotificationCourseModel.slug) {
    return buttonToSmartphoneNotificationCourseModel.createViewManifest(project, {
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

function developmentProjectViewManifest({ title, description = "", source = "", diagram = null, buildConfig = null, architectureDialog = null, templateId = "", templateModelVersion = 1, hardwareConfiguration = null, homeAutomationConfiguration = null, gameConfiguration = null, pwaDashboardConfiguration = null, dataLoggerConfiguration = null, eventConfiguration = null }) {
  const buildable = Boolean(buildConfig);
  const usesProjectTemplate = Boolean(templateId && templateId !== "empty");
  const derivedFrom = diagram?.derived_from || (usesProjectTemplate || buildable ? "project_template" : "persisted_project");
  const plantUmlSource = normalizeArchitecturePlantUml(stripPlantUmlNotes(source || diagram?.source || ""), derivedFrom);
  return {
    schema_version: 1,
    title: `${title || "Entwicklungsprojekt"} Architektur`,
    summary: description || "Projektgebundene Architektur-Discovery mit PlantUML-Skizze.",
    template_id: String(templateId || ""),
    ...(templateId ? { template_ref: { template_id: String(templateId), model_schema_version: Number(templateModelVersion) || 1 } } : {}),
    primary_source_path: buildable ? (buildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp") : "docs/architecture.puml",
    hide_source_editor: !buildable,
    mode: "architecture_discovery",
    ...(architectureDialog ? { architecture_dialog: normalizeArchitectureDialog(architectureDialog, diagram || { source: plantUmlSource }) } : {}),
    ...(homeAutomationConfiguration ? { home_automation_configuration: normalizeHomeAutomationConfiguration(homeAutomationConfiguration) } : {}),
    ...(gameConfiguration ? { game_configuration: normalizeTouchscreenGameConfiguration(gameConfiguration) } : {}),
    ...(pwaDashboardConfiguration ? { pwa_dashboard: normalizePwaDashboardConfiguration(pwaDashboardConfiguration) } : {}),
    ...(dataLoggerConfiguration ? { data_logger: normalizeDataLoggerConfiguration(dataLoggerConfiguration) } : {}),
    ...(eventConfiguration ? { event_configuration: eventConfiguration } : {}),
    views: [
      ...(buildable ? [{
        id: "firmware-source",
        type: "source_analysis",
        title: "IoT-Device 1 User Main",
        summary: "Account- und projektgebundene User-Main; die geschuetzte GerNetiX-Basissoftware wird erst im BuildPackage ergaenzt.",
        source_path: buildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp",
      }] : []),
      ...(plantUmlSource ? [{
        id: "architecture-diagram",
        type: "plantuml",
        title: diagram?.title || "Architektur-Skizze",
        summary: diagram?.summary || "Aus Architektur-Discovery gespeicherte PlantUML-Skizze.",
        source_path: "docs/architecture.puml",
        validation: { type: "plantuml_contains", must_contain: ["@startuml", "@enduml"] },
        payload: {
          source: plantUmlSource,
          derived_from: derivedFrom,
          ...(diagram?.function_coverage ? { function_coverage: diagram.function_coverage } : {}),
        },
      }] : []),
      ...(hardwareConfiguration ? [{
        id: "hardware-configuration",
        type: "hardware_configuration",
        title: "Hardware-Architektur",
        summary: "Vollstaendige Zuordnung von Prozessoren, Boards, Inventar-Devices, Sensoren, Aktoren, Messschaltungen und Pins.",
        source_path: "Architektur/verdrahtung/hardware.puml",
        payload: hardwareConfiguration,
      }] : []),
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
    "rectangle \"Projektidee / Anforderungen\" as requirements",
    "@enduml",
  ].join("\n");
}

function provisioningFirmwareRequest(searchParams) {
  const profile = String(searchParams.get("profile") || "").trim().toLowerCase();
  if (!new Set(["full", "medium", "low"]).has(profile)) {
    const error = new Error("Bitte zuerst ein Update- und Speicherprofil auswaehlen.");
    error.status = 400;
    error.code = "invalid_basissoftware_profile";
    throw error;
  }
  const hardwareProfileId = String(searchParams.get("hardware_profile_id") || "").trim();
  const flashSizeMb = Number.parseInt(String(searchParams.get("flash_size_mb") || ""), 10);
  if (!hardwareProfileId || ![4, 8, 16].includes(flashSizeMb)) {
    const error = new Error("Boardmodell und bestaetigte Flashgroesse werden fuer das Provisioning benoetigt.");
    error.status = 400;
    error.code = "provisioning_board_configuration_required";
    throw error;
  }
  return { profile, hardwareProfileId, flashSizeMb };
}

async function resolveProvisioningFirmwareArtifact({ profile, hardwareProfileId, flashSizeMb }) {
  let board;
  try {
    board = await hardwareCatalogJson(`/api/hardware-catalog/hardware-items/${encodeURIComponent(hardwareProfileId)}`);
  } catch (cause) {
    const error = new Error("Das ausgewaehlte Board konnte im Hardware-Katalog nicht fuer das Provisioning aufgeloest werden.");
    error.status = cause.status === 404 ? 404 : 502;
    error.code = "provisioning_hardware_catalog_unavailable";
    throw error;
  }
  const targetId = String(board.firmware_build_target_id || "");
  const target = getFirmwareBuildTarget(targetId);
  if (!target) {
    const error = new Error("Dieses Board besitzt noch kein exakt freigegebenes Firmware-Build-Target. Es wird deshalb nicht provisioniert.");
    error.status = 409;
    error.code = "provisioning_build_target_missing";
    throw error;
  }
  if (target.flash.size_mb !== flashSizeMb) {
    const error = new Error(`Das Board verlangt ${target.flash.size_mb} MB Flash; bestaetigt wurden ${flashSizeMb} MB.`);
    error.status = 409;
    error.code = "provisioning_flash_size_mismatch";
    throw error;
  }
  const release = getFactoryFirmwareRelease({ firmwareBuildTargetId: targetId, basissoftwareProfile: profile });
  if (!release) {
    const error = new Error(`Fuer ${target.title} ist das Profil ${profile.toUpperCase()} noch nicht als Factory-Release freigegeben.`);
    error.status = 409;
    error.code = "provisioning_firmware_variant_not_available";
    throw error;
  }
  return {
    id: release.artifact_id,
    label: release.label,
    fileName: release.file_name,
    path: path.join(provisioningFirmwareRoot, release.relative_file_path),
    firmwareBuildTargetId: targetId,
    version: release.version || "",
    flashMode: release.flash_mode || "dio",
    flashFreq: release.flash_freq || "40m",
    flashSize: release.flash_size || "keep",
  };
}

function normalizeDataLoggerConfiguration(input = {}) {
  return {
    schema_version: 1,
    enabled: input.enabled !== false,
    storage_scope: "project_private",
    configuration_state: "requires_sensor_configuration",
    user_configuration: Array.isArray(input.userConfiguration || input.user_configuration) ? (input.userConfiguration || input.user_configuration).map(String).slice(0, 8) : [],
  };
}

async function handlePlatformDeviceBasissoftwareProfileUpdate(req, res, session, accountDeviceId) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const result = await deviceManagementJson(
      `/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}`,
      {
        method: "PUT",
        body: { basissoftware_profile: body.basissoftware_profile || body.profile || body.profile_id },
      },
    );
    sendJson(res, 200, {
      device: decorateUserIdeDevice(result.account_device),
      requires_usb_reflash: result.requires_usb_reflash,
      message: result.message,
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "basissoftware_profile_update_failed",
      message: error.message || "Basissoftware-Profil konnte nicht gespeichert werden.",
      details: error.payload || {},
    });
  }
}

function defaultHomeAutomationConfiguration() {
  return normalizeHomeAutomationConfiguration({
    coordinator: "undecided",
    failure_policy: "local_fallback",
    state_model: { commands: true, desired_state: true, actual_state: true, events: true },
    nodes: [
      { node_id: "node_1", name: "Raumklima", role: "sensor_node", transport: "undecided", sensor_count: 2, actuator_count: 0, board_features: {} },
      { node_id: "node_2", name: "Lichtsteuerung", role: "actuator_node", transport: "undecided", sensor_count: 0, actuator_count: 1, board_features: {} },
      { node_id: "node_3", name: "Touchpanel", role: "control_node", transport: "undecided", sensor_count: 0, actuator_count: 0, board_features: { integrated_display: true, integrated_touchscreen: true } },
    ],
  });
}

function normalizeHomeAutomationConfiguration(input) {
  if (!input || typeof input !== "object") return null;
  const coordinator = ["undecided", "none", "gernetix_home_server", "home_assistant", "gernetix_with_home_assistant"]
    .includes(input.coordinator) ? input.coordinator : "undecided";
  const failurePolicy = ["local_fallback", "safe_state", "central_required", "undecided"]
    .includes(input.failure_policy) ? input.failure_policy : "undecided";
  const roles = new Set(["sensor_node", "actuator_node", "combined_node", "control_node", "gateway"]);
  const transports = new Set(["undecided", "local", "wifi_rest", "wifi_mqtt", "zigbee"]);
  const boardFeatureIds = ["integrated_display", "integrated_touchscreen", "battery_operation", "sd_card", "audio", "many_gpio"];
  const nodes = (Array.isArray(input.nodes) ? input.nodes : []).slice(0, 30).map((node, index) => {
    const boardFeatures = Object.fromEntries(boardFeatureIds.map((id) => [id, node.board_features?.[id] === true]));
    if (Number(node.control_count) > 0) boardFeatures.integrated_touchscreen = true;
    if (boardFeatures.integrated_touchscreen) boardFeatures.integrated_display = true;
    return {
      node_id: String(node.node_id || `node_${index + 1}`).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60),
      name: String(node.name || `IoT-Device ${index + 1}`).trim().slice(0, 120),
      role: roles.has(node.role) ? node.role : "combined_node",
      transport: transports.has(node.transport) ? node.transport : "undecided",
      sensor_count: Math.max(0, Math.min(20, Number(node.sensor_count) || 0)),
      actuator_count: Math.max(0, Math.min(20, Number(node.actuator_count) || 0)),
      board_features: boardFeatures,
    };
  });
  const stateModel = input.state_model && typeof input.state_model === "object" ? input.state_model : {};
  return {
    schema_version: 2,
    coordinator,
    failure_policy: failurePolicy,
    state_model: {
      commands: stateModel.commands !== false,
      desired_state: stateModel.desired_state !== false,
      actual_state: stateModel.actual_state !== false,
      events: stateModel.events !== false,
    },
    nodes,
    updated_at: new Date().toISOString(),
  };
}

function defaultTouchscreenGameConfiguration() {
  return normalizeTouchscreenGameConfiguration({
    pattern_id: "",
    selected_game_ids: ["nibbles", "frogger"],
    board_profile_id: "hardware.processor_board.generic_esp32_s3_touch_display",
    inventory_device_id: "",
  });
}

function normalizeTouchscreenGameConfiguration(input) {
  if (!input || typeof input !== "object") return null;
  const patterns = new Set(["", "touchscreen_game_loop", "event_driven_scene_loop", "turn_based_state_machine"]);
  const games = new Set(["nibbles", "snake", "frogger", "tic_tac_toe", "pong", "breakout", "memory"]);
  const selectedGameIds = Array.from(new Set(Array.isArray(input.selected_game_ids) ? input.selected_game_ids : []))
    .filter((id) => games.has(id))
    .slice(0, 7);
  return {
    schema_version: 1,
    pattern_id: patterns.has(input.pattern_id) ? input.pattern_id : "",
    selected_game_ids: selectedGameIds,
    board_profile_id: String(input.board_profile_id || "").slice(0, 180),
    inventory_device_id: String(input.inventory_device_id || "").slice(0, 180),
    updated_at: new Date().toISOString(),
  };
}

function isTouchscreenGameBoard(board) {
  const capabilities = new Set(Array.isArray(board?.capability_ids) ? board.capability_ids : []);
  return capabilities.has("capability.touchscreen_input") || /touch/i.test(`${board?.title || ""} ${board?.form_factor || ""}`);
}

function touchscreenGameInventoryMatches(boardProfileId, device) {
  const inventoryProfile = String(device?.hardware_profile_id || "");
  return inventoryProfile === boardProfileId
    || (boardProfileId === "hardware.processor_board.generic_esp32_s3_touch_display" && /touch|display/i.test(inventoryProfile));
}

function restoreDevelopmentTemplateReference(manifest, project) {
  if (manifest?.template_id || project?.learning_project_id !== "development_project") return manifest;
  const architectureView = (manifest?.views || []).find((view) => view.id === "architecture-diagram" || view.type === "plantuml");
  const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(architectureView?.payload?.source || ""), "project_template");
  if (!source) return manifest;
  const match = developmentProjectTemplateCatalog()
    .filter((template) => template.id !== "empty")
    .find((template) => normalizeArchitecturePlantUml(
      templateArchitecturePlantUml(developmentProjectTemplate(template.id), project.title),
      "project_template",
    ) === source);
  if (!match) return manifest;
  return {
    ...manifest,
    template_id: match.id,
    template_ref: { template_id: match.id, model_schema_version: match.model_schema_version || 1 },
  };
}

function normalizeArchitectureDiagram(input = {}) {
  const derivedFrom = String(input.derived_from || input.derivedFrom || "architecture_discovery_ai_response").trim();
  const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(input.source || ""), derivedFrom);
  return {
    type: "plantuml",
    title: String(input.title || "Architektur-Skizze").trim(),
    summary: String(input.summary || "Gespeicherte Architektur-Skizze.").trim(),
    source,
    derived_from: derivedFrom,
    generated_at: String(input.generated_at || input.generatedAt || new Date().toISOString()).trim(),
    confidence: Number(input.confidence || 0),
    detected_blocks: Array.isArray(input.detected_blocks || input.detectedBlocks)
      ? (input.detected_blocks || input.detectedBlocks).map(String)
      : [],
  };
}

function stripPlantUmlNotes(source) {
  const lines = String(source || "").split(/\r?\n/);
  const cleaned = [];
  let inNote = false;
  for (const line of lines) {
    if (/^\s*note\b/i.test(line)) {
      inNote = true;
      continue;
    }
    if (inNote) {
      if (/^\s*end\s+note\b/i.test(line)) inNote = false;
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeArchitecturePlantUml(source, derivedFrom = "") {
  const isTemplate = derivedFrom === "project_template" || /Startarchitektur aus Projekttemplate/i.test(source);
  // Logische Architektur bleibt notationsoffen; konkrete UML-Symbole gehoeren in Realisierungssichten.
  let normalized = String(source || "")
    .replace(/^(\s*)(?:node|component|database|cloud|queue|artifact)\s+("[^"]+")(\s+as\s+[A-Za-z_][A-Za-z0-9_]*)?/gmi, "$1rectangle $2$3");
  if (isTemplate) {
    normalized = normalized
      .replace(/ESP32 Datenlogger/g, "IoT-Device Datenlogger")
      .replace(/ESP32 Device/g, "IoT-Device")
      .replace(/ESP32-Device/g, "IoT-Device")
      .replace(/^\s*Startarchitektur aus Projekttemplate;.*$/gmi, "");
  }
  return numberGenericIotDeviceInstances(normalized).replace(/\n{3,}/g, "\n\n").trim();
}

function numberGenericIotDeviceInstances(source) {
  const text = String(source || "");
  const usedNumbers = new Set(Array.from(text.matchAll(/\bIoT[- ]Device\s+(\d+)\b/gi), (match) => Number(match[1])));
  let nextNumber = 1;
  return text.replace(/(\brectangle\s+")IoT[- ]Device(")/gi, (_match, prefix, suffix) => {
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    const instanceNumber = nextNumber;
    usedNumbers.add(instanceNumber);
    nextNumber += 1;
    return `${prefix}IoT-Device ${instanceNumber}${suffix}`;
  });
}

function architectureDiagramFromManifest(manifest = {}) {
  const view = (Array.isArray(manifest.views) ? manifest.views : [])
    .find((item) => item.id === "architecture-diagram" || item.type === "plantuml");
  return normalizeArchitectureDiagram({
    title: view?.title,
    summary: view?.summary,
    ...(view?.payload || {}),
  });
}

function hardwareConfigurationFromManifest(manifest = {}) {
  const view = (Array.isArray(manifest?.views) ? manifest.views : [])
    .find((item) => item.id === "hardware-configuration");
  return view?.payload && typeof view.payload === "object" ? view.payload : null;
}

function normalizeHardwareConfiguration(input = {}, project = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const rawComponents = Array.isArray(raw.components) ? raw.components.slice(0, 100) : [];
  let deviceIndex = 0;
  const components = rawComponents.map((component) => {
    const abstractType = ["iot_device", "sensor", "actuator", "actor", "structural"].includes(component.abstract_type)
      ? component.abstract_type
      : "structural";
    const concreteType = String(component.concrete_type || "").trim().slice(0, 80);
    const normalized = {
      component_id: requiredField(component.component_id, "component_id").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80),
      label: requiredField(component.label, "label").slice(0, 160),
      plantuml_type: String(component.plantuml_type || "component").slice(0, 40),
      abstract_type: abstractType,
      concrete_type: concreteType,
      sensor_category: String(component.sensor_category || "").trim().toLowerCase().slice(0, 80),
      signal_type: String(component.signal_type || "").trim().toLowerCase().slice(0, 80),
      processor_family: String(component.processor_family || "").trim().toLowerCase().slice(0, 80),
      processor_variant: String(component.processor_variant || "").trim().slice(0, 120),
      board_profile_id: String(component.board_profile_id || "").slice(0, 180),
      inventory_device_id: String(component.inventory_device_id || "").slice(0, 180),
      inventory_device_label: String(component.inventory_device_label || "").slice(0, 180),
      target_device_id: String(component.target_device_id || "").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80),
      pin: String(component.pin || "").slice(0, 80),
      secondary_pin: String(component.secondary_pin || "").slice(0, 80),
      properties: normalizeHardwareProperties(component.properties),
      circuit: hardwareCircuitFor(concreteType, component.properties),
    };
    if (abstractType === "iot_device") {
      normalized.component_path = deviceIndex === 0
        ? primaryProjectComponentPath(project)
        : `Komponenten/${slugifyHardwareFolder(normalized.label)}-${deviceIndex + 1}`;
      deviceIndex += 1;
    }
    return normalized;
  });
  return {
    schema_version: 4,
    components,
    updated_at: new Date().toISOString(),
  };
}

function normalizeHardwareProperties(input = {}) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const [key, value] of Object.entries(input).slice(0, 30)) {
    const normalizedKey = String(key).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60);
    if (!normalizedKey) continue;
    result[normalizedKey] = String(value ?? "").slice(0, 300);
  }
  return result;
}

function hardwareCircuitFor(concreteType, properties = {}) {
  if (concreteType === "pt1000") return { type: "pt1000_measurement", label: "PT1000-Messschaltung", stages: ["PT1000", "Konstantstromquelle / Messbruecke", "Messverstaerker", "ADC"] };
  if (["ntc", "ptc"].includes(concreteType)) return { type: "resistive_divider", label: "Widerstands-Messschaltung", stages: [concreteType.toUpperCase(), "Spannungsteiler", "ADC"] };
  const driver = String(properties?.motor_driver_type || "");
  if (concreteType === "dc_motor") return { type: "motor_driver", label: "DC-Motorsteuerung", stages: ["PWM / Richtung", driver === "low_side_mosfet" ? "MOSFET-Treiber" : "H-Bruecke", "DC-Motor"] };
  if (concreteType === "servo") return { type: "servo_driver", label: "Servo-Steuerung", stages: ["Zeitgeber", "Servo-PWM", "Servo"] };
  if (concreteType === "stepper_motor") return { type: "stepper_driver", label: "Schrittmotor-Steuerung", stages: ["Zeitgeber / RMT", driver === "four_phase" ? "4-Phasen-Treiber" : "STEP/DIR-Treiber", "Schrittmotor"] };
  if (concreteType === "synchronous_motor") return { type: "synchronous_motor_driver", label: "Synchronmotor-Steuerung", stages: [driver === "three_phase_six_step" ? "6-Step-Kommutierung" : "FOC", "Motor-PWM / ADC / Rotorlage", "3-Phasen-Leistungstreiber", "BLDC / PMSM"] };
  return null;
}

function hardwareConfigurationSources(configuration, title) {
  const devices = configuration.components.filter((component) => component.abstract_type === "iot_device");
  const deviceById = new Map(devices.map((component) => [component.component_id, component]));
  const sources = [{
    path: "Architektur/verdrahtung/hardware.puml",
    role: "hardware_architecture_view",
    content_type: "text/plain",
    content: hardwareWiringPlantUml(configuration, title),
  }];
  for (const device of devices) {
    const folder = device.component_path;
    const sensors = configuration.components.filter((component) => component.abstract_type === "sensor" && component.target_device_id === device.component_id);
    const actuators = configuration.components.filter((component) => component.abstract_type === "actuator" && component.target_device_id === device.component_id);
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Board/board.md`,
      role: "device_board_config",
      content_type: "text/markdown",
      content: hardwareBoardMarkdown(device),
    });
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Sensoren/in.md`,
      role: "device_sensor_input_config",
      content_type: "text/markdown",
      content: hardwareIoMarkdown("Sensor/in", device, sensors),
    });
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Aktoren/out.md`,
      role: "device_actuator_output_config",
      content_type: "text/markdown",
      content: hardwareIoMarkdown("Aktor/out", device, actuators),
    });
  }
  for (const component of configuration.components.filter((item) => item.circuit)) {
    const device = deviceById.get(component.target_device_id);
    const folder = device?.component_path || primaryHardwareComponentPath(devices);
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Schaltungen/${slugifyHardwareFolder(component.label)}.md`,
      role: "device_measurement_circuit_config",
      content_type: "text/markdown",
      content: hardwareCircuitMarkdown(component, device),
    });
  }
  return sources;
}

function primaryHardwareComponentPath(devices) {
  return devices[0]?.component_path || "Komponenten/IoT-Device";
}

function hardwareBoardMarkdown(device) {
  return [
    `# Board-Konfiguration: ${device.label}`,
    "",
    `- Prozessorfamilie: ${device.processor_family || "noch nicht gewaehlt"}`,
    `- Prozessor: ${device.processor_variant || "noch nicht gewaehlt"}`,
    `- Board-Profil: ${device.board_profile_id || "noch nicht gewaehlt"}`,
    `- Abstrakte Komponente: ${device.component_id}`,
    "",
    "Diese Auswahl konkretisiert das abstrakte IoT-Device. Sensoren, Aktoren und Pins bleiben in den zugehoerigen Hardware-Sichten getrennt.",
    "",
  ].join("\n");
}

function hardwareIoMarkdown(kind, device, components) {
  const lines = [`# ${kind}-Konfiguration: ${device.label}`, ""];
  if (!components.length) lines.push("- Keine Komponente zugeordnet.");
  for (const component of components) {
    lines.push(`## ${component.label}`);
    if (component.abstract_type === "sensor") lines.push(`- Sensorart: ${component.sensor_category || "offen"}`);
    if (component.abstract_type === "sensor") lines.push(`- Erfassung: ${component.signal_type || "offen"}`);
    lines.push(`- Konkreter Typ: ${component.concrete_type || "offen"}`);
    lines.push(`- Pin: ${component.pin || "offen"}`);
    if (component.secondary_pin) lines.push(`- Zweiter Pin: ${component.secondary_pin}`);
    if (component.circuit) lines.push(`- Vorschaltung: ${component.circuit.label}`);
    for (const [key, value] of Object.entries(component.properties || {})) lines.push(`- ${key}: ${value}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function hardwareCircuitMarkdown(component, device) {
  return [
    `# Schaltung: ${component.label}`,
    "",
    `- Typ: ${component.circuit.label}`,
    `- Signalkette: ${component.circuit.stages.join(" -> ")}`,
    `- Ziel: ${device?.label || component.target_device_id || "IoT-Device"}`,
    `- Ausgang der Schaltung: ${component.pin || "ADC/GPIO noch offen"}`,
    "",
    "Die Vorschaltung ist ein notwendiger Teil der Hardware-Realisierung und keine direkte Sensor-Pin-Verbindung.",
    "",
  ].join("\n");
}

function hardwareWiringPlantUml(configuration, title) {
  const devices = new Map(configuration.components.filter((component) => component.abstract_type === "iot_device").map((component) => [component.component_id, component]));
  const lines = ["@startuml", `title Hardware-Architektur: ${String(title || "Entwicklungsprojekt").replace(/"/g, "'")}`, "left to right direction", "skinparam componentStyle rectangle", ""];
  for (const device of devices.values()) {
    const deviceLabel = plantUmlLabel([
      device.label,
      `Prozessorfamilie: ${device.processor_family || "offen"}`,
      `Prozessor: ${device.processor_variant || "offen"}`,
      `Board: ${device.board_profile_id || "offen"}`,
      ...hardwarePropertyLines(device.properties),
    ]);
    lines.push(`node "${deviceLabel}" as hw_${device.component_id}`);
    if (device.inventory_device_id) {
      const inventoryAlias = `inventory_${device.component_id}`;
      lines.push(`node "${plantUmlLabel(["Inventar-Device", device.inventory_device_label || device.inventory_device_id, `ID: ${device.inventory_device_id}`])}" as ${inventoryAlias}`);
      lines.push(`hw_${device.component_id} ..> ${inventoryAlias} : Inventarzuordnung`);
    }
  }
  for (const component of configuration.components.filter((item) => ["sensor", "actuator"].includes(item.abstract_type))) {
    const alias = `hw_${component.component_id}`;
    const detailLines = component.abstract_type === "sensor"
      ? [component.label, `Sensorart: ${component.sensor_category || "offen"}`, `Erfassung: ${component.signal_type || "offen"}`, `Sensor: ${component.concrete_type || "offen"}`]
      : [component.label, `Aktor: ${component.concrete_type || "offen"}`];
    lines.push(`component "${plantUmlLabel([...detailLines, ...hardwarePropertyLines(component.properties)])}" as ${alias}`);
    const pinLabel = [component.pin || "Pin offen", component.secondary_pin ? `zweiter Pin: ${component.secondary_pin}` : ""].filter(Boolean).join(" / ");
    if (component.circuit) {
      lines.push(`component "${plantUmlLabel([component.circuit.label, ...component.circuit.stages])}" as ${alias}_circuit`);
      lines.push(`${alias} --> ${alias}_circuit`);
      lines.push(`${alias}_circuit --> hw_${component.target_device_id} : ${plantUmlText(pinLabel)}`);
    } else if (devices.has(component.target_device_id)) {
      lines.push(`${alias} --> hw_${component.target_device_id} : ${plantUmlText(pinLabel)}`);
    }
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function plantUmlLabel(lines) {
  return lines.filter(Boolean).map(plantUmlText).join("\\n");
}

function hardwarePropertyLines(properties = {}) {
  return Object.entries(properties).map(([key, value]) => `${key}: ${value}`);
}

function plantUmlText(value) {
  return String(value || "").replace(/["\\]/g, "'").slice(0, 180);
}

function slugifyHardwareFolder(value) {
  return String(value || "Hardware")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Hardware";
}

function buildConfigForBoard(boardProfileId, existing = null) {
  const common = { ...(existing || {}), libraries: existing?.libraries || [] };
  if (/arduino_nano_r3_atmega328p/.test(boardProfileId)) return { ...common, platform: "atmelavr", framework: "arduino", board: "nanoatmega328", environment: "nanoatmega328", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "" };
  if (/esp8266|d1_mini/.test(boardProfileId)) return { ...common, platform: "espressif8266", framework: "arduino", board: "d1_mini", environment: "d1_mini", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "" };
  if (/esp32_s3|esp32-s3/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: existing?.framework || "espidf", board: "esp32-s3-devkitc-1", environment: "esp32-s3-devkitc-1", firmware_basis_id: "gernetix-runtime-basissoftware", firmware_basis_version: existing?.firmware_basis_version || "workspace", firmware_basis_variant: existing?.firmware_basis_variant || "comfort", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/user/user_app.cpp" };
  if (/esp32|wroom32|nano_esp32/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: existing?.framework || "espidf", board: "esp32dev", environment: "esp32dev", firmware_basis_id: "gernetix-runtime-basissoftware", firmware_basis_version: existing?.firmware_basis_version || "workspace", firmware_basis_variant: existing?.firmware_basis_variant || "comfort", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/user/user_app.cpp" };
  return existing;
}

function normalizeArchitectureDialog(input = {}, diagram = null) {
  const messages = Array.isArray(input.messages)
    ? input.messages.slice(-80).map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: String(message.content || "").slice(0, 8000),
      ...(message.usage && typeof message.usage === "object" ? { usage: message.usage } : {}),
      ...(message.routing && typeof message.routing === "object" ? { routing: message.routing } : {}),
    })).filter((message) => message.content)
    : [];
  return {
    messages,
    assistantMode: String(input.assistantMode || input.assistant_mode || "architecture_structure"),
    lastRouting: input.lastRouting || input.last_routing || null,
    architectureDiagram: diagram?.source ? normalizeArchitectureDiagram(diagram) : null,
    updated_at: new Date().toISOString(),
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

function demoProjectSources(project, options = {}) {
  if (project.slug === tamagotchiEntryCourseModel.slug) {
    return tamagotchiEntryCourseModel.createSources(project, primarySourcePath);
  }
  if (project.slug === smartAssistantCourseModel.slug) {
    return smartAssistantCourseModel.createSources();
  }
  if (project.slug === buttonToSmartphoneNotificationCourseModel.slug) {
    return buttonToSmartphoneNotificationCourseModel.createSources(options);
  }
  if (project.slug === homeAutomationNetworkCourseModel.slug) {
    return homeAutomationNetworkCourseModel.createSources();
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

function updateCachedSessionAccount(req, account) {
  const token = readSessionToken(req);
  const existing = sessions.get(token);
  if (existing) sessions.set(token, { ...existing, account });
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
  const published = platformDownloadRepository?.listCurrent("serial-service") || [];
  const definitions = [
    {
      platform: "macos",
      architecture: "arm64",
      label: "Für macOS",
      localFilenames: [
        `GerNetiX-Serial-Service-${usbSerialHelperManifest.version}-mac-arm64.pkg`,
        "GerNetiX-Serial-Service-mac-arm64.pkg",
      ],
      detail: "Installationspaket · Apple Silicon",
    },
    {
      platform: "windows",
      architecture: "x64",
      label: "Für Windows",
      localFilenames: ["GerNetiX-Serial-Service-win-x64.exe"],
      detail: "Hintergrunddienst · Windows 10/11 x64",
    },
  ];
  return definitions.map((definition) => {
    const localFilename = definition.localFilenames.find((file) => files.includes(file)) || "";
    const release = published.find((item) =>
      item.platform === definition.platform && item.architecture === definition.architecture);
    const filename = localFilename || release?.file_name || "";
    return {
      platform: definition.platform,
      architecture: definition.architecture,
      label: release?.label || definition.label,
      detail: release?.detail || definition.detail,
      available: Boolean(filename),
      file_name: filename,
      url: filename ? `/downloads/usb-serial-helper/${encodeURIComponent(filename)}` : "",
      source: localFilename ? "local" : release ? "published" : "",
      version: release?.version || (localFilename ? usbSerialHelperManifest.version : ""),
      sha256: release?.sha256 || "",
      size_bytes: release?.size_bytes || (localFilename ? fs.statSync(path.join(usbSerialHelperDistDir, localFilename)).size : 0),
    };
  });
}

async function serveUsbSerialHelperDownload(res, filename) {
  const download = usbSerialHelperDownloads().find((item) => item.available && decodeURIComponent(item.url).endsWith(`/${filename}`));
  if (!download) {
    sendJson(res, 404, { error: "download_not_found" });
    return;
  }
  if (download.source === "published") {
    const release = platformDownloadRepository.getContent(
      "serial-service",
      download.version,
      download.platform,
      download.architecture,
    );
    res.writeHead(200, {
      "Content-Type": release.content_type,
      "Content-Disposition": `attachment; filename="${release.file_name.replace(/[\"\\]/g, "")}"`,
      "Content-Length": release.size_bytes,
      "X-Content-SHA256": release.sha256,
      "Cache-Control": "private, no-store",
    });
    res.end(release.content_blob);
    return;
  }
  const filePath = path.join(usbSerialHelperDistDir, filename);
  res.writeHead(200, {
    "Content-Type": filename.endsWith(".pkg") ? "application/vnd.apple.installer+xml" : "application/vnd.microsoft.portable-executable",
    "Content-Disposition": `attachment; filename="${filename.replace(/[\"\\]/g, "")}"`,
    "Content-Length": fs.statSync(filePath).size,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
