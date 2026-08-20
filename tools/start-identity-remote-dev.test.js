"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadRemoteDevConfig, mergeRemoteDevConfiguration } = require("./start-identity-remote-dev");

test("remote identity dev mode forces local 4300 and central PostgreSQL", () => {
  const config = loadRemoteDevConfig({
    IDENTITY_POSTGRES_PASSWORD: "test-secret",
    RUNTIME_STATE_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: '{"identity-test":{"issuer":"identity-server","publicKeyB64":"test"}}',
    INTERNAL_API_SIGNING_KEY_ID: "identity-test",
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "test",
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
  assert.equal(config.PUBLIC_DEMO_BASE_URL, "http://127.0.0.1:4920");
});

test("remote identity dev mode refuses to start without a database secret", () => {
  assert.throws(() => loadRemoteDevConfig({}, { readFile:false }), /IDENTITY_POSTGRES_PASSWORD/);
});

test("remote identity dev mode requires the shared runtime-state key", () => {
  assert.throws(
    () => loadRemoteDevConfig({
      IDENTITY_POSTGRES_PASSWORD: "test-secret",
      INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: '{"identity-test":{"issuer":"identity-server","publicKeyB64":"test"}}',
      INTERNAL_API_SIGNING_KEY_ID: "identity-test",
      INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "test",
    }, { readFile:false }),
    /RUNTIME_STATE_ENCRYPTION_KEY/,
  );
});

test("remote identity dev mode refuses to start without its internal service identity", () => {
  assert.throws(
    () => loadRemoteDevConfig({
      IDENTITY_POSTGRES_PASSWORD: "test-secret",
      RUNTIME_STATE_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
    }, { readFile:false }),
    /Identity-Dienstidentitaet fehlt/,
  );
});

test("remote identity dev mode accepts the deployment-prefixed identity signing values", () => {
  const config = loadRemoteDevConfig({
    IDENTITY_POSTGRES_PASSWORD: "test-secret",
    RUNTIME_STATE_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: '{"identity-test":{"issuer":"identity-server","publicKeyB64":"test"}}',
    IDENTITY_INTERNAL_API_SIGNING_KEY_ID: "identity-test",
    IDENTITY_INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "test",
  }, { readFile:false });
  assert.equal(config.INTERNAL_API_SIGNING_KEY_ID, "identity-test");
  assert.equal(config.INTERNAL_API_SIGNING_PRIVATE_KEY_B64, "test");
});

test("remote dev file keeps its service identity over inherited environment values", () => {
  const config = mergeRemoteDevConfiguration({
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: "local-trust",
    INTERNAL_API_SIGNING_KEY_ID: "local-key",
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "local-private",
  }, {
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: "inherited-trust",
    INTERNAL_API_SIGNING_KEY_ID: "inherited-key",
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "inherited-private",
  });
  assert.equal(config.INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON, "local-trust");
  assert.equal(config.INTERNAL_API_SIGNING_KEY_ID, "local-key");
  assert.equal(config.INTERNAL_API_SIGNING_PRIVATE_KEY_B64, "local-private");
});
