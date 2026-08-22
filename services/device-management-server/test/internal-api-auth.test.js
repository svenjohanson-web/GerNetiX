"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp, sendJson } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "device-management-internal-auth-test-key";

test("device ownership recipients require the narrow service scope", async () => {
  let calls = 0;
  const app = createHttpApp({
    internalApiSigningKey: secret,
    service: { async pushRecipients() { calls += 1; return { account_ids: ["acct-1"] }; } },
  });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/device-management/devices/device-1/push-recipients`;
  const token = (scopes) => issueInternalToken({ iss: "telemetry-server", sub: "telemetry-server", aud: "device-management-server", scopes }, secret);
  try {
    assert.equal((await fetch(url)).status, 403);
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token(["device.read"])}` } })).status, 403);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token(["device.ownership.resolve"])}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { account_ids: ["acct-1"] });
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("device registration is fail-closed and accepts only its exact service scope", async () => {
  let calls = 0;
  const app = createHttpApp({
    internalApiSigningKey: secret,
    service: { async registerDevice(body) { calls += 1; return body; } },
  });
  const server = await listen(app);
  const url = baseUrl(server, "/api/device-management/devices/register");
  try {
    assert.equal((await fetch(url, jsonRequest({ device_id: "device-1" }))).status, 403);
    assert.equal((await fetch(url, jsonRequest({ device_id: "device-1" }, serviceToken("device.status.write")))).status, 403);
    const response = await fetch(url, jsonRequest({ device_id: "device-1" }, serviceToken("device.register")));
    assert.equal(response.status, 201);
    assert.equal(calls, 1);
  } finally {
    await close(server);
  }
});

test("account device data additionally requires a matching user delegation", async () => {
  let calls = 0;
  const app = createHttpApp({
    internalApiSigningKey: secret,
    service: { async listAccountDevices(accountId) { calls += 1; return [{ account_id: accountId }]; } },
  });
  const server = await listen(app);
  const url = baseUrl(server, "/api/device-management/accounts/account-1/devices");
  try {
    assert.equal((await fetch(url, { headers: serviceToken("device.account.read") })).status, 403);
    assert.equal((await fetch(url, { headers: delegatedHeaders("device.account.read", "account-2") })).status, 403);
    const response = await fetch(url, { headers: delegatedHeaders("device.account.read", "account-1") });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [{ account_id: "account-1" }] });
    assert.equal(calls, 1);
  } finally {
    await close(server);
  }
});

test("device challenge remains the credential bootstrap boundary", async () => {
  const app = createHttpApp({
    internalApiSigningKey: secret,
    service: { async createChallenge(deviceId) { return { device_id: deviceId, challenge: "nonce" }; } },
  });
  const server = await listen(app);
  try {
    const response = await fetch(baseUrl(server, "/api/device-management/devices/device-1/auth/challenge"), jsonRequest({}));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { device_id: "device-1", challenge: "nonce" });
  } finally {
    await close(server);
  }
});

function serviceToken(scope) {
  return { Authorization: `Bearer ${issueInternalToken({
    iss: "test-client", sub: "test-client", aud: "device-management-server", scopes: [scope],
  }, secret)}` };
}

function delegatedHeaders(scope, accountId) {
  const claims = { iss: "test-client", sub: "test-client", aud: "device-management-server", scopes: [scope] };
  return {
    Authorization: `Bearer ${issueInternalToken(claims, secret)}`,
    "X-GerNetiX-Delegation": issueInternalToken({
      ...claims, kind: "delegated_user_action", context: { account_id: accountId, project_ids: [], entitlements: [] },
    }, secret),
  };
}

function jsonRequest(body, headers = {}) {
  return { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}

async function listen(app) {
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function baseUrl(server, path) {
  return `http://127.0.0.1:${server.address().port}${path}`;
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}
