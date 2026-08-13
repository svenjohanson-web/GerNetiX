"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { registerKnowledgeRoutes } = require("../src/dev/server/knowledge-routes");
const { createRequestHandler, requestPath } = require("../src/dev/server/request-handler");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const { createSessionAccess } = require("../src/dev/server/session-access");
const { registerPlatformRoutes } = require("../src/dev/server/platform-routes");
const { registerAuthRoutes } = require("../src/dev/server/auth-routes");
const { registerAccountRoutes } = require("../src/dev/server/account-routes");
const { registerHardwareRoutes } = require("../src/dev/server/hardware-routes");
const { registerDeviceRoutes } = require("../src/dev/server/device-routes");
const { registerCommunityRoutes } = require("../src/dev/server/community-routes");
const { registerBuildRoutes } = require("../src/dev/server/build-routes");
const { registerProjectRoutes } = require("../src/dev/server/project-routes");
const { registerSystemRoutes } = require("../src/dev/server/system-routes");
const { registerDownloadRoutes } = require("../src/dev/server/download-routes");
const { registerPlatformExtraRoutes } = require("../src/dev/server/platform-extra-routes");
const { isPublicAppAsset, registerWebRoutes } = require("../src/dev/server/web-routes");

test("dispatches registered routes and leaves legacy routes untouched", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registry.register({
    method: "POST",
    pattern: /^\/items\/([^/]+)$/,
    handler: ({ match }) => calls.push(match[1]),
  });

  assert.equal(await registry.dispatch({
    req: { method: "POST" },
    res: {},
    url: new URL("http://localhost/items/42"),
  }), true);
  assert.deepEqual(calls, ["42"]);
  assert.equal(await registry.dispatch({
    req: { method: "GET" },
    res: {},
    url: new URL("http://localhost/items/42"),
  }), false);
});

test("central session access returns the session or one uniform 401 response", async () => {
  const responses = [];
  const authenticated = createSessionAccess({
    resolveSession: async () => ({ account: { user_id: "user-1" } }),
    sendJson: (...args) => responses.push(args),
  });
  assert.equal((await authenticated.requireSession({}, {})).account.user_id, "user-1");

  const anonymous = createSessionAccess({
    resolveSession: async () => null,
    sendJson: (res, status, body) => responses.push({ res, status, body }),
  });
  const res = {};
  assert.equal(await anonymous.requireSession({}, res), null);
  assert.deepEqual(responses.at(-1), { res, status: 401, body: { error: "not_authenticated" } });
});

test("knowledge route uses centralized session access and decodes the chapter id", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registerKnowledgeRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    resolveSession: async () => null,
    accountSubscription: () => ({ entitlements: [] }),
    knowledgeContentStore: { responseFor: () => null },
    markChapterRead: async (...args) => calls.push(args),
    sendJson: () => {},
  });
  const res = {};
  assert.equal(await registry.dispatch({
    req: { method: "POST" },
    res,
    url: new URL("http://localhost/api/platform/knowledge/chapters/radio%20basics/read"),
  }), true);
  assert.equal(calls[0][2], "radio basics");
});

test("platform routes share authentication and preserve their existing handlers", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registerPlatformRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({ active: true }),
    sendJson: (res, status, body) => calls.push([status, body]),
    handleSummary: async () => calls.push("summary"),
    handleBootstrap: async () => calls.push("bootstrap"),
    updateWorkspaceState: (session, body) => ({ user: session.account.user_id, ...body }),
    updateLearningProgress: async (session, body) => ({ user: session.account.user_id, ...body }),
  });
  const res = {};
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res, url: new URL("http://localhost/api/platform/summary") }), true);
  assert.equal(await registry.dispatch({ req: { method: "POST" }, res, url: new URL("http://localhost/api/platform/workspace-state") }), true);
  assert.deepEqual(calls, ["summary", [200, { user: "user-1", active: true }]]);
});

test("auth routes dispatch existing handlers and keep session method compatibility", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  const handler = (req) => calls.push(req.method);
  registerAuthRoutes({
    registry,
    readJsonBody: async () => ({}),
    sendJson: () => {},
    redirect: () => {},
    recordSystemEvent: async () => {},
    passkeyBrowserFailureEvent: (value) => value,
    auth: () => ({}),
    handleLogin: handler,
    handleRegister: handler,
    handlePasskeyRegistrationOptions: handler,
    handlePasskeyRegistrationVerify: handler,
    handlePasskeyAuthenticationOptions: handler,
    handlePasskeyAuthenticationVerify: handler,
    handleExternalLogin: handler,
    handleLogout: handler,
    handleSession: handler,
  });
  assert.equal(await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/login") }), true);
  assert.equal(await registry.dispatch({ req: { method: "PATCH" }, res: {}, url: new URL("http://localhost/api/session") }), true);
  assert.deepEqual(calls, ["POST", "PATCH"]);
});

test("account routes derive guest and profile state through their injected boundaries", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  const sessions = new Map();
  registerAccountRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({ locale: "de", next: "/app/learn/" }),
    sendJson: (res, status, body) => responses.push([status, body]),
    auth: () => ({ create_guest: async () => ({ account: { user_id: "guest-1" }, session: { token: "token-1", expires_at: "later" } }) }),
    sessions,
    setSessionCookie: () => {},
    sanitizeNextPath: (value) => value,
    updateCachedSessionAccount: () => {},
    accountAssetRepository: () => null,
    createAccountTransparency: async () => ({}),
  });
  assert.equal(await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/account/guest") }), true);
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/api/account/access-profile") }), true);
  assert.equal(sessions.get("token-1").account.user_id, "guest-1");
  assert.equal(responses[0][1].next, "/app/learn/");
  assert.equal(responses[1][1].account.user_id, "user-1");
});

test("hardware routes keep catalog access behind the shared session boundary", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  registerHardwareRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({}),
    sendJson: (res, status, body) => responses.push([status, body]),
    loadAvailableProcessorBoards: async () => [{ id: "board-1" }],
    projectServerUserId: () => "user-1",
    loadAccountBoardConfigurations: async () => [],
    deviceManagementJson: async () => ({}),
    hardwareCatalogJson: async () => ({}),
    loadSensors: async () => [],
    recordSystemEvent: () => {},
  });
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/api/platform/hardware/processor-boards") }), true);
  assert.deepEqual(responses, [[200, { items: [{ id: "board-1" }] }]]);
});

test("device routes preserve decoded device ids and existing handler ownership checks", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registerDeviceRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    sendJson: () => {},
    discoverNetworkDevices: async () => ({}),
    handleDeviceConnectivityCheck: async () => {},
    listUsbSerialPorts: async () => [],
    handlePlatformDiscoveredDeviceClaim: async () => {},
    handlePlatformDeviceCreate: async () => {},
    handlePlatformDeviceBasissoftwareProfileUpdate: async () => {},
    handlePlatformDeviceVoiceAiPolicyUpdate: async (req, res, session, deviceId) => calls.push([session.account.user_id, deviceId, "voice-ai"]),
    handlePlatformDeviceRemove: async (res, session, deviceId) => calls.push([session.account.user_id, deviceId]),
    handlePlatformProvisioningSession: async () => {},
    handlePlatformProvisioningComplete: async () => {},
    loadUserIdeDevices: async () => [],
    handleDeviceRecoveryFirmwareCheck: async () => {},
  });
  assert.equal(await registry.dispatch({ req: { method: "DELETE" }, res: {}, url: new URL("http://localhost/api/platform/devices/device%2042") }), true);
  assert.equal(await registry.dispatch({ req: { method: "PUT" }, res: {}, url: new URL("http://localhost/api/platform/devices/device%2042/voice-ai-policy") }), true);
  assert.deepEqual(calls, [["user-1", "device 42"], ["user-1", "device 42", "voice-ai"]]);
});

test("community routes keep public reads separate from authenticated writes", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registerCommunityRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1", username: "User" } }),
    readJsonBody: async () => ({ visibility: "public" }),
    sendJson: (res, status, body) => calls.push([status, body]),
    communityJson: async (path, options) => ({ path, actor: options?.headers?.["X-GerNetiX-Community-Actor"] || "" }),
    auth: () => ({}),
    createCommunityProjectSnapshot: async () => ({}),
    notifyPrivateCommunityRequest: async () => {},
  });
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/api/public/community/questions") }), true);
  assert.equal(await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/community/questions") }), true);
  assert.deepEqual(calls, [
    [200, { path: "/api/community/questions", actor: "" }],
    [201, { path: "/api/community/questions", actor: "user-1" }],
  ]);
});

test("community marketplace forwards an electronics classified without a project snapshot", async () => {
  const registry = createRouteRegistry();
  let forwarded;
  registerCommunityRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1", username: "Ada" } }),
    readJsonBody: async () => ({ title: "ESP32", condition: "good", price_cents: 1200 }),
    sendJson: () => {},
    communityJson: async (path, options) => { forwarded = { path, body: options.body }; return { listing_id: "listing-1" }; },
    auth: () => ({}),
    createCommunityProjectSnapshot: async () => { throw new Error("must not create project snapshot"); },
    notifyPrivateCommunityRequest: async () => {},
  });

  assert.equal(await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/community/marketplace/listings") }), true);
  assert.equal(forwarded.path, "/api/community/marketplace/listings");
  assert.equal(forwarded.body.author_label, "Ada");
  assert.equal(forwarded.body.project_snapshot, undefined);
});

test("community ideas and discussion derive the author label from the session", async () => {
  const registry = createRouteRegistry();
  const forwarded = [];
  registerCommunityRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1", username: "Ada" } }),
    readJsonBody: async () => ({ title: "Idee", body: "Feedback" }),
    sendJson: () => {},
    communityJson: async (path, options) => { forwarded.push([path, options.body]); return {}; },
    auth: () => ({}), createCommunityProjectSnapshot: async () => ({}), notifyPrivateCommunityRequest: async () => {},
  });

  await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/community/ideas") });
  await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/community/ideas/idea-1/comments") });
  assert.deepEqual(forwarded.map((entry) => entry[1].author_label), ["Ada", "Ada"]);
});

test("community showcase derives ownership and creates a bounded project snapshot", async () => {
  const registry = createRouteRegistry();
  let forwarded;
  registerCommunityRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1", username: "Ada" } }),
    readJsonBody: async () => ({ project_id: "project-1", title: "Showcase" }),
    sendJson: () => {},
    communityJson: async (path, options) => { forwarded = { path, body: options.body }; return {}; },
    auth: () => ({}),
    createCommunityProjectSnapshot: async (session, projectId) => ({ snapshot_id: `${session.account.user_id}:${projectId}`, sources: [{ path: "src/main.cpp", content: "safe" }] }),
    notifyPrivateCommunityRequest: async () => {},
  });

  await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/community/showcases") });
  assert.equal(forwarded.path, "/api/community/showcases");
  assert.equal(forwarded.body.author_label, "Ada");
  assert.equal(forwarded.body.project_id, undefined);
  assert.equal(forwarded.body.project_snapshot.snapshot_id, "user-1:project-1");
});

test("build artifact routes retain account ownership checks", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  registerBuildRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({}),
    sendJson: (res, status, body) => responses.push([status, body]),
    handleUserIdeBuildJob: async () => {},
    loadUserIdeProjects: async () => [],
    buildDeployJson: async () => ({}),
    projectServerJson: async () => ({ user_id: "another-user" }),
    loadBuildDeployJob: async () => ({}),
    recordCompletedBuildJob: async () => {},
    browserFlashManifest: () => ({}),
    projectServerUserId: () => "user-1",
    proxyBuildArtifact: async () => {},
  });
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/api/user-ide/build-artifacts/job-1/firmware.bin") }), true);
  assert.deepEqual(responses, [[404, { error: "build_artifact_not_found" }]]);
});

test("owned builds expose firmware but deny symbol and diagnostic artifact downloads", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  const proxied = [];
  const artifacts = Object.fromEntries(["firmware.bin", "firmware.elf", "firmware.map", "build.log"]
    .map((file_name) => [file_name, { file_name }]));
  registerBuildRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({}),
    sendJson: (res, status, body) => responses.push([status, body]),
    handleUserIdeBuildJob: async () => {},
    loadUserIdeProjects: async () => [],
    buildDeployJson: async () => ({}),
    projectServerJson: async () => ({ user_id: "user-1", result: { build: { artifacts } } }),
    loadBuildDeployJob: async () => ({}),
    recordCompletedBuildJob: async () => {},
    browserFlashManifest: () => ({}),
    projectServerUserId: () => "user-1",
    proxyBuildArtifact: async (_res, jobId, fileName) => proxied.push([jobId, fileName]),
  });
  for (const fileName of ["firmware.bin", "firmware.elf", "firmware.map", "build.log"]) {
    await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL(`http://localhost/api/user-ide/build-artifacts/job-1/${fileName}`) });
  }
  assert.deepEqual(proxied, [["job-1", "firmware.bin"]]);
  assert.deepEqual(responses, [
    [404, { error: "build_artifact_not_found" }],
    [404, { error: "build_artifact_not_found" }],
    [404, { error: "build_artifact_not_found" }],
  ]);
});

test("basissoftware build status never returns raw compiler logs", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  registerBuildRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({}),
    sendJson: (res, status, body) => responses.push([status, body]),
    handleUserIdeBuildJob: async () => {},
    loadUserIdeProjects: async () => [],
    buildDeployJson: async () => ({}),
    projectServerJson: async () => ({
      user_id: "user-1",
      build_config: { firmware_basis_id: "gernetix-runtime-basissoftware" },
      error: { details: { build_log: "secret basis source path" } },
    }),
    loadBuildDeployJob: async () => ({
      status: "failed",
      mode: "build",
      error: { message: "Build fehlgeschlagen", details: { build_log: "secret worker path" } },
      progress: [{ sequence: 1, phase: "compiling", message: "Compiling secret/functions/pairing.cpp", at: "now" }],
      result: { build: { artifacts: {} } },
    }),
    recordCompletedBuildJob: async () => {},
    browserFlashManifest: () => [],
    projectServerUserId: () => "user-1",
    proxyBuildArtifact: async () => {},
  });
  await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/api/user-ide/build-jobs/job-1/status") });
  assert.equal(responses[0][1].build_log, "");
  assert.equal(responses[0][1].protected_build_diagnostics, true);
  assert.deepEqual(responses[0][1].progress, [
    { sequence: 1, phase: "compiling", message: "Firmware wird kompiliert.", at: "now" },
  ]);
  assert.equal(JSON.stringify(responses).includes("secret"), false);
});

test("build cancellation keeps account ownership and targets the central coordinator", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  const forwarded = [];
  registerBuildRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({}),
    sendJson: (res, status, body) => responses.push([status, body]),
    handleUserIdeBuildJob: async () => {},
    loadUserIdeProjects: async () => [],
    buildDeployJson: async (path, options) => {
      forwarded.push([path, options]);
      return { job_id: "job 42", status: "cancelling" };
    },
    projectServerJson: async () => ({ user_id: "user-1" }),
    loadBuildDeployJob: async () => ({}),
    recordCompletedBuildJob: async () => {},
    browserFlashManifest: () => ({}),
    projectServerUserId: () => "user-1",
    proxyBuildArtifact: async () => {},
  });

  assert.equal(await registry.dispatch({
    req: { method: "POST" },
    res: {},
    url: new URL("http://localhost/api/user-ide/build-jobs/job%2042/cancel"),
  }), true);
  assert.deepEqual(forwarded, [["/api/build-jobs/job%2042/cancel", { method: "POST" }]]);
  assert.deepEqual(responses, [[202, { job_id: "job 42", status: "cancelling" }]]);
});

test("crash symbolization is account-bound and requires the exact persisted build id", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  const forwarded = [];
  const buildId = "a".repeat(64);
  registerBuildRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({ build_id: buildId, addresses: ["0x40001234", "0x40005678"] }),
    sendJson: (res, status, body) => responses.push([status, body]),
    handleUserIdeBuildJob: async () => {},
    loadUserIdeProjects: async () => [],
    buildDeployJson: async (path, options) => {
      forwarded.push([path, options]);
      return { status: "symbolized", build_id: buildId, frames: [
        { address: "0x40001234", resolved: true, function: "userMain", file: "/build/src/user/user_app.cpp", line: 5 },
        { address: "0x40005678", resolved: true, function: "internalPairing", file: "/build/src/functions/pairing.cpp", line: 19 },
      ] };
    },
    projectServerJson: async () => ({
      user_id: "user-1",
      customer_debug_source_paths: ["src/user/user_app.cpp"],
      result: { build: { build_id: buildId } },
    }),
    loadBuildDeployJob: async () => ({}),
    recordCompletedBuildJob: async () => {},
    browserFlashManifest: () => [],
    projectServerUserId: () => "user-1",
    proxyBuildArtifact: async () => {},
  });
  assert.equal(await registry.dispatch({
    req: { method: "POST" }, res: {},
    url: new URL("http://localhost/api/user-ide/build-jobs/job-1/symbolize"),
  }), true);
  assert.deepEqual(forwarded, [["/api/build-jobs/job-1/symbolize", {
    method: "POST", body: { build_id: buildId, addresses: ["0x40001234", "0x40005678"] },
  }]]);
  assert.deepEqual(responses, [[200, { status: "symbolized", build_id: buildId, frames: [
    { address: "0x40001234", resolved: true, function: "userMain", file: "/build/src/user/user_app.cpp", line: 5 },
    { address: "0x40005678", resolved: false, protected: true, function: "", file: "", line: 0 },
  ] }]]);
});

test("USB flash reuses an owned successful build only after the Project Server confirms its snapshot", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  registerBuildRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    readJsonBody: async () => ({ software_unit_id: "camera" }),
    sendJson: (res, status, body) => responses.push([status, body]),
    handleUserIdeBuildJob: async () => {},
    loadUserIdeProjects: async () => [],
    buildDeployJson: async () => ({}),
    projectServerJson: async (path) => path.endsWith("/reuse-status")
      ? { reusable: true, reason: "build_snapshot_matches" }
      : {
          build_job_id: "job-1", build_deploy_job_id: "job-1", project_id: "project-1",
          user_id: "user-1", software_unit_id: "camera", mode: "build", status: "succeeded",
          build_config: {}, result: { build: { artifacts: {} } },
        },
    loadBuildDeployJob: async () => ({}),
    recordCompletedBuildJob: async () => {},
    browserFlashManifest: () => [
      { name: "bootloader.bin" }, { name: "partitions.bin" }, { name: "firmware.bin" },
    ],
    projectServerUserId: () => "user-1",
    proxyBuildArtifact: async () => {},
  });

  assert.equal(await registry.dispatch({
    req: { method: "POST" },
    res: {},
    url: new URL("http://localhost/api/user-ide/build-jobs/job-1/reuse-usb-flash"),
  }), true);
  assert.equal(responses[0][0], 200);
  assert.equal(responses[0][1].reused_for_usb_flash, true);
  assert.equal(responses[0][1].build_job_id, "job-1");
});

test("project routes decode project ids before invoking domain handlers", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registerProjectRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    handlePlatformProjectDelete: async (res, session, projectId) => calls.push([session.account.user_id, projectId]),
  });
  assert.equal(await registry.dispatch({
    req: { method: "DELETE" },
    res: {},
    url: new URL("http://localhost/api/platform/projects/project%2042"),
  }), true);
  assert.deepEqual(calls, [["user-1", "project 42"]]);
});

test("system health exposes runtime identity without requiring a session", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  registerSystemRoutes({
    registry,
    sendJson: (res, status, body) => responses.push([status, body]),
    identityPersistenceBackend: "postgres",
    identityRuntimeLocation: "server",
    identityRemoteDev: false,
  });
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/health") }), true);
  assert.deepEqual(responses, [[200, {
    status: "ok",
    service: "identity-server",
    persistence_backend: "postgres",
    runtime_location: "server",
    remote_dev: false,
  }]]);
});

test("system routes forward same-origin user action events to the ingest boundary", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registerSystemRoutes({
    registry,
    handleUserActionIngest: async (req, res) => calls.push([req, res]),
  });
  const req = { method: "POST" };
  const res = {};
  assert.equal(await registry.dispatch({
    req, res, url: new URL("http://localhost/api/operations/user-actions"),
  }), true);
  assert.deepEqual(calls, [[req, res]]);
});

test("the internal operator alert uses the configured operator mail and push channel", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  const emails = [];
  const pushes = [];
  registerSystemRoutes({
    registry,
    requireInternalAdmin: () => true,
    readJsonBody: async () => ({ severity: "critical", message: "Basissoftware-Stack ist kritisch." }),
    sendJson: (res, status, body) => responses.push([status, body]),
    smtpConfigStore: { deliveryConfig: () => ({ security_alert_recipient: "operator@example.invalid" }) },
    smtpEmailService: { send: async (...args) => emails.push(args) },
    webPushService: { notifyAccounts: async (...args) => { pushes.push(args); return { sent: 1 }; } },
    securityAlertPushAccountIds: ["operator-1"],
  });
  assert.equal(await registry.dispatch({
    req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/internal/operator-alert"),
  }), true);
  assert.equal(responses[0][0], 202);
  assert.equal(emails[0][0], "operator@example.invalid");
  assert.match(emails[0][1], /Betreiberhinweis: CRITICAL/);
  assert.equal(pushes[0][1].title, "GerNetiX Basissoftwarefehler");
});

test("download and platform-extra routes keep their shared session boundary", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  const requireSession = async () => ({ account: { user_id: "user-1" } });
  const sendJson = (res, status, body) => responses.push([status, body]);
  registerDownloadRoutes({
    registry,
    requireSession,
    sendJson,
    usbSerialHelperDownloads: async () => ["helper.zip"],
  });
  registerPlatformExtraRoutes({
    registry,
    requireSession,
    sendJson,
    loadAiUsageSummary: async (session) => ({ user: session.account.user_id }),
  });
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/api/platform/downloads") }), true);
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/api/user-ide/ai-usage") }), true);
  assert.deepEqual(responses, [[200, { downloads: ["helper.zip"] }], [200, { user: "user-1" }]]);
});

test("web routes serve the public homepage and redirect anonymous app access", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  registerWebRoutes({
    registry,
    requireSession: async () => null,
    redirect: (res, location) => calls.push(["redirect", location]),
    authRoute: (next) => `/app/auth/?next=${encodeURIComponent(next)}`,
    serveStatic: (res, root, file) => calls.push(["static", root, file]),
    normalizeAppPath: () => "/index.html",
    appDir: "/app",
    operatorShellDir: "/shared",
    publicDir: "/public",
  });
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/") }), true);
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/app/dashboard/") }), true);
  assert.equal(await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/hilfe/") }), true);
  assert.deepEqual(calls, [
    ["static", "/public", "/index.html"],
    ["redirect", "/app/auth/?next=%2Fapp%2Fdashboard%2F"],
    ["redirect", "/app/auth/?next=%2Fhilfe%2F"],
  ]);
});

test("web routes never expose legacy knowledge article scripts", async () => {
  const registry = createRouteRegistry();
  registerWebRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "user-1" } }),
    redirect: () => {},
    authRoute: () => "/app/auth/",
    serveStatic: () => assert.fail("protected knowledge source must not be served as a static file"),
    normalizeAppPath: (value) => value,
    appDir: "/app",
    operatorShellDir: "/shared",
    publicDir: "/public",
  });
  const response = { status: 0, body: "", writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
  assert.equal(await registry.dispatch({
    req: { method: "GET" },
    res: response,
    url: new URL("http://localhost/app/knowledge-chapters/security-basics.js"),
  }), true);
  assert.equal(response.status, 404);
  assert.equal(response.body, "Not found");
});

test("public app assets use an explicit allowlist and all other files require a session", async () => {
  assert.equal(isPublicAppAsset("/api-client.js"), true);
  assert.equal(isPublicAppAsset("/i18n/locales/de.json"), true);
  assert.equal(isPublicAppAsset("/quiz-data.js"), false);

  const registry = createRouteRegistry();
  const calls = [];
  registerWebRoutes({
    registry,
    requireSession: async () => { calls.push("session"); return null; },
    redirect: () => {},
    authRoute: () => "/app/auth/",
    serveStatic: (res, root, file) => calls.push(["static", file]),
    normalizeAppPath: (pathname) => pathname.replace(/^\/app/, ""),
    appDir: "/app",
    operatorShellDir: "/shared",
    publicDir: "/public",
  });

  await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/app/api-client.js") });
  await registry.dispatch({ req: { method: "GET" }, res: {}, url: new URL("http://localhost/app/quiz-data.js") });
  assert.deepEqual(calls, [["static", "/api-client.js"], "session"]);
});

test("request handler reports slow requests without query data and preserves error responses", async () => {
  let clock = 0n;
  const measurements = [];
  const errors = [];
  const responses = [];
  const res = new EventEmitter();
  res.statusCode = 503;
  const handler = createRequestHandler({
    routeRequest: () => { throw Object.assign(new Error("unavailable"), { status: 503, code: "unavailable" }); },
    sendJson: (...args) => responses.push(args),
    reportError: (error) => errors.push(error),
    reportSlowRequest: (measurement) => measurements.push(measurement),
    slowRequestMs: 10,
    now: () => clock,
  });

  await handler({ method: "get", url: "/private?token=secret" }, res);
  clock = 12_000_000n;
  res.emit("finish");

  assert.equal(errors[0].message, "unavailable");
  assert.deepEqual(responses[0].slice(1), [503, { error: "unavailable", message: "unavailable" }]);
  assert.deepEqual(measurements, [{ method: "GET", path: "/private", status: 503, duration_ms: 12 }]);
  assert.equal(requestPath({ url: "not a valid URL" }), "/not%20a%20valid%20URL");
});
