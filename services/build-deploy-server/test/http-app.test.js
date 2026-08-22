"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const internalApiSigningKey = "build-deploy-http-test-key";

test("health exposes distributed build-worker coordination", async () => {
  const app = createHttpApp({
    service: {
      coordinationHealth() {
        return { backend: "postgres", worker_id: "worker-a", distributed: true };
      },
    },
  });
  const response = createResponseRecorder();

  await app({ method: "GET", url: "/health", headers: { host: "127.0.0.1" } }, response);

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body.toString()), {
    status: "ok",
    service: "build-deploy-server",
    coordination: { backend: "postgres", worker_id: "worker-a", distributed: true },
  });
});

test("job status can be returned by a worker that did not execute the job", async () => {
  const app = createHttpApp({
    internalApiSigningKey,
    service: {
      async getSharedJob(jobId) {
        return { job_id: jobId, account_id: "acct-1", project_id: "project-1", status: "running", worker_id: "worker-b" };
      },
    },
  });
  const response = createResponseRecorder();

  await app({ method: "GET", url: "/api/build-jobs/shared-job", headers: { host: "127.0.0.1", ...authHeaders("build.job.read") } }, response);

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body.toString()), {
    job_id: "shared-job",
    account_id: "acct-1",
    project_id: "project-1",
    status: "running",
    worker_id: "worker-b",
  });
});

test("cancellation is forwarded to the worker coordination service", async () => {
  const app = createHttpApp({
    internalApiSigningKey,
    service: {
      async getSharedJob(jobId) { return { job_id: jobId, account_id: "acct-1", project_id: "project-1" }; },
      async cancelJob(jobId) {
        return { job_id: jobId, status: "cancelling" };
      },
    },
  });
  const response = createResponseRecorder();

  await app({ method: "POST", url: "/api/build-jobs/job%2042/cancel", headers: { host: "127.0.0.1", ...authHeaders("build.job.cancel") } }, response);

  assert.equal(response.status, 202);
  assert.deepEqual(JSON.parse(response.body.toString()), { job_id: "job 42", status: "cancelling" });
});

test("crash addresses are sent to the exact-build ELF symbolizer", async () => {
  const requests = [];
  const app = createHttpApp({
    internalApiSigningKey,
    service: {
      async getSharedJob(jobId) { return { job_id: jobId, account_id: "acct-1", project_id: "project-1" }; },
      async symbolizeCrash(jobId, body) {
        requests.push({ jobId, body });
        return { status: "symbolized", build_id: body.build_id, frames: [] };
      },
    },
  });
  const response = createResponseRecorder();
  const body = JSON.stringify({ build_id: "a".repeat(64), addresses: ["0x40001234"] });
  await app(createJsonRequest("POST", "/api/build-jobs/job-1/symbolize", body, authHeaders("build.job.symbolize")), response);
  assert.equal(response.status, 200);
  assert.deepEqual(requests, [{ jobId: "job-1", body: JSON.parse(body) }]);
});

test("serves every ESP32 browser flash artifact", async () => {
  const requested = [];
  const app = createHttpApp({
    internalApiSigningKey,
    service: { async getSharedJob(jobId) { return { job_id: jobId, account_id: "acct-1", project_id: "project-1" }; } },
    artifactStore: {
      async getArtifact(jobId, fileName) {
        requested.push([jobId, fileName]);
        return {
          content_type: "application/octet-stream",
          content_blob: Buffer.from(fileName),
          size_bytes: Buffer.byteLength(fileName),
          sha256: "a".repeat(64),
        };
      },
    },
  });

  for (const fileName of ["bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.bin"]) {
    const response = createResponseRecorder();
    await app({
      method: "GET",
      url: `/artifacts/build-1/${fileName}`,
      headers: { host: "127.0.0.1", ...authHeaders("artifact.download") },
    }, response);
    assert.equal(response.status, 200);
    assert.equal(response.body.toString(), fileName);
  }

  assert.deepEqual(requested, [
    ["build-1", "bootloader.bin"],
    ["build-1", "partitions.bin"],
    ["build-1", "boot_app0.bin"],
    ["build-1", "firmware.bin"],
  ]);
});

test("continues to reject files outside the artifact allowlist", async () => {
  const app = createHttpApp({
    service: {},
    artifactStore: {
      async getArtifact() {
        throw new Error("artifact store must not be queried");
      },
    },
  });
  const response = createResponseRecorder();

  await app({
    method: "GET",
    url: "/artifacts/build-1/secrets.txt",
    headers: { host: "127.0.0.1" },
  }, response);

  assert.equal(response.status, 404);
  assert.deepEqual(JSON.parse(response.body.toString()), { error: "not_found" });
});

test("authenticates internal artifact finalization before publishing", async () => {
  const finalized = [];
  const app = createHttpApp({
    service: {},
    artifactUploadToken: "worker-secret",
    artifactUploadIngress: {
      async finalize(jobId, artifacts) {
        finalized.push({ jobId, artifacts });
        return { status: "published" };
      },
    },
  });
  const response = createResponseRecorder();
  await app(createJsonRequest(
    "POST",
    "/api/internal/build-artifacts/job-1/finalize",
    JSON.stringify({ artifacts: ["firmware.elf"] }),
    { authorization: "Bearer worker-secret" },
  ), response);
  assert.equal(response.status, 201);
  assert.deepEqual(finalized, [{ jobId: "job-1", artifacts: ["firmware.elf"] }]);
  await assert.rejects(
    app(createJsonRequest("POST", "/api/internal/build-artifacts/job-1/finalize", "{}"), createResponseRecorder()),
    (error) => error.code === "artifact_upload_unauthorized" && error.status === 401,
  );
});

test("fails closed when an internal route has no service token", async () => {
  const app = createHttpApp({
    internalApiSigningKey,
    service: { policySummary() { return {}; } },
  });
  await assert.rejects(
    app({ method: "GET", url: "/api/policy", headers: { host: "127.0.0.1" } }, createResponseRecorder()),
    (error) => error.code === "internal_token_invalid",
  );
});

test("binds submitted jobs to the delegated account and project", async () => {
  let submitted;
  const app = createHttpApp({
    internalApiSigningKey,
    service: { async submitJob(body) { submitted = body; return body; } },
  });
  const response = createResponseRecorder();
  await app(createJsonRequest("POST", "/api/build-jobs", JSON.stringify({
    account_id: "forged-account", project_id: "project-1",
  }), authHeaders("build.job.request")), response);
  assert.equal(response.status, 202);
  assert.equal(submitted.account_id, "acct-1");

  await assert.rejects(
    app(createJsonRequest("POST", "/api/build-jobs", JSON.stringify({ project_id: "project-2" }), authHeaders("build.job.request")), createResponseRecorder()),
    (error) => error.code === "delegated_project_access_denied",
  );
});

test("accepts only artifact download grants bound to the exact job and file", async () => {
  const app = createHttpApp({
    internalApiSigningKey,
    service: { async getSharedJob(jobId) { return { job_id: jobId, account_id: "acct-1", project_id: "project-1" }; } },
    artifactStore: { async getArtifact() { return { content_type: "application/octet-stream", content_blob: Buffer.from("firmware"), size_bytes: 8, sha256: "a".repeat(64) }; } },
  });
  const grant = issueInternalToken({
    iss: "build-deploy-server", sub: "device-1", aud: "build-deploy-server", kind: "artifact_download_grant",
    scopes: ["artifact.download"], context: { account_id: "acct-1", project_ids: ["project-1"], job_ids: ["job-1"], artifact_names: ["firmware.bin"], device_ids: ["device-1"] },
  }, internalApiSigningKey);
  const response = createResponseRecorder();
  await app({ method: "GET", url: `/artifacts/job-1/firmware.bin?grant=${encodeURIComponent(grant)}`, headers: { host: "127.0.0.1" } }, response);
  assert.equal(response.status, 200);
  await assert.rejects(
    app({ method: "GET", url: `/artifacts/job-2/firmware.bin?grant=${encodeURIComponent(grant)}`, headers: { host: "127.0.0.1" } }, createResponseRecorder()),
    (error) => error.code === "artifact_download_unauthorized",
  );
});

test("binds worker upload grants to job, worker and artifact", async () => {
  const finalized = [];
  const app = createHttpApp({
    internalApiSigningKey,
    service: {},
    artifactUploadIngress: { async finalize(jobId, artifacts) { finalized.push({ jobId, artifacts }); return { status: "published" }; } },
  });
  const grant = issueInternalToken({
    iss: "build-deploy-worker", sub: "worker-1", aud: "build-deploy-server", kind: "artifact_worker_grant",
    scopes: ["artifact.finalize"], context: { job_ids: ["job-1"], worker_ids: ["worker-1"], artifact_names: ["firmware.bin"] },
  }, internalApiSigningKey);
  const response = createResponseRecorder();
  await app(createJsonRequest("POST", "/api/internal/build-artifacts/job-1/finalize", JSON.stringify({ artifacts: ["firmware.bin"] }), { authorization: `Bearer ${grant}` }), response);
  assert.equal(response.status, 201);
  assert.deepEqual(finalized, [{ jobId: "job-1", artifacts: ["firmware.bin"] }]);
  await assert.rejects(
    app(createJsonRequest("POST", "/api/internal/build-artifacts/job-2/finalize", JSON.stringify({ artifacts: ["firmware.bin"] }), { authorization: `Bearer ${grant}` }), createResponseRecorder()),
    (error) => error.code === "artifact_upload_unauthorized",
  );
});

function createResponseRecorder() {
  return {
    status: 0,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = Buffer.isBuffer(body) ? body : Buffer.from(body);
    },
  };
}

function createJsonRequest(method, url, body, headers = {}) {
  const listeners = {};
  return {
    method,
    url,
    headers: { host: "127.0.0.1", ...headers },
    on(event, listener) {
      listeners[event] = listener;
      if (event === "error") return;
      if (event === "end") {
        queueMicrotask(() => {
          listeners.data?.(Buffer.from(body));
          listener();
        });
      }
    },
    destroy() {},
  };
}

function authHeaders(scope, context = { account_id: "acct-1", project_ids: ["project-1"], entitlements: [] }) {
  const common = { iss: "identity-server", sub: "identity-server", aud: "build-deploy-server", scopes: [scope] };
  return {
    authorization: `Bearer ${issueInternalToken(common, internalApiSigningKey)}`,
    "x-gernetix-delegation": issueInternalToken({ ...common, kind: "delegated_user_action", context }, internalApiSigningKey),
  };
}
