"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

test("initial action failures expose the same support reference shown in Operations", () => {
  const actionOps = read("public/app/action-observability.js");
  assert.match(actionOps, /failureMessage\(message\)/);
  assert.match(actionOps, /Vorgangs-ID:/);
  assert.match(read("public/app/auth/auth.js"), /action\?\.failureMessage/);
  assert.match(read("public/app/project-app-controller.js"), /operation\?\.failureMessage/);
  assert.match(read("public/app/app-device-build-controller.js"), /buildActionFailureMessage/);
  assert.match(read("public/nachbauprojekte/nexi-sprachassistent/nexi-flash.js"), /action\.failureMessage/);
});

test("passkey login carries one action through browser requests and server failure correlation", () => {
  const html = read("public/app/auth/index.html");
  const client = read("public/app/auth/auth.js");
  const server = [read("src/dev-server.js"), read("src/dev/auth/identity-auth-handlers.js")].join("\n");
  assert.match(html, /data-action-type="identity\.login\.passkey"/);
  assert.match(client, /actionStep\(action, "auth\.options"/);
  assert.match(client, /actionStep\(action, "auth\.webauthn"/);
  assert.match(client, /actionStep\(action, "auth\.verify"/);
  assert.match(client, /X-GerNetiX-Action-Id/);
  assert.match(server, /readUserActionContext\(req, "identity\.login\.passkey"\)/);
});

test("project setting save carries the action to Project Server", () => {
  const controller = read("public/app/project-app-controller.js");
  const routes = read("src/dev/server/project-routes.js");
  assert.match(controller, /begin\("project\.settings\.save"/);
  assert.match(controller, /"project\.settings\.persist"/);
  assert.match(routes, /readUserActionContext\(req, "project\.settings\.save"\)/);
  assert.match(routes, /headers: actionContext\.headers/);
});

test("project build carries the action through source, submit, worker and status", () => {
  const client = read("public/app/app-device-build-controller.js");
  const server = [read("src/dev-server.js"), read("src/dev/builds/build-service.js")].join("\n");
  const routes = read("src/dev/server/build-routes.js");
  assert.match(client, /begin\("project\.build\.start"/);
  for (const span of ["project.source.persist", "build.submit", "build.wait", "build.verify"]) assert.match(client, new RegExp(span.replace(".", "\\.")));
  assert.match(server, /readUserActionContext\(req, "project\.build\.start"\)/);
  assert.match(server, /action_id: actionContext\.actionId/);
  assert.match(server, /action_type: actionContext\.actionType/);
  assert.match(server, /buildDeployClient\("\/api\/build-jobs", \{[\s\S]*headers: actionHeaders/);
  assert.match(routes, /loadBuildDeployJob\(jobId, actionOptions\)/);
});
