"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DEFAULT_TARGETS, parseArgs } = require("../cli");

const repositoryRoot = path.resolve(__dirname, "..", "..", "..", "..");

test("fixture seed routes remain registered by their owning services", () => {
  const authRoutes = source("services/identity-server/src/dev/server/auth-routes.js");
  assert.match(authRoutes, /\["\/api\/login", handleLogin\]/);
  assert.match(authRoutes, /\["\/api\/register", handleRegister\]/);

  const projectHttp = source("services/project-server/src/http-app.js");
  assert.match(projectHttp, /req\.method === "POST" && path === prefix/);
  assert.match(projectHttp, /req\.method === "GET" && project/);

  const deviceHttp = source("services/device-management-server/src/http-app.js");
  assert.match(deviceHttp, /path === `\$\{prefix\}\/devices\/register`/);
  assert.match(deviceHttp, /req\.method === "GET" && status/);
  assert.match(deviceHttp, /req\.method === "GET" && accountDevices/);
  assert.match(deviceHttp, /req\.method === "POST" && accountDevices/);
});

test("fixture defaults target the documented local service ports", () => {
  assert.deepEqual(DEFAULT_TARGETS, {
    identity: "http://127.0.0.1:14300",
    project: "http://127.0.0.1:14800",
    device: "http://127.0.0.1:14700",
  });
});

test("fixture CLI requires an explicit write confirmation", () => {
  assert.deepEqual(parseArgs(["--plan"]), { plan: true, confirmWrite: false });
  assert.deepEqual(parseArgs(["--confirm-write"]), { plan: false, confirmWrite: true });
  assert.throws(() => parseArgs([]), /explicit --confirm-write/);
  assert.throws(() => parseArgs(["--plan", "--confirm-write"]), /cannot be combined/);
});

function source(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}
