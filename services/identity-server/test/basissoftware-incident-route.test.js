"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const { registerProjectRoutes } = require("../src/dev/server/project-routes");

test("a critical protected-runtime incident is sanitized and sent through the central admin event path", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  const events = [];
  registerProjectRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "account-1" } }),
    requireSessionProject: async () => ({ project_server_id: "project-server-1" }),
    projectServerUserId: () => "account-1",
    readJsonBody: async () => ({
      component_id: "camera/device<script>",
      software_unit_id: "camera_sender",
      build_id: "a".repeat(64),
      basissoftware_version: "0.1.0",
      incidents: [{
        type: "task_stack_critical",
        task_name: "wifi-connect\nsecret",
        minimum_free_stack_bytes: 320,
        raw_log: "must not pass",
      }],
    }),
    recordSystemEvent: async (event) => { events.push(event); return true; },
    sendJson: (res, status, body) => responses.push([status, body]),
  });

  assert.equal(await registry.dispatch({
    req: { method: "POST" },
    res: {},
    url: new URL("http://localhost/api/user-ide/projects/project-1/basissoftware-incidents"),
  }), true);
  assert.equal(responses[0][0], 202);
  assert.equal(events[0].severity, "critical");
  assert.equal(events[0].category, "basissoftware_runtime");
  assert.equal(events[0].details.incidents[0].task_name, "wifi-connect_secret");
  assert.equal(events[0].details.raw_logs_included, false);
  assert.equal("raw_log" in events[0].details.incidents[0], false);
});
