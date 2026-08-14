"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp, sendJson } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "hardware-catalog-http-auth-test-key";

test("catalog reads stay public while catalog administration is scoped", async () => {
  let writes = 0;
  const app = createHttpApp({ internalApiSigningKey: secret, service: {
    async listCapabilities() { return []; },
    async upsertCapability(body) { writes += 1; return body; },
  } });
  const server = await listen(app);
  try {
    assert.equal((await fetch(url(server, "/api/hardware-catalog/capabilities"))).status, 200);
    assert.equal((await fetch(url(server, "/api/hardware-catalog/admin/capabilities"), post({ id: "cap-1" }))).status, 403);
    const response = await fetch(url(server, "/api/hardware-catalog/admin/capabilities"), post({ id: "cap-1" }, token("hardware_catalog.admin")));
    assert.equal(response.status, 201);
    assert.equal(writes, 1);
  } finally { await close(server); }
});

function token(scope) { return { Authorization: `Bearer ${issueInternalToken({ iss:"admin-tool", sub:"admin-tool", aud:"hardware-catalog", scopes:[scope] }, secret)}` }; }
function post(body, headers = {}) { return { method:"POST", headers:{ "Content-Type":"application/json", ...headers }, body:JSON.stringify(body) }; }
function url(server, path) { return `http://127.0.0.1:${server.address().port}${path}`; }
async function listen(app) { const server = http.createServer((req,res) => app(req,res).catch((error) => sendJson(res,error.status || 500,{ error:error.code || "internal" }))); await new Promise((resolve) => server.listen(0,"127.0.0.1",resolve)); return server; }
function close(server) { return new Promise((resolve) => server.close(resolve)); }
