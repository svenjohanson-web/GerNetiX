const assert = require("node:assert/strict");
const test = require("node:test");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const { registerHardwareLabRoutes } = require("../src/dev/server/hardware-lab-routes");

test("creates a hardware-lab session from the authenticated Identity user and ignores client identity fields", async () => {
  let created;
  const service = createService({
    createHardwareLabSession(input) {
      created = input;
      return labSession("lab-1", input.account_id);
    },
  });
  const response = await dispatch(service, {
    method: "POST",
    pathname: "/api/platform/hardware-lab/sessions",
    body: { account_id: "attacker", user_id: "attacker", actor: "attacker", board_name: "ESP32-S3", source_urls: ["https://example.com/board"] },
  });

  assert.equal(response.status, 201);
  assert.equal(created.account_id, "acct-owner");
  assert.equal(created.actor, "identity-hardware-lab");
  assert.equal(created.user_id, undefined);
});

test("lists only hardware-lab sessions owned by the authenticated Identity user", async () => {
  const service = createService({
    listSessions(filter) {
      assert.deepEqual(filter, { account_id: "acct-owner" });
      return { items: [labSession("lab-1", "acct-owner"), { recovery_session_id: "recovery-1", account_id: "acct-owner" }] };
    },
  });
  const response = await dispatch(service, { method: "GET", pathname: "/api/platform/hardware-lab/sessions" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.payload.items.map((item) => item.recovery_session_id), ["lab-1"]);
});

test("loads the hardware assistant AI rating without waiting for the platform summary", async () => {
  const requested = [];
  const response = await dispatch(createService(), {
    method: "GET",
    pathname: "/api/platform/hardware-lab/ai-usage",
    aiUsageJson: async (path, options) => {
      requested.push({ path, options });
      return { used_percent: 12, sources: [{ source_id: "openai_gpt", month_tokens: 120 }] };
    },
  });
  assert.equal(response.status, 200);
  assert.equal(requested[0].path, "/api/ai-usage/accounts/acct-owner/rating");
  assert.deepEqual(requested[0].options.internalAuth, {
    scopes: ["ai.usage.read"],
    delegation: { account_id: "acct-owner", project_ids: [], entitlements: [] },
  });
  assert.equal(response.payload.rating.used_percent, 12);
});

test("does not expose or execute another account's hardware-lab session", async () => {
  let analyzed = false;
  const service = createService({
    getSession() { return labSession("lab-foreign", "acct-foreign"); },
    analyzeHardwareLabSources() { analyzed = true; },
  });
  const response = await dispatch(service, { method: "POST", pathname: "/api/platform/hardware-lab/sessions/lab-foreign/analyze-sources", body: {} });
  assert.equal(response.status, 404);
  assert.equal(response.payload.error, "hardware_lab_session_not_found");
  assert.equal(analyzed, false);
});

test("sends hardware-lab chat messages through the owned session and strips client identity", async () => {
  let received;
  const service = createService({
    chatHardwareLab(id, input) {
      received = { id, input };
      return labSession(id, "acct-owner");
    },
  });
  const response = await dispatch(service, {
    method: "POST",
    pathname: "/api/platform/hardware-lab/sessions/lab-1/chat",
    body: { message: "Welche I2C-Pins sind noch offen?", account_id: "attacker", actor: "attacker" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(received, { id: "lab-1", input: { message: "Welche I2C-Pins sind noch offen?", actor: "identity-hardware-lab" } });
});

function createService(overrides = {}) {
  return {
    listSessions: () => ({ items: [] }),
    getSession: () => labSession("lab-1", "acct-owner"),
    createHardwareLabSession: () => labSession("lab-1", "acct-owner"),
    analyzeHardwareLabSources: () => labSession("lab-1", "acct-owner"),
    chatHardwareLab: () => labSession("lab-1", "acct-owner"),
    requestDiscoveryFirmwareBuild: () => labSession("lab-1", "acct-owner"),
    synchronizeDiscoveryFirmwareBuild: () => labSession("lab-1", "acct-owner"),
    recordHardwareExamination: () => labSession("lab-1", "acct-owner"),
    requestGerNetiXVerification: () => labSession("lab-1", "acct-owner"),
    ...overrides,
  };
}

function labSession(id, accountId) {
  return { recovery_session_id: id, recovery_type: "ai_guided_hardware_lab", account_id: accountId, discovery: { firmware_build: {} } };
}

async function dispatch(hardwareLabService, request) {
  const registry = createRouteRegistry();
  const result = {};
  registerHardwareLabRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "acct-owner" } }),
    readJsonBody: async () => request.body || {},
    sendJson(_res, status, payload) { result.status = status; result.payload = payload; },
    projectServerUserId: (session) => session.account.user_id,
    hardwareLabService,
    buildDeployBaseUrl: "http://127.0.0.1:4400",
    aiUsageJson: request.aiUsageJson || (async () => ({ sources: [] })),
  });
  const handled = await registry.dispatch({ req: { method: request.method }, res: {}, url: new URL(`http://identity.local${request.pathname}`) });
  assert.equal(handled, true);
  return result;
}
