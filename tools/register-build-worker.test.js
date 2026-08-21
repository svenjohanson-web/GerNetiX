"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { parseRegistrationArgs, registerWorker, remoteUpdaterSource, workerEnv } = require("./register-build-worker");

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
      artifactUploadToken:"artifact-secret",
      spawnSync:(command,args,options) => { invocation={command,args,options}; return {status:0}; },
    });
    assert.equal(result.workerAddress,"10.77.0.5");
    assert.doesNotMatch(invocation.args.join(" "),/dedicated-secret/);
    assert.match(invocation.args.join(" "),/gernetix\/node-services:local node -e/);
    assert.match(invocation.options.input,/dedicated-secret/);
    assert.match(fs.readFileSync(localFile,"utf8"),/BUILD_POSTGRES_PASSWORD=dedicated-secret/);
    assert.match(fs.readFileSync(localFile,"utf8"),/BUILD_ARTIFACT_UPLOAD_TOKEN=artifact-secret/);
    // NTFS bildet POSIX-Modi nicht ab und meldet immer 0o666. Die Rechtezusage
    // wird deshalb dort geprueft, wo sie gilt: Linux und macOS.
    if (process.platform !== "win32") assert.equal(fs.statSync(localFile).mode & 0o777,0o600);
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test("worker configuration selects the Mac and the restricted database login", () => {
  const content=workerEnv({workerId:"mac-worker-01",workerAddress:"10.77.0.5",postgresAddress:"10.77.0.1",password:"secret",artifactUploadToken:"artifact-secret"});
  assert.match(content,/BUILD_WORKER_BIND_ADDRESS=10\.77\.0\.5/);
  assert.match(content,/BUILD_POSTGRES_USER=gernetix_build_worker/);
  assert.match(content,/BUILD_ARTIFACT_UPLOAD_HOST_ADDRESS=10\.77\.0\.1/);
  assert.doesNotMatch(remoteUpdaterSource(),/RUNTIME_POSTGRES_PASSWORD/);
  assert.match(remoteUpdaterSource(),/BUILD_WORKER_PRIMARY_UPSTREAMS/);
});

test("registration arguments describe an additional Windows worker without secrets", () => {
  assert.deepEqual(parseRegistrationArgs([
    "--worker-id", "windows-worker-01",
    "--worker-address", "10.77.0.20",
    "--pool", "primary",
    "--local-file", ".env.build-worker.windows.local",
    "--reuse-credentials-from", ".env.build-worker.local",
  ]), {
    workerId:"windows-worker-01",
    workerAddress:"10.77.0.20",
    pool:"primary",
    localFile:".env.build-worker.windows.local",
    reuseCredentialsFrom:".env.build-worker.local",
  });
});

test("additional worker reuses restricted credentials and is appended to the selected pool", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-worker-register-extra-"));
  const stagingFile = path.join(root, ".env.staging.local");
  const sourceFile = path.join(root, ".env.build-worker.local");
  const localFile = path.join(root, ".env.build-worker.windows.local");
  fs.writeFileSync(stagingFile, "GERNETIX_STAGING_SSH=root@gernetix-vps\nGERNETIX_STAGING_DIR=/opt/gernetix\n");
  fs.writeFileSync(sourceFile, "BUILD_POSTGRES_HOST=10.77.0.1\nBUILD_POSTGRES_PASSWORD=existing-secret\nBUILD_ARTIFACT_UPLOAD_TOKEN=artifact-secret\n", {mode:0o600});
  let invocation;
  try {
    const result = registerWorker({
      stagingFile,
      localFile,
      reuseCredentialsFrom:sourceFile,
      workerId:"windows-worker-01",
      workerAddress:"10.77.0.20",
      pool:"secondary",
      spawnSync:(command,args,options) => { invocation={command,args,options}; return {status:0}; },
    });
    assert.equal(result.pool,"secondary");
    assert.match(invocation.options.input,/"pool":"secondary"/);
    assert.match(invocation.options.input,/existing-secret/);
    assert.doesNotMatch(invocation.args.join(" "),/existing-secret/);
    assert.match(fs.readFileSync(localFile,"utf8"),/BUILD_WORKER_ID=windows-worker-01/);
    assert.match(fs.readFileSync(localFile,"utf8"),/BUILD_POSTGRES_PASSWORD=existing-secret/);
    assert.match(remoteUpdaterSource(),/upstreams\.includes\(endpoint\)/);
    assert.match(remoteUpdaterSource(),/BUILD_WORKER_UPSTREAMS/);
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test("remote updater preserves existing workers and appends an endpoint only once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-worker-updater-"));
  const envFile = path.join(root, ".env.vps");
  fs.writeFileSync(envFile, [
    "RUNTIME_POSTGRES_BIND_ADDRESS=127.0.0.1",
    "BUILD_WORKER_PRIMARY_UPSTREAMS=10.77.0.5:4400",
    "BUILD_WORKER_UPSTREAMS=10.77.0.1:4400",
    "BUILD_WORKER_POSTGRES_PASSWORD=old-secret",
    "",
  ].join("\n"));
  const payload = JSON.stringify({
    workerAddress:"10.77.0.20",
    workerPort:4400,
    postgresAddress:"10.77.0.1",
    password:"existing-secret",
    pool:"primary",
  });
  try {
    for (let run = 0; run < 2; run += 1) {
      const result = spawnSync(process.execPath, ["-e", remoteUpdaterSource()], {cwd:root,input:payload,encoding:"utf8"});
      assert.equal(result.status,0,result.stderr);
    }
    const updated = fs.readFileSync(envFile,"utf8");
    assert.match(updated,/BUILD_WORKER_PRIMARY_UPSTREAMS=10\.77\.0\.5:4400,10\.77\.0\.20:4400/);
    assert.equal((updated.match(/10\.77\.0\.20:4400/g) || []).length,1);
    assert.match(updated,/BUILD_WORKER_UPSTREAMS=10\.77\.0\.1:4400/);
    assert.match(updated,/BUILD_WORKER_POSTGRES_PASSWORD=existing-secret/);
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});
