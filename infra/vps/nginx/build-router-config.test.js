"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
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
  assert.match(entrypoint, /BUILD_WORKER_PRIMARY_UPSTREAMS/);
  assert.match(entrypoint, /fallback_option=' backup'/);
  assert.match(entrypoint, /server build-deploy-server:4400 max_fails=2 fail_timeout=15s%s/);
  assert.match(entrypoint, /Build-Worker braucht Host und Port/);
});

test("only the normal build pool is routed while central deploy remains direct", () => {
  assert.match(compose, /BUILD_WORKER_POOL_BASE_URL: http:\/\/build-router:4400/);
  assert.match(compose, /OTA_BUILD_DEPLOY_BASE_URL: http:\/\/build-deploy-server:4400/);
  assert.match(compose, /BUILD_WORKER_UPSTREAMS: \$\{BUILD_WORKER_UPSTREAMS:-\}/);
  assert.match(compose, /BUILD_WORKER_PRIMARY_UPSTREAMS: \$\{BUILD_WORKER_PRIMARY_UPSTREAMS:-\}/);
  assert.match(compose, /worker-access:/);
});

test("primary Mac worker is preferred and all other builders become fallbacks", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-build-router-"));
  const bin = path.join(temporaryRoot, "bin");
  const includePath = path.join(temporaryRoot, "build-workers.inc");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "nginx"), "#!/bin/sh\nexit 0\n", {mode:0o755});
  try {
    const result = spawnSync("sh", [path.join(__dirname, "build-router-entrypoint.sh")], {
      encoding:"utf8",
      env:{
        ...process.env,
        PATH:`${bin}:${process.env.PATH}`,
        BUILD_ROUTER_INCLUDE_PATH:includePath,
        BUILD_WORKER_PRIMARY_UPSTREAMS:"10.77.0.5:4400",
        BUILD_WORKER_UPSTREAMS:"10.77.0.20:4400",
      },
    });
    assert.equal(result.status,0,result.stderr);
    const generated = fs.readFileSync(includePath,"utf8");
    assert.match(generated,/server 10\.77\.0\.5:4400 max_fails=1 fail_timeout=10s;/);
    assert.match(generated,/server build-deploy-server:4400 max_fails=2 fail_timeout=15s backup;/);
    assert.match(generated,/server 10\.77\.0\.20:4400 max_fails=2 fail_timeout=15s backup;/);
  } finally {
    fs.rmSync(temporaryRoot,{recursive:true,force:true});
  }
});
