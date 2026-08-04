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

function createService(overrides = {}) {
  return {
    listSessions: () => ({ items: [] }),
    getSession: () => labSession("lab-1", "acct-owner"),
    createHardwareLabSession: () => labSession("lab-1", "acct-owner"),
    analyzeHardwareLabSources: () => labSession("lab-1", "acct-owner"),
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
  });
  const handled = await registry.dispatch({ req: { method: request.method }, res: {}, url: new URL(`http://identity.local${request.pathname}`) });
  assert.equal(handled, true);
  return result;
}
