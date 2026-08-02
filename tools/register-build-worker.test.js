"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { registerWorker, remoteUpdaterSource, workerEnv } = require("./register-build-worker");

test("worker setup keeps the generated secret out of the remote command", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-worker-register-"));
  const stagingFile = path.join(root, ".env.staging.local");
  const localFile = path.join(root, ".env.build-worker.local");
  fs.writeFileSync(stagingFile, "GERNETIX_STAGING_SSH=root@gernetix-vps\nGERNETIX_STAGING_DIR=/opt/gernetix\n");
  let invocation;
  try {
    const result = registerWorker({
      stagingFile,
      localFile,
      password:"dedicated-secret",
      spawnSync:(command,args,options) => { invocation={command,args,options}; return {status:0}; },
    });
    assert.equal(result.workerAddress,"10.77.0.5");
    assert.doesNotMatch(invocation.args.join(" "),/dedicated-secret/);
    assert.match(invocation.args.join(" "),/gernetix\/node-services:local node -e/);
    assert.match(invocation.options.input,/dedicated-secret/);
    assert.match(fs.readFileSync(localFile,"utf8"),/BUILD_POSTGRES_PASSWORD=dedicated-secret/);
    assert.equal(fs.statSync(localFile).mode & 0o777,0o600);
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test("worker configuration selects the Mac and the restricted database login", () => {
  const content=workerEnv({workerId:"mac-worker-01",workerAddress:"10.77.0.5",postgresAddress:"10.77.0.1",password:"secret"});
  assert.match(content,/BUILD_WORKER_BIND_ADDRESS=10\.77\.0\.5/);
  assert.match(content,/BUILD_POSTGRES_USER=gernetix_build_worker/);
  assert.doesNotMatch(remoteUpdaterSource(),/RUNTIME_POSTGRES_PASSWORD/);
  assert.match(remoteUpdaterSource(),/BUILD_WORKER_PRIMARY_UPSTREAMS/);
});
