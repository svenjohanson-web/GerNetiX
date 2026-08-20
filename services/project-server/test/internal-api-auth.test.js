"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp, sendJson } = require("../src/http-app");
const { issueInternalToken, readInternalApiAuthConfig } = require("../../shared/internal-api-auth");

const secret = "project-server-internal-contract-secret";

test("rejects project reads without a service token, delegation, matching audience, scope, or project grant", async () => {
  let calls = 0;
  const app = createHttpApp({
    internalAuthSecret: secret,
    service: { getProject: async () => { calls += 1; return { project_id: "project-a" }; } },
  });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/projects/project-a`;
  const service = token({ scopes: ["project.read"] });
  const delegation = token({ kind: "delegated_user_action", scopes: ["project.read"], context: { account_id: "account-a", project_ids: ["project-a"] } });
  try {
    assert.equal((await fetch(url)).status, 403);
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${service}` } })).status, 403);
    const wrongAudience = token({ aud: "ai-context-server", scopes: ["project.read"] });
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${wrongAudience}`, "X-GerNetiX-Project-Delegation": delegation } })).status, 403);
    const readOnly = token({ scopes: ["project.write"] });
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${readOnly}`, "X-GerNetiX-Project-Delegation": delegation } })).status, 403);
    const foreignProject = token({ kind: "delegated_user_action", scopes: ["project.read"], context: { account_id: "account-a", project_ids: ["project-b"] } });
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${service}`, "X-GerNetiX-Project-Delegation": foreignProject } })).status, 403);
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${service}`, "X-GerNetiX-Project-Delegation": delegation } })).status, 200);
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("rejects account resource plans whose delegation names another account", async () => {
  const app = createHttpApp({
    internalAuthSecret: secret,
    service: { accountResourceSummary: async () => ({ account_id: "account-a" }) },
  });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const service = token({ scopes: ["project.read"] });
    const foreign = token({ kind: "delegated_user_action", scopes: ["project.read"], context: { account_id: "account-b" } });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/internal/accounts/account-a/resource-plan`, {
      headers: { Authorization: `Bearer ${service}`, "X-GerNetiX-Project-Delegation": foreign },
    });
    assert.equal(response.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("project ownership lookup exposes only a narrow projection to its dedicated service scope", async () => {
  const app = createHttpApp({
    internalAuthSecret: secret,
    service: { getProject: async () => ({ project_id: "project-a", user_id: "account-a", device_id: "device-a", build_config: { component_device_allocations: [{ device_id: "device-b" }] }, title: "private" }) },
  });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/internal/project-ownership/project-a`;
  try {
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token({ scopes: ["project.read"] })}` } })).status, 403);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token({ scopes: ["project.ownership.resolve"] })}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { project_id: "project-a", account_id: "account-a", allocated_device_ids: ["device-a", "device-b"] });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("accepts signed Ed25519 service and account delegation tokens", async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const trustRing = JSON.stringify({
    "identity-current": {
      issuer: "identity-server",
      publicKeyB64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    },
  });
  const identityAuth = readInternalApiAuthConfig({
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: trustRing,
    INTERNAL_API_SIGNING_KEY_ID: "identity-current",
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  }, { serviceId: "identity-server" });
  const projectAuth = readInternalApiAuthConfig({ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: trustRing }, { serviceId: "project-server" });
  const app = createHttpApp({
    internalAuthSecret: projectAuth,
    service: { listProjects: async () => [] },
  });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const claims = { iss: "identity-server", sub: "identity-server", aud: "project-server", scopes: ["project.read"] };
  const service = issueInternalToken(claims, identityAuth);
  const delegation = issueInternalToken({
    ...claims,
    kind: "delegated_user_action",
    context: { account_id: "account-a" },
  }, identityAuth);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects?user_id=account-a`, {
      headers: { Authorization: `Bearer ${service}`, "X-GerNetiX-Project-Delegation": delegation },
    });
    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function token(overrides = {}) {
  return issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "project-server", ...overrides }, secret);
}
