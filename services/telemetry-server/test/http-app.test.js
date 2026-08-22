const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "telemetry-http-auth-test-key";

function headers(scopes, context = null, audience = "telemetry-server") {
  const serviceToken = issueInternalToken({
    iss: "identity-server", sub: "identity-server", aud: audience, scopes,
  }, secret);
  const result = { Authorization: `Bearer ${serviceToken}` };
  if (context) {
    const delegation = issueInternalToken({
      iss: "identity-server", sub: "identity-server", aud: audience,
      kind: "delegated_user_action", scopes, context,
    }, secret);
    result["X-GerNetiX-Delegation"] = delegation;
  }
  return result;
}

test("telemetry uses exact scopes and account/project delegation", async () => {
  const calls = [];
  const service = {
    listMeasurements(accountId, projectId) { calls.push(["read", accountId, projectId]); return [{ measurement_id: "m-1" }]; },
    setRetentionPolicy(accountId, projectId) { calls.push(["retention", accountId, projectId]); return {}; },
    deleteProjectData(accountId, projectId) { calls.push(["delete", accountId, projectId]); return 1; },
    ingest() { calls.push(["ingest"]); return {}; },
  };
  const app = createHttpApp({ service, internalApiSigningKey: secret });
  const server = http.createServer((req, res) => app(req, res).catch((error) => {
    res.writeHead(error.status || 500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error.code }));
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const resource = `${origin}/api/telemetry/internal/accounts/acct-owner/projects/project-1/measurements`;
  const ownerContext = { account_id: "acct-owner", project_ids: ["project-1"], entitlements: [] };
  try {
    assert.equal((await fetch(resource)).status, 403);
    assert.equal((await fetch(resource, { headers: headers(["telemetry.read"], null) })).status, 403);
    assert.equal((await fetch(resource, { headers: headers(["telemetry.read"], ownerContext, "other-service") })).status, 403);
    assert.equal((await fetch(resource, { headers: headers(["telemetry.retention.write"], ownerContext) })).status, 403);
    assert.equal((await fetch(resource, { headers: headers(["telemetry.read"], { ...ownerContext, account_id: "acct-other" }) })).status, 403);
    assert.equal((await fetch(resource, { headers: headers(["telemetry.read"], { ...ownerContext, project_ids: ["project-other"] }) })).status, 403);

    const accepted = await fetch(resource, { headers: headers(["telemetry.read"], ownerContext) });
    assert.equal(accepted.status, 200);

    const retention = await fetch(`${origin}/api/telemetry/internal/accounts/acct-owner/projects/project-1/retention`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...headers(["telemetry.retention.write"], ownerContext) }, body: "{}",
    });
    assert.equal(retention.status, 200);

    const deleted = await fetch(`${origin}/api/telemetry/internal/accounts/acct-owner/projects/project-1/data`, {
      method: "DELETE", headers: headers(["telemetry.data.delete"], ownerContext),
    });
    assert.equal(deleted.status, 200);

    const ingest = await fetch(`${origin}/api/telemetry/internal/ingest`, {
      method: "POST", headers: { "Content-Type": "application/json", ...headers(["telemetry.ingest"]) }, body: "{}",
    });
    assert.equal(ingest.status, 202);
    assert.deepEqual(calls.map((call) => call[0]), ["read", "retention", "delete", "ingest"]);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("telemetry fails closed without signing configuration", async () => {
  const app = createHttpApp({ service: { ingest() { throw new Error("must not run"); } } });
  const server = http.createServer((req, res) => app(req, res).catch((error) => {
    res.writeHead(error.status || 500); res.end();
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/telemetry/internal/ingest`, {
      method: "POST", headers: headers(["telemetry.ingest"]), body: "{}",
    });
    assert.equal(response.status, 503);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
