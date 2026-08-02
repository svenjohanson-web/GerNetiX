"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");

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
    service: {
      async getSharedJob(jobId) {
        return { job_id: jobId, status: "running", worker_id: "worker-b" };
      },
    },
  });
  const response = createResponseRecorder();

  await app({ method: "GET", url: "/api/build-jobs/shared-job", headers: { host: "127.0.0.1" } }, response);

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body.toString()), {
    job_id: "shared-job",
    status: "running",
    worker_id: "worker-b",
  });
});

test("cancellation is forwarded to the worker coordination service", async () => {
  const app = createHttpApp({
    service: {
      async cancelJob(jobId) {
        return { job_id: jobId, status: "cancelling" };
      },
    },
  });
  const response = createResponseRecorder();

  await app({ method: "POST", url: "/api/build-jobs/job%2042/cancel", headers: { host: "127.0.0.1" } }, response);

  assert.equal(response.status, 202);
  assert.deepEqual(JSON.parse(response.body.toString()), { job_id: "job 42", status: "cancelling" });
});

test("crash addresses are sent to the exact-build ELF symbolizer", async () => {
  const requests = [];
  const app = createHttpApp({
    service: {
      async symbolizeCrash(jobId, body) {
        requests.push({ jobId, body });
        return { status: "symbolized", build_id: body.build_id, frames: [] };
      },
    },
  });
  const response = createResponseRecorder();
  const body = JSON.stringify({ build_id: "a".repeat(64), addresses: ["0x40001234"] });
  await app(createJsonRequest("POST", "/api/build-jobs/job-1/symbolize", body), response);
  assert.equal(response.status, 200);
  assert.deepEqual(requests, [{ jobId: "job-1", body: JSON.parse(body) }]);
});

test("serves every ESP32 browser flash artifact", async () => {
  const requested = [];
  const app = createHttpApp({
    service: {},
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
      headers: { host: "127.0.0.1" },
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

function createJsonRequest(method, url, body) {
  const listeners = {};
  return {
    method,
    url,
    headers: { host: "127.0.0.1" },
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
