"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "community-ai-auth-test-secret";

function request(body, headers = {}) {
  const req = Readable.from([JSON.stringify(body)]);
  req.method = "POST";
  req.url = "/api/community-ai/query";
  req.headers = { host: "localhost", ...headers };
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

function headers(context, scopes = ["community.ai.query"]) {
  const serviceToken = issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "community-ai-assistant", scopes }, secret);
  const delegation = issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "community-ai-assistant", kind: "delegated_user_action", scopes, context }, secret);
  return { authorization: `Bearer ${serviceToken}`, "x-gernetix-delegation": delegation };
}

test("community AI fails closed without a service token", async () => {
  const app = createHttpApp({ service: { answerQuestion: async () => ({}) }, internalAuthSecret: secret });
  await assert.rejects(app(request({ question: "Hallo" }), response()), (error) => error.code === "internal_token_invalid");
});

test("community AI replaces forged account data with the signed delegation", async () => {
  let received;
  const app = createHttpApp({
    service: { answerQuestion: async (input) => { received = input; return { ok: true }; } },
    internalAuthSecret: secret,
  });
  const res = response();
  await app(request({ question: "Hallo", account_id: "forged", project_id: "project-1" }, headers({
    account_id: "account-1", project_ids: ["project-1"], entitlements: ["ai_assistant"],
  })), res);
  assert.equal(res.status, 200);
  assert.equal(received.account_id, "account-1");
  assert.equal(received.user_id, "account-1");
  assert.equal(received.project_id, "project-1");
});

test("community AI rejects a project outside the signed delegation", async () => {
  const app = createHttpApp({ service: { answerQuestion: async () => ({}) }, internalAuthSecret: secret });
  await assert.rejects(app(request({ question: "Hallo", project_id: "foreign" }, headers({
    account_id: "account-1", project_ids: ["project-1"], entitlements: ["ai_assistant"],
  })), response()), (error) => error.code === "delegated_project_access_denied");
});
