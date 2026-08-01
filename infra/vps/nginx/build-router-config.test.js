"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = fs.readFileSync(path.join(__dirname, "build-router.conf"), "utf8");
const entrypoint = fs.readFileSync(path.join(__dirname, "build-router-entrypoint.sh"), "utf8");
const compose = fs.readFileSync(path.resolve(__dirname, "../../..", "compose.vps.yaml"), "utf8");

test("build router keeps the central worker and adds only configured private peers", () => {
  assert.match(config, /least_conn;/);
  assert.match(config, /include \/var\/run\/gernetix\/build-workers\.inc/);
  assert.match(config, /location = \/router-health/);
  assert.match(compose, /http:\/\/127\.0\.0\.1:4400\/router-health/);
  assert.match(entrypoint, /server build-deploy-server:4400 max_fails=2 fail_timeout=15s/);
  assert.match(entrypoint, /BUILD_WORKER_UPSTREAMS/);
  assert.match(entrypoint, /Build-Worker braucht Host und Port/);
});

test("only the normal build pool is routed while central deploy remains direct", () => {
  assert.match(compose, /BUILD_WORKER_POOL_BASE_URL: http:\/\/build-router:4400/);
  assert.match(compose, /OTA_BUILD_DEPLOY_BASE_URL: http:\/\/build-deploy-server:4400/);
  assert.match(compose, /BUILD_WORKER_UPSTREAMS: \$\{BUILD_WORKER_UPSTREAMS:-\}/);
  assert.match(compose, /worker-access:/);
});
