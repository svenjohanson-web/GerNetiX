"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("k6 scenario routes remain registered by Identity", () => {
  const authRoutes = read("services/identity-server/src/dev/server/auth-routes.js");
  const projectRoutes = read("services/identity-server/src/dev/server/project-routes.js");
  const devServer = read("services/identity-server/src/dev-server.js");

  assert.match(devServer, /async function handleLogin\(req, res\)/);
  assert.match(authRoutes, /path: "\/api\/session"/);
  assert.match(devServer, /async function handlePlatformBootstrap\(res, session/);
  assert.match(projectRoutes, /\^\\\/api\\\/platform\\\/projects\\\/\(\[\^\/\]\+\)\$/);
  assert.match(projectRoutes, /\^\\\/api\\\/platform\\\/projects\\\/\(\[\^\/\]\+\)\\\/project-app\$/);
});

test("device simulator topics remain covered by broker ACL and telemetry adapter", () => {
  const acl = read("infra/vps/mosquitto/device.acl");
  const adapter = read("services/telemetry-server/src/mqtt-telemetry-adapter.js");
  assert.match(acl, /pattern write gernetix\/devices\/%u\/telemetry/);
  assert.match(acl, /pattern write gernetix\/devices\/%u\/status\/#/);
  assert.match(adapter, /topicFilter: "gernetix\/devices\/\+\/telemetry"/);
});

test("browser selectors remain present in the productive Identity UI", () => {
  const auth = read("services/identity-server/public/app/auth/index.html");
  const app = read("services/identity-server/public/app/index.html");
  const projectController = read("services/identity-server/public/app/app-project-controller.js");
  for (const id of ["login-title", "login-form", "show-identifier-login", "login-identifier", "status"]) {
    assert.match(auth, new RegExp(`id="${id}"`));
  }
  assert.match(app, /id="projectList"/);
  assert.match(app, /id="learningProjectOverview"/);
  assert.match(projectController, /data-open-learning-project-overview/);
  assert.match(projectController, /learning-project-overview-head/);
});

test("fixture seed routes remain available on their owning services", () => {
  const authRoutes = read("services/identity-server/src/dev/server/auth-routes.js");
  const project = read("services/project-server/src/http-app.js");
  const device = read("services/device-management-server/src/http-app.js");
  assert.match(authRoutes, /\["\/api\/register", handleRegister\]/);
  assert.match(project, /req\.method === "POST" && path === prefix/);
  assert.match(device, /path === `\$\{prefix\}\/devices\/register`/);
  assert.match(device, /\^\$\{prefix\}\/accounts\/\(\[\^\/\]\+\)\/devices\$/);
});
