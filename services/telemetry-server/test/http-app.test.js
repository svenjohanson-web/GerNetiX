const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");

test("internal telemetry API rejects a missing token and scopes reads by account and project", async () => {
  const calls = [];
  const service = {
    listMeasurements(accountId, projectId) { calls.push({ accountId, projectId }); return [{ measurement_id: "m-1" }]; },
  };
  const app = createHttpApp({ service, internalToken: "telemetry-secret" });
  const server = http.createServer((req, res) => app(req, res).catch((error) => {
    res.writeHead(error.status || 500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error.code }));
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const denied = await fetch(`${origin}/api/telemetry/internal/accounts/acct-other/projects/project-1/measurements`);
    assert.equal(denied.status, 403);
    const accepted = await fetch(`${origin}/api/telemetry/internal/accounts/acct-owner/projects/project-1/measurements`, { headers: { "X-GerNetiX-Telemetry-Token": "telemetry-secret" } });
    assert.equal(accepted.status, 200);
    assert.deepEqual(calls, [{ accountId: "acct-owner", projectId: "project-1" }]);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
