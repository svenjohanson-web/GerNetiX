"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadRemoteDevConfig } = require("./start-identity-remote-dev");

test("remote identity dev mode forces local 4300 and central PostgreSQL", () => {
  const config = loadRemoteDevConfig({
    IDENTITY_POSTGRES_PASSWORD: "test-secret",
    RUNTIME_STATE_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
  }, { readFile:false });
  assert.equal(config.HOST, "127.0.0.1");
  assert.equal(config.PORT, "4300");
  assert.equal(config.IDENTITY_RUNTIME_LOCATION, "local-development");
  assert.equal(config.IDENTITY_REMOTE_DEV, "1");
  assert.equal(config.IDENTITY_PERSISTENCE_BACKEND, "postgres");
  assert.equal(config.IDENTITY_POSTGRES_PORT, "25432");
  assert.equal(config.AI_USAGE_BASE_URL, "http://127.0.0.1:5001");
  assert.equal(config.BUILD_DEPLOY_BASE_URL, "http://127.0.0.1:4400");
  assert.equal(config.BUILD_WORKER_POOL_BASE_URL, "http://127.0.0.1:14400");
});

test("remote identity dev mode refuses to start without a database secret", () => {
  assert.throws(() => loadRemoteDevConfig({}, { readFile:false }), /IDENTITY_POSTGRES_PASSWORD/);
});

test("remote identity dev mode requires the shared runtime-state key", () => {
  assert.throws(
    () => loadRemoteDevConfig({ IDENTITY_POSTGRES_PASSWORD: "test-secret" }, { readFile:false }),
    /RUNTIME_STATE_ENCRYPTION_KEY/,
  );
});
