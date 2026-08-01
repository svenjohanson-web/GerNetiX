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
const { registerWebRoutes } = require("../src/dev/server/web-routes");

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
    markChapterRead: async (...args) => calls.push(args),
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
    handlePlatformDeviceRemove: async (res, session, deviceId) => calls.push([session.account.user_id, deviceId]),
    handlePlatformProvisioningSession: async () => {},
    handlePlatformProvisioningComplete: async () => {},
    loadUserIdeDevices: async () => [],
    handleDeviceRecoveryFirmwareCheck: async () => {},
  });
  assert.equal(await registry.dispatch({ req: { method: "DELETE" }, res: {}, url: new URL("http://localhost/api/platform/devices/device%2042") }), true);
  assert.deepEqual(calls, [["user-1", "device 42"]]);
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
  assert.deepEqual(calls, [
    ["static", "/public", "/index.html"],
    ["redirect", "/app/auth/?next=%2Fapp%2Fdashboard%2F"],
  ]);
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
