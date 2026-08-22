"use strict";

const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "project-api-contract-secret";
const serviceToken = issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "project-server", scopes: ["project.read", "project.write"] }, secret);
const delegation = issueInternalToken({
  iss: "identity-server", sub: "identity-server", aud: "project-server", kind: "delegated_user_action",
  scopes: ["project.read", "project.write"], context: { account_id: "account-1", project_ids: ["p1"] },
}, secret);

test("routes fixed-commit reads rename delete history diff and restore through the Project Server API", async () => {
  const calls = [];
  const service = new Proxy({}, { get: (_target, method) => async (...args) => { calls.push({ method: String(method), args }); return { method: String(method) }; } });
  const app = createHttpApp({ service, internalAuthSecret: secret });
  const sha = "a".repeat(40);

  await request(app, `/api/projects/p1/sources?commit_sha=${sha}`);
  await request(app, `/api/projects/p1/sources/src%2Fmain.cpp?commit_sha=${sha}`);
  await request(app, `/api/projects/p1/sources/search?q=setup&commit_sha=${sha}`);
  await request(app, "/api/projects/p1/sources/rename", "POST", { expected_head_sha: sha, from_path: "a", to_path: "b" });
  await request(app, "/api/projects/p1/sources/src%2Fmain.cpp", "DELETE", { expected_head_sha: sha });
  await request(app, `/api/projects/p1/repository/history?commit_sha=${sha}&limit=12`);
  await request(app, `/api/projects/p1/repository/commits/${sha}/diff`);
  await request(app, "/api/projects/p1/repository/restores", "POST", { expected_head_sha: sha, restore_commit_sha: sha });
  await request(app, "/api/projects/p1/debug-session");
  await request(app, "/api/projects/p1/debug-session", "POST", { device_ids: ["device-1"] });
  await request(app, "/api/projects/p1/debug-session/activity", "POST", {});
  await request(app, "/api/projects/p1/debug-session", "DELETE");

  assert.deepEqual(calls.map((call) => call.method), [
    "listSources", "getSource", "searchSources", "renameSource", "deleteSource", "repositoryHistory", "repositoryDiff", "restoreRepository",
    "getDebugSession", "startDebugSession", "touchDebugSession", "endDebugSession",
  ]);
  assert.equal(calls[0].args[1].commit_sha, sha);
  assert.equal(calls[4].args[2].expected_head_sha, sha);
  assert.equal(calls[5].args[1].limit, "12");
});

async function request(app, url, method = "GET", body = null) {
  const req = new PassThrough();
  req.method = method;
  req.url = url;
  req.headers = {
    host: "project-server.test",
    authorization: `Bearer ${serviceToken}`,
    "x-gernetix-project-delegation": delegation,
  };
  const response = await new Promise((resolve, reject) => {
    const res = {
      status: 0,
      writeHead(status) { this.status = status; },
      end(payload) { resolve({ status: this.status, payload: JSON.parse(payload) }); },
    };
    app(req, res).catch(reject);
    req.end(body ? JSON.stringify(body) : "");
  });
  assert.equal(response.status, method === "POST" && (url.endsWith("restores") || url.endsWith("debug-session")) ? 201 : 200);
  return response.payload;
}
