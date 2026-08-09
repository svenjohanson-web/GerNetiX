"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const { registerProjectRoutes } = require("../src/dev/server/project-routes");

function routeHarness({ requireSessionProject, handlePlatformProjectRead = async () => {}, developmentAssistant = { handleApplyCodeProposal: async () => {} } }) {
  const registry = createRouteRegistry();
  const calls = [];
  const responses = [];
  const projectRepositoryRead = Object.fromEntries(["status", "tree", "file", "history", "diff"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return method === "tree" ? { commit_sha: "a".repeat(40), paths: [] } : { method };
  }]));
  registerProjectRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "account-1" } }),
    requireSessionProject,
    readJsonBody: async (req) => req.body || {},
    projectServerJson: async (...args) => {
      calls.push(["projectServerJson", ...args]);
      return { session: { debug_session_id: "debug-session-1" } };
    },
    projectRepositoryRead,
    developmentAssistant,
    requireEntitlement: () => true,
    handlePlatformProjectRead,
    sendJson: (_res, status, body) => responses.push([status, body]),
  });
  return { calls, registry, responses };
}

test("confirmed AI code proposals pass through the authenticated project route", async () => {
  const applied = [];
  const harness = routeHarness({
    requireSessionProject: async () => ({ project_server_id: "stored-project-1" }),
    developmentAssistant: { handleApplyCodeProposal: async (req, _res, session) => applied.push([req.body, session.account.user_id]) },
  });
  await harness.registry.dispatch({
    req: { method: "POST", body: { projectId: "ui-project-1", proposalId: "proposal-1" } }, res: {},
    url: new URL("http://localhost/api/platform/development-assistant/code-proposals/apply"),
  });
  assert.deepEqual(applied, [[{ projectId: "ui-project-1", proposalId: "proposal-1" }, "account-1"]]);
});

test("project detail route loads exactly the selected project", async () => {
  const reads = [];
  const harness = routeHarness({
    requireSessionProject: async () => ({ project_server_id: "stored-project-1" }),
    handlePlatformProjectRead: async (_res, session, projectId) => {
      reads.push([session.account.user_id, projectId]);
    },
  });
  await harness.registry.dispatch({
    req: { method: "GET" }, res: {},
    url: new URL("http://localhost/api/platform/projects/selected-project"),
  });
  assert.deepEqual(reads, [["account-1", "selected-project"]]);
});

test("repository proxy authorizes the session project before invoking the read contract", async () => {
  const authorized = [];
  const harness = routeHarness({ requireSessionProject: async (session, projectId) => {
    authorized.push([session.account.user_id, projectId]);
    return { project_server_id: "stored-project-1" };
  } });
  await harness.registry.dispatch({
    req: { method: "GET" }, res: {},
    url: new URL(`http://localhost/api/platform/projects/ui-project-1/repository/tree?commit_sha=${"a".repeat(40)}`),
  });
  assert.deepEqual(authorized, [["account-1", "ui-project-1"]]);
  assert.equal(harness.calls[0][0], "tree");
  assert.equal(harness.calls[0][1].project_server_id, "stored-project-1");
  assert.equal(harness.calls[0][2], "a".repeat(40));
  assert.equal(harness.responses[0][0], 200);
});

test("debug-session proxy authorizes the session project and forwards the server-side lifecycle", async () => {
  const authorized = [];
  const harness = routeHarness({ requireSessionProject: async (session, projectId) => {
    authorized.push([session.account.user_id, projectId]);
    return { project_server_id: "stored-project-1" };
  } });
  await harness.registry.dispatch({
    req: { method: "POST", body: { device_ids: ["device-1"] } }, res: {},
    url: new URL("http://localhost/api/user-ide/projects/ui-project-1/debug-session"),
  });
  await harness.registry.dispatch({
    req: { method: "POST", body: {} }, res: {},
    url: new URL("http://localhost/api/user-ide/projects/ui-project-1/debug-session/activity"),
  });
  assert.deepEqual(authorized, [["account-1", "ui-project-1"], ["account-1", "ui-project-1"]]);
  const forwarded = harness.calls.filter((call) => call[0] === "projectServerJson");
  assert.equal(forwarded[0][1], "/api/projects/stored-project-1/debug-session");
  assert.deepEqual(forwarded[0][2].body, { device_ids: ["device-1"] });
  assert.equal(forwarded[1][1], "/api/projects/stored-project-1/debug-session/activity");
  assert.equal(harness.responses[0][0], 201);
  assert.equal(harness.responses[1][0], 200);
});

test("foreign projects are denied before commit or file identifiers reach the contract", async () => {
  const harness = routeHarness({ requireSessionProject: async () => {
    const error = new Error("Projekt wurde nicht gefunden.");
    error.status = 404;
    throw error;
  } });
  await assert.rejects(harness.registry.dispatch({
    req: { method: "GET" }, res: {},
    url: new URL(`http://localhost/api/platform/projects/foreign/repository/commits/${"b".repeat(40)}/diff`),
  }), { status: 404 });
  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.responses, []);
});
