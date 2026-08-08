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
