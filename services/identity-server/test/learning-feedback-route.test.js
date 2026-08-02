"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const { registerProjectRoutes } = require("../src/dev/server/project-routes");

test("learning feedback derives account and project ownership from the active session", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  const responses = [];
  registerProjectRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "account-1" } }),
    requireSessionProject: async (session, projectId) => {
      assert.equal(session.account.user_id, "account-1");
      assert.equal(projectId, "ui-project-1");
      return { project_server_id: "stored-project-1" };
    },
    projectServerUserId: () => "account-1",
    readJsonBody: async () => ({
      projectId: "ui-project-1",
      learningStepId: "step.ota",
      ratings: { clarity: 5, fun: 4, difficulty: 3, completeness: 5 },
      message: "Hilfreich",
      user_id: "forged-account",
    }),
    projectServerJson: async (path, options) => {
      calls.push([path, options]);
      return { feedback_id: "feedback-1", ...options.body };
    },
    sendJson: (res, status, body) => responses.push([status, body]),
  });

  assert.equal(await registry.dispatch({
    req: { method: "POST" },
    res: {},
    url: new URL("http://localhost/api/platform/learning-feedback"),
  }), true);
  assert.equal(responses[0][0], 201);
  assert.equal(calls[0][0], "/api/learning-feedback");
  assert.equal(calls[0][1].body.project_id, "stored-project-1");
  assert.equal(calls[0][1].body.user_id, "account-1");
  assert.equal(calls[0][1].body.category, "learning_experience_rating");
});

test("template feedback accepts only a catalog template and ignores a forged account", async () => {
  const registry = createRouteRegistry();
  const calls = [];
  const responses = [];
  registerProjectRoutes({
    registry,
    requireSession: async () => ({ account: { user_id: "account-1" } }),
    projectServerUserId: () => "account-1",
    developmentProjectTemplateCatalog: () => [{ id: "template-1", title: "Vorlage" }],
    readJsonBody: async () => ({ templateId: "template-1", user_id: "forged", ratings: { clarity: 5, fun: 4, difficulty: 2, completeness: 5 } }),
    projectServerJson: async (path, options) => { calls.push([path, options]); return options.body; },
    sendJson: (res, status, body) => responses.push([status, body]),
  });
  await registry.dispatch({ req: { method: "POST" }, res: {}, url: new URL("http://localhost/api/platform/template-feedback") });
  assert.equal(responses[0][0], 201);
  assert.equal(calls[0][0], "/api/template-feedback");
  assert.equal(calls[0][1].body.user_id, "account-1");
});
