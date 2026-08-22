"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "recovery-http-auth-test-key";

function request(method, url, body = {}, requestHeaders = {}) {
  const req = Readable.from(method === "GET" ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost", ...requestHeaders };
  return req;
}

function response() {
  return {
    status: 0,
    payload: null,
    writeHead(status) { this.status = status; },
    end(body) { this.payload = JSON.parse(body); },
  };
}

function headers(scope, accountId = "acct-1", entitlements = []) {
  const claims = { iss: "identity-server", sub: "identity-server", aud: "recovery-tool", scopes: [scope] };
  return {
    authorization: `Bearer ${issueInternalToken(claims, secret)}`,
    "x-gernetix-delegation": issueInternalToken({
      ...claims,
      kind: "delegated_user_action",
      context: { account_id: accountId, project_ids: [], entitlements },
    }, secret),
  };
}

test("Recovery API fails closed without a service identity", async () => {
  const app = createHttpApp({ service: {}, internalApiSigningKey: secret });
  await assert.rejects(
    app(request("GET", "/api/recovery/sessions"), response()),
    (error) => error.code === "internal_token_invalid",
  );
});

test("Recovery session creation replaces a forged account with the delegation account", async () => {
  let input;
  const app = createHttpApp({
    service: { createSession(value) { input = value; return value; } },
    internalApiSigningKey: secret,
  });
  const res = response();
  await app(request("POST", "/api/recovery/sessions", { account_id: "foreign", detection: {} }, headers("recovery.session.write")), res);
  assert.equal(res.status, 201);
  assert.equal(input.account_id, "acct-1");
});

test("Recovery API hides sessions owned by another account", async () => {
  const app = createHttpApp({
    service: { getSession() { return { recovery_session_id: "recovery-1", account_id: "acct-2" }; } },
    internalApiSigningKey: secret,
  });
  await assert.rejects(
    app(request("GET", "/api/recovery/sessions/recovery-1", {}, headers("recovery.session.read")), response()),
    (error) => error.code === "delegated_account_access_denied",
  );
});

test("Hardware Lab additionally requires the AI entitlement", async () => {
  const app = createHttpApp({ service: { createHardwareLabSession() { return {}; } }, internalApiSigningKey: secret });
  await assert.rejects(
    app(request("POST", "/api/recovery/hardware-lab/sessions", {}, headers("hardware_lab.write")), response()),
    (error) => error.code === "delegated_entitlement_denied",
  );
});
